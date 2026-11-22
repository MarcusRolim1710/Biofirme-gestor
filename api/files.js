'use strict';

const { fail, handleError, getQuery, methodNotAllowed } = require('./_lib/http');
const { requireUser } = require('./_lib/auth');
const { isValidKey, presignGet } = require('./_lib/storage');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    if (!requireUser(req, res)) return;

    const key = String(getQuery(req).key || '');
    if (!isValidKey(key)) return fail(res, 400, 'Arquivo invalido.');

    const signedUrl = await presignGet(key, 300);

    res.statusCode = 302;
    res.setHeader('Location', signedUrl);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.end();
  } catch (err) {
    return handleError(res, err);
  }
};
