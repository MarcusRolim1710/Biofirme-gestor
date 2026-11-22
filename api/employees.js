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
const { pickEmployeeFields } = require('./_lib/validate');
const { deleteObjects, urlToKey } = require('./_lib/storage');

const WRITE_ROLES = ['admin', 'gestor', 'manager'];
const DELETE_ROLES = ['admin'];

const FILE_URL_FIELDS = [
  'foto_url',
  'rg_frente_url',
  'rg_verso_url',
  'cpf_doc_url',
  'comprovante_endereco_url',
  'ctps_doc_url',
];

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function list(req, res) {
  const rows = await query('select * from employees order by created_at desc');
  return send(res, 200, { data: rows });
}

async function create(req, res) {
  const body = await readJson(req);
  const payload = pickEmployeeFields(body, { partial: false });
  const keys = Object.keys(payload);
  const values = keys.map((key) => payload[key]);
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');

  const rows = await query(
    `insert into employees (${keys.join(', ')}) values (${placeholders}) returning *`,
    values
  );

  return send(res, 201, { data: rows[0] });
}

async function update(req, res) {
  const id = parseId(getQuery(req).id);
  if (!id) return fail(res, 400, 'ID invalido.');

  const body = await readJson(req);
  const payload = pickEmployeeFields(body, { partial: true });
  if (payload.cargo_id !== undefined && payload.salario === undefined) {
    payload.salario_personalizado = false;
  }
  const keys = Object.keys(payload);

  if (!keys.length) return fail(res, 400, 'Nenhum campo para atualizar.');

  const values = keys.map((key) => payload[key]);
  const sets = keys.map((key, index) => `${key} = $${index + 1}`);
  values.push(id);

  const rows = await query(
    `update employees set ${sets.join(', ')} where id = $${values.length} returning *`,
    values
  );

  if (!rows[0]) return fail(res, 404, 'Funcionario nao encontrado.');
  return send(res, 200, { data: rows[0] });
}

async function remove(req, res) {
  const id = parseId(getQuery(req).id);
  if (!id) return fail(res, 400, 'ID invalido.');

  const employee = await one('select * from employees where id = $1', [id]);
  if (!employee) return fail(res, 404, 'Funcionario nao encontrado.');

  const documents = await query(
    'select url from employee_documents where employee_id = $1',
    [id]
  );

  const keys = [
    ...FILE_URL_FIELDS.map((field) => urlToKey(employee[field])),
    ...documents.map((doc) => urlToKey(doc.url)),
  ].filter(Boolean);

  try {
    await deleteObjects(keys);
  } catch (err) {
    // Nao bloqueia a exclusao do cadastro se o storage falhar.
    console.error('[employees] falha ao remover arquivos:', err.message);
  }

  await query('delete from employees where id = $1', [id]);
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

    if (method === 'PATCH') {
      if (!requireUser(req, res, WRITE_ROLES)) return;
      return await update(req, res);
    }

    if (method === 'DELETE') {
      if (!requireUser(req, res, DELETE_ROLES)) return;
      return await remove(req, res);
    }

    return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE']);
  } catch (err) {
    return handleError(res, err);
  }
};
