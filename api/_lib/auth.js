'use strict';

const jwt = require('jsonwebtoken');
const { parseCookies, serializeCookie, fail } = require('./http');

const COOKIE_NAME = 'biofirme_session';
const SESSION_SECONDS = 60 * 60 * 8; // 8 horas
const ISSUER = 'biofirme';

// Hash descartavel para igualar o tempo de resposta quando o usuario nao existe.
const DUMMY_HASH = '$2b$12$GG0ljhNMym6DQr5aQpgquu0WJvysUtnlfQzyb69/O4iV5oMe6Bvy.';

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET ausente ou com menos de 32 caracteres.');
  }
  return secret;
}

function signSession(profile) {
  return jwt.sign(
    {
      sub: profile.id,
      username: profile.username,
      role: profile.role,
    },
    authSecret(),
    { expiresIn: SESSION_SECONDS, issuer: ISSUER }
  );
}

function verifySession(token) {
  return jwt.verify(token, authSecret(), { issuer: ISSUER });
}

/** Retorna o payload do JWT ou null. */
function currentUser(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;

  try {
    return verifySession(token);
  } catch {
    return null;
  }
}

/**
 * Exige sessao valida. Se `roles` for informado, exige um dos perfis.
 * Retorna o usuario ou null (ja respondeu o erro).
 */
function requireUser(req, res, roles) {
  const user = currentUser(req);

  if (!user) {
    fail(res, 401, 'Nao autenticado.');
    return null;
  }

  if (roles && !roles.includes(user.role)) {
    fail(res, 403, 'Sem permissao para esta acao.');
    return null;
  }

  return user;
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(COOKIE_NAME, token, { maxAge: SESSION_SECONDS })
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, '', { maxAge: 0 }));
}

module.exports = {
  COOKIE_NAME,
  DUMMY_HASH,
  signSession,
  verifySession,
  currentUser,
  requireUser,
  setSessionCookie,
  clearSessionCookie,
};
