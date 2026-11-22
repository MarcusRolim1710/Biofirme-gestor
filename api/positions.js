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
const { pickPositionFields } = require('./_lib/validate');

const WRITE_ROLES = ['admin', 'gestor', 'manager'];
const DELETE_ROLES = ['admin'];

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function list(req, res) {
  const rows = await query('select * from positions order by nome');
  return send(res, 200, { data: rows });
}

async function create(req, res) {
  const body = await readJson(req);
  const payload = pickPositionFields(body, { partial: false });

  const rows = await query(
    `insert into positions (nome, setor, salario_base, descricao)
     values ($1, $2, $3, $4)
     returning *`,
    [payload.nome, payload.setor ?? null, payload.salario_base, payload.descricao ?? null]
  );

  return send(res, 201, { data: rows[0] });
}

async function update(req, res) {
  const id = parseId(getQuery(req).id);
  if (!id) return fail(res, 400, 'ID invalido.');

  const body = await readJson(req);
  const payload = pickPositionFields(body, { partial: true });
  const keys = Object.keys(payload);
  if (!keys.length) return fail(res, 400, 'Nenhum campo para atualizar.');

  const values = keys.map((key) => payload[key]);
  const sets = keys.map((key, index) => `${key} = $${index + 1}`);
  values.push(id);

  const rows = await query(
    `update positions set ${sets.join(', ')} where id = $${values.length} returning *`,
    values
  );

  if (!rows[0]) return fail(res, 404, 'Cargo nao encontrado.');

  // Atualiza apenas quem ainda usa o salario do cargo; ajustes individuais sao preservados.
  if (Object.prototype.hasOwnProperty.call(payload, 'salario_base')) {
    await query(
      'update employees set salario = $1 where cargo_id = $2 and salario_personalizado is not true',
      [payload.salario_base, id]
    );
  }

  return send(res, 200, { data: rows[0] });
}

async function remove(req, res) {
  const id = parseId(getQuery(req).id);
  if (!id) return fail(res, 400, 'ID invalido.');

  const row = await one('delete from positions where id = $1 returning id', [id]);
  if (!row) return fail(res, 404, 'Cargo nao encontrado.');

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
