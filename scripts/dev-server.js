'use strict';

/**
 * Servidor local (estatico + /api) sem depender da Vercel CLI.
 * Uso: npm run dev  ->  http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);

const handlers = {
  auth: require('../api/auth'),
  employees: require('../api/employees'),
  positions: require('../api/positions'),
  documents: require('../api/documents'),
  uploads: require('../api/uploads'),
  files: require('../api/files'),
  health: require('../api/health'),
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function isBlockedPath(relative) {
  const normalized = relative.replace(/\\/g, '/');
  if (normalized.startsWith('.')) return true;
  return (
    normalized.startsWith('node_modules/') ||
    normalized.startsWith('api/') ||
    normalized.startsWith('db/') ||
    normalized.startsWith('scripts/') ||
    normalized === 'package.json' ||
    normalized === 'package-lock.json' ||
    normalized.endsWith('.sql')
  );
}

async function handleApi(req, res, pathname) {
  const name = pathname.slice('/api/'.length).replace(/\/+$/, '');
  const handler = handlers[name];

  if (!handler) return sendJson(res, 404, { error: 'Endpoint nao encontrado.' });

  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  req.query = Object.fromEntries(parsed.searchParams);

  if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
    const raw = await readBody(req);
    req.rawBody = raw;
    if (raw.length) {
      try {
        req.body = JSON.parse(raw.toString('utf8'));
      } catch {
        return sendJson(res, 400, { error: 'JSON invalido.' });
      }
    }
  }

  await handler(req, res);
}

async function handleStatic(req, res, pathname) {
  let relative = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (!relative) relative = 'index.html';
  if (!path.extname(relative)) relative += '.html';

  if (isBlockedPath(relative)) {
    return sendJson(res, 404, { error: 'Arquivo nao encontrado.' });
  }

  const absolute = path.resolve(ROOT, relative);
  if (!absolute.startsWith(ROOT)) {
    return sendJson(res, 403, { error: 'Acesso negado.' });
  }

  try {
    const stat = await fs.promises.stat(absolute);
    if (!stat.isFile()) throw new Error('not a file');

    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[path.extname(absolute).toLowerCase()] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(absolute).pipe(res);
  } catch {
    sendJson(res, 404, { error: 'Arquivo nao encontrado.' });
  }
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;

  try {
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
    } else {
      await handleStatic(req, res, pathname);
    }
  } catch (err) {
    console.error('[dev]', err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Erro interno.' });
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log(`Biofirme dev: http://localhost:${PORT}`);
});
