'use strict';

const bcrypt = require('bcryptjs');
const { one } = require('./_lib/db');
const {
  send,
  fail,
  handleError,
  readJson,
  getQuery,
} = require('./_lib/http');
const {
  DUMMY_HASH,
  signSession,
  setSessionCookie,
  clearSessionCookie,
  requireUser,
} = require('./_lib/auth');

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
  };
}

async function login(req, res) {
  const body = await readJson(req);
  const identifier = String(body.username || body.email || body.identifier || '').trim();
  const password = String(body.password || '');

  if (!identifier || !password) {
    return fail(res, 400, 'Informe usuario e senha.');
  }

  const row = await one(
    `select id, username, email, role, password_hash, active
       from profiles
      where lower(username) = lower($1) or lower(email) = lower($1)
      limit 1`,
    [identifier]
  );

  if (!row || !row.active) {
    // Mantem o tempo de resposta parecido com o de uma senha errada.
    await bcrypt.compare(password, DUMMY_HASH);
    return fail(res, 401, 'Usuario ou senha invalidos.');
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    return fail(res, 401, 'Usuario ou senha invalidos.');
  }

  setSessionCookie(res, signSession(row));
  return send(res, 200, { user: publicUser(row) });
}

async function logout(req, res) {
  clearSessionCookie(res);
  return send(res, 200, { ok: true });
}

async function me(req, res) {
  const session = requireUser(req, res);
  if (!session) return;

  const row = await one(
    'select id, username, email, role, active from profiles where id = $1',
    [session.sub]
  );

  if (!row || !row.active) {
    clearSessionCookie(res);
    return fail(res, 401, 'Sessao invalida.');
  }

  return send(res, 200, { user: publicUser(row) });
}

module.exports = async function handler(req, res) {
  try {
    const action = getQuery(req).action || '';
    const method = req.method;

    if (method === 'POST' && action === 'login') return await login(req, res);
    if (method === 'POST' && action === 'logout') return await logout(req, res);
    if (method === 'GET' && action === 'me') return await me(req, res);

    return fail(res, 404, 'Acao nao encontrada.');
  } catch (err) {
    return handleError(res, err);
  }
};
