'use strict';

const { query, one, withTransaction } = require('./_lib/db');
const {
  HttpError,
  send,
  fail,
  handleError,
  readJson,
  getQuery,
  methodNotAllowed,
} = require('./_lib/http');
const { requireUser } = require('./_lib/auth');
const { pickEmployeeFields, pickDependents } = require('./_lib/validate');
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

async function fetchDependents(employeeIds) {
  if (!employeeIds.length) return new Map();
  const placeholders = employeeIds.map((_, index) => `$${index + 1}`).join(', ');
  const rows = await query(
    `select * from employee_dependents where employee_id in (${placeholders}) order by id`,
    employeeIds
  );

  const grouped = new Map(employeeIds.map((id) => [String(id), []]));
  for (const row of rows) {
    const key = String(row.employee_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

async function list(req, res) {
  const rows = await query('select * from employees order by created_at desc');
  const grouped = await fetchDependents(rows.map((row) => row.id));
  const data = rows.map((row) => ({
    ...row,
    filhos: grouped.get(String(row.id)) || [],
  }));
  return send(res, 200, { data });
}

async function create(req, res) {
  const body = await readJson(req);
  const payload = pickEmployeeFields(body, { partial: false });
  const filhos = pickDependents(body.filhos) || [];
  const keys = Object.keys(payload);
  const values = keys.map((key) => payload[key]);
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');

  let text = `insert into employees (${keys.join(', ')}) values (${placeholders}) returning *`;
  if (filhos.length) {
    const filhosParam = `$${values.length + 1}`;
    values.push(JSON.stringify(filhos.map((filho) => ({
      nome: filho.nome,
      data_nascimento: filho.data_nascimento ?? null,
      rg: filho.rg ?? null,
      cpf: filho.cpf ?? null,
    }))));
    text = `
      with novo as (
        insert into employees (${keys.join(', ')}) values (${placeholders}) returning *
      ),
      deps as (
        insert into employee_dependents (employee_id, nome, data_nascimento, rg, cpf)
        select novo.id, d.nome, d.data_nascimento::date, d.rg, d.cpf
        from novo
        cross join jsonb_to_recordset(${filhosParam}::jsonb)
          as d(nome text, data_nascimento text, rg text, cpf text)
        returning id
      )
      select * from novo
    `;
  }

  const rows = await query(text, values);
  const created = rows[0];
  const grouped = await fetchDependents([created.id]);
  return send(res, 201, {
    data: { ...created, filhos: grouped.get(String(created.id)) || [] },
  });
}

async function update(req, res) {
  const id = parseId(getQuery(req).id);
  if (!id) return fail(res, 400, 'ID invalido.');

  const body = await readJson(req);
  const payload = pickEmployeeFields(body, { partial: true });
  if (payload.cargo_id !== undefined && payload.salario === undefined) {
    payload.salario_personalizado = false;
  }
  const filhos = pickDependents(body.filhos);
  const keys = Object.keys(payload);

  if (!keys.length && filhos === undefined) {
    return fail(res, 400, 'Nenhum campo para atualizar.');
  }

  const existing = await query(
    'select id from employee_dependents where employee_id = $1',
    [id]
  );
  const existingIds = new Set(existing.map((row) => String(row.id)));

  const operations = [];
  if (keys.length) {
    const values = keys.map((key) => payload[key]);
    const sets = keys.map((key, index) => `${key} = $${index + 1}`);
    values.push(id);
    operations.push({
      text: `update employees set ${sets.join(', ')} where id = $${values.length} returning *`,
      params: values,
    });
  } else {
    operations.push({ text: 'select * from employees where id = $1', params: [id] });
  }

  if (filhos !== undefined) {
    const keptIds = new Set();
    for (const filho of filhos) {
      if (filho.id !== undefined && filho.id !== null) {
        const depId = String(filho.id);
        if (!existingIds.has(depId)) {
          throw new HttpError(400, `Filho ${depId} nao pertence a este funcionario.`);
        }
        keptIds.add(depId);
      }
    }

    for (const depId of existingIds) {
      if (!keptIds.has(depId)) {
        operations.push({
          text: 'delete from employee_dependents where id = $1 and employee_id = $2',
          params: [depId, id],
        });
      }
    }

    for (const filho of filhos) {
      const values = [
        filho.nome,
        filho.data_nascimento ?? null,
        filho.rg ?? null,
        filho.cpf ?? null,
      ];
      if (filho.id !== undefined && filho.id !== null) {
        operations.push({
          text: `update employee_dependents
                    set nome = $1, data_nascimento = $2, rg = $3, cpf = $4
                  where id = $5 and employee_id = $6
                  returning id`,
          params: [...values, filho.id, id],
        });
      } else {
        operations.push({
          text: `insert into employee_dependents (employee_id, nome, data_nascimento, rg, cpf)
                 values ($5, $1, $2, $3, $4)`,
          params: [...values, id],
        });
      }
    }
  }

  operations.push({
    text: 'select * from employee_dependents where employee_id = $1 order by id',
    params: [id],
  });

  const results = await withTransaction(operations);
  const employeeRow = results[0][0];
  if (!employeeRow) throw new HttpError(404, 'Funcionario nao encontrado.');

  return send(res, 200, {
    data: { ...employeeRow, filhos: results[results.length - 1] },
  });
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
