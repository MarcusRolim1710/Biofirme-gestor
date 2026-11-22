'use strict';

/**
 * Configura CORS do bucket e valida o ciclo PUT/GET/DELETE.
 * Uso: npm run storage:setup
 */

const path = require('path');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
  BUCKET,
  s3,
  bucketExists,
  configureCors,
  presignPut,
  presignGet,
} = require('../api/_lib/storage');

async function main() {
  const origins = String(process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  await configureCors(origins);
  console.log(`CORS configurado para: ${origins.join(', ')}`);

  try {
    await bucketExists();
    console.log(`Bucket "${BUCKET}" acessivel.`);
  } catch (err) {
    console.warn(`Aviso: HeadBucket falhou (${err.name}). Seguindo com o teste de upload.`);
  }

  const key = '_healthcheck/presign-test.txt';
  const contentType = 'text/plain';
  const body = `biofirme storage ok ${new Date().toISOString()}`;

  const putUrl = await presignPut(key, contentType, 120);
  const put = await fetch(putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
  if (!put.ok) throw new Error(`PUT falhou: HTTP ${put.status} ${await put.text()}`);

  const getUrl = await presignGet(key, 120);
  const get = await fetch(getUrl);
  if (!get.ok) throw new Error(`GET falhou: HTTP ${get.status}`);
  const received = await get.text();
  if (received !== body) throw new Error('Conteudo do objeto nao confere.');

  await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  console.log('Upload, leitura e exclusao via presigned URL: OK');
}

main().catch((err) => {
  console.error('Falha ao configurar o storage:', err.message);
  process.exit(1);
});
