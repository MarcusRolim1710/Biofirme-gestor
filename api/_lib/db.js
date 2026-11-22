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

module.exports = { query, one };
