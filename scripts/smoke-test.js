'use strict';

/**
 * Teste rapido de infraestrutura: Postgres + Object Storage.
 * Uso: npm test
 */

const path = require('path');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { query } = require('../api/_lib/db');
const {
  BUCKET,
  s3,
  presignPut,
  presignGet,
} = require('../api/_lib/storage');

async function main() {
  const tables = await query(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
  );
  const names = tables.map((row) => row.table_name);
  const expected = ['employee_documents', 'employees', 'positions', 'profiles'];

  for (const table of expected) {
    if (!names.includes(table)) throw new Error(`Tabela ausente: ${table}`);
  }

  const profiles = await query('select count(*)::int as total from profiles');
  if (!profiles[0] || profiles[0].total < 1) throw new Error('Nenhum usuario cadastrado.');

  const key = '_healthcheck/smoke-test.txt';
  const body = `smoke ${Date.now()}`;

  const putUrl = await presignPut(key, 'text/plain', 120);
  const put = await fetch(putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body,
  });
  if (!put.ok) throw new Error(`PUT falhou: ${put.status}`);

  const getUrl = await presignGet(key, 120);
  const get = await fetch(getUrl);
  if (!get.ok) throw new Error(`GET falhou: ${get.status}`);
  if ((await get.text()) !== body) throw new Error('Conteudo do objeto nao confere.');

  await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));

  console.log(`OK - tabelas: ${names.join(', ')}`);
  console.log(`OK - usuarios: ${profiles[0].total}`);
  console.log('OK - storage (PUT/GET/DELETE)');
}

main().catch((err) => {
  console.error('Falhou:', err.message);
  process.exit(1);
});
