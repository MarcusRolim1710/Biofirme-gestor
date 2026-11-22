'use strict';

const { send, handleError } = require('./_lib/http');
const { query } = require('./_lib/db');
const { bucketExists } = require('./_lib/storage');

module.exports = async function handler(req, res) {
  try {
    const status = { ok: true, db: false, storage: false };

    try {
      await query('select 1');
      status.db = true;
    } catch (err) {
      console.error('[health] db:', err.message);
      status.ok = false;
    }

    try {
      await bucketExists();
      status.storage = true;
    } catch (err) {
      console.error('[health] storage:', err.message);
      status.ok = false;
    }

    return send(res, status.ok ? 200 : 503, {
      ...status,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(res, err);
  }
};
