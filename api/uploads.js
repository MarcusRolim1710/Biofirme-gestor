'use strict';

const {
  send,
  fail,
  handleError,
  readJson,
  methodNotAllowed,
} = require('./_lib/http');
const { requireUser } = require('./_lib/auth');
const {
  FOLDERS,
  CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  buildKey,
  presignPut,
} = require('./_lib/storage');

const WRITE_ROLES = ['admin', 'gestor', 'manager'];
const EXPIRES_IN = 600;

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!requireUser(req, res, WRITE_ROLES)) return;

    const body = await readJson(req);
    const folder = String(body.folder || '');
    const contentType = String(body.contentType || '');
    const size = Number(body.size);

    if (!FOLDERS.includes(folder)) {
      return fail(res, 400, 'Pasta de upload invalida.');
    }
    if (!CONTENT_TYPES[contentType]) {
      return fail(res, 400, 'Tipo de arquivo nao permitido (use WebP, JPEG, PNG ou PDF).');
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
      return fail(res, 400, 'Arquivo deve ter no maximo 10 MB.');
    }

    const key = buildKey(folder, body.hint, contentType);
    const uploadUrl = await presignPut(key, contentType, EXPIRES_IN);

    return send(res, 200, {
      key,
      url: `/api/files?key=${encodeURIComponent(key)}`,
      uploadUrl,
      headers: { 'Content-Type': contentType },
      expiresIn: EXPIRES_IN,
    });
  } catch (err) {
    return handleError(res, err);
  }
};
