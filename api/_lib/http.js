'use strict';

/**
 * Helpers HTTP usados pelas Vercel Functions e pelo dev server local.
 * Nao dependem de APIs exclusivas da Vercel (res.status/res.json).
 */

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function send(res, status, body) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(payload);
}

function fail(res, status, message, details) {
  send(res, status, { error: message, ...(details ? { details } : {}) });
}

function handleError(res, err) {
  if (err instanceof HttpError) return fail(res, err.status, err.message, err.details);
  console.error('[api]', err);
  return fail(res, 500, 'Erro interno do servidor.');
}

async function readJson(req) {
  const body = req.body;

  if (body !== undefined && body !== null) {
    if (Buffer.isBuffer(body)) {
      const raw = body.toString('utf8');
      if (!raw) return {};
      try {
        return JSON.parse(raw);
      } catch {
        throw new HttpError(400, 'JSON invalido.');
      }
    }
    if (typeof body === 'string') {
      if (!body) return {};
      try {
        return JSON.parse(body);
      } catch {
        throw new HttpError(400, 'JSON invalido.');
      }
    }
    if (typeof body === 'object') return body;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'JSON invalido.');
  }
}

function getQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  try {
    return Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
  } catch {
    return {};
  }
}

function parseCookies(req) {
  const header = req.headers && req.headers.cookie;
  const out = {};
  if (!header) return out;

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }

  return out;
}

function isSecureRequest() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

function serializeCookie(name, value, options = {}) {
  const {
    maxAge,
    path = '/',
    httpOnly = true,
    sameSite = 'Lax',
  } = options;

  let cookie = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
  if (httpOnly) cookie += '; HttpOnly';
  if (isSecureRequest()) cookie += '; Secure';
  if (maxAge !== undefined) cookie += `; Max-Age=${maxAge}`;
  return cookie;
}

function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  return fail(res, 405, 'Metodo nao permitido.');
}

module.exports = {
  HttpError,
  send,
  fail,
  handleError,
  readJson,
  getQuery,
  parseCookies,
  serializeCookie,
  methodNotAllowed,
};
