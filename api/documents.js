'use strict';

const { query, one } = require('./_lib/db');
const {
  send,
  fail,
  handleError,
  readJson,
  getQuery,
  methodNotAllowed,
} = require('./_lib/http');
const { requireUser } = require('./_lib/auth');
const { pickDocumentFields } = require('./_lib/validate');
const { deleteObject, urlToKey } = require('./_lib/storage');

const WRITE_ROLES = ['admin', 'gestor', 'manager'];
const DELETE_ROLES = ['admin', 'gestor'];

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function list(req, res) {
  const employeeId = parseId(getQuery(req).employeeId || getQuery(req).employee_id);
  if (!employeeId) return fail(res, 400, 'Informe o funcionario.');

  const rows = await query(
    'select * from employee_documents where employee_id = $1 order by created_at',
    [employeeId]
  );

  return send(res, 200, { data: rows });
}

async function create(req, res) {
  const body = await readJson(req);
  const payload = pickDocumentFields(body, { partial: false });

  const rows = await query(
    `insert into employee_documents (employee_id, tipo, titulo, url, mime, tamanho_bytes)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      payload.employee_id,
      payload.tipo,
      payload.titulo,
      payload.url,
      payload.mime ?? null,
      payload.tamanho_bytes ?? null,
    ]
  );

  return send(res, 201, { data: rows[0] });
}

async function remove(req, res) {
  const id = parseId(getQuery(req).id);
  if (!id) return fail(res, 400, 'ID invalido.');

  const row = await one(
    'delete from employee_documents where id = $1 returning id, url',
    [id]
  );
  if (!row) return fail(res, 404, 'Documento nao encontrado.');

  const key = urlToKey(row.url);
  if (key) {
    try {
      await deleteObject(key);
    } catch (err) {
      console.error('[documents] falha ao remover arquivo:', err.message);
    }
  }

  return send(res, 200, { ok: true });
}

module.exports = async function handler(req, res) {
  try {
    const method = req.method;

    if (method === 'GET') {
      if (!requireUser(req, res)) return;
      return await list(req, res);
    }

    if (method === 'POST') {
      if (!requireUser(req, res, WRITE_ROLES)) return;
      return await create(req, res);
    }

    if (method === 'DELETE') {
      if (!requireUser(req, res, DELETE_ROLES)) return;
      return await remove(req, res);
    }

    return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
  } catch (err) {
    return handleError(res, err);
  }
};
