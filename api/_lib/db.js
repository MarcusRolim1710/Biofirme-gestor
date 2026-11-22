'use strict';

const { neon } = require('@neondatabase/serverless');

let client = null;

function sqlClient() {
  if (client) return client;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL nao configurada.');

  client = neon(url);
  return client;
}

/** Executa SQL parametrizado e retorna as linhas. */
async function query(text, params = []) {
  const sql = sqlClient();
  return sql.query(text, params);
}

async function one(text, params = []) {
  const rows = await query(text, params);
  return rows[0] || null;
}

/**
 * Executa uma lista de queries em um unico lote atomico (batch transaction).
 * Cada item deve ter { text, params }; o retorno e um array com as linhas de cada query.
 */
async function withTransaction(operations) {
  const sql = sqlClient();
  const prepared = operations.map((op) => sql.query(op.text, op.params || []));
  return sql.transaction(prepared);
}

module.exports = { query, one, withTransaction };
