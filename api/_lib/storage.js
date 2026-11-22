'use strict';

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
  PutBucketCorsCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const BUCKET = process.env.STORAGE_BUCKET || 'biofirme';
const FOLDERS = ['foto', 'rg_frente', 'rg_verso', 'cpf', 'comprovante', 'ctps', 'diversos'];

const CONTENT_TYPES = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

let client = null;

function assertConfig() {
  const required = [
    'AWS_ENDPOINT_URL_S3',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Variaveis de storage ausentes: ${missing.join(', ')}`);
  }
}

function s3() {
  if (client) return client;
  assertConfig();

  client = new S3Client({
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
    // Evita headers de checksum que quebram presigned URLs em S3 compativel.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  return client;
}

function sanitizeHint(value) {
  return String(value || 'tmp')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64) || 'tmp';
}

function buildKey(folder, hint, contentType) {
  if (!FOLDERS.includes(folder)) throw new Error('Pasta de upload invalida.');
  const ext = CONTENT_TYPES[contentType];
  if (!ext) throw new Error('Tipo de arquivo nao permitido.');

  const random = Math.random().toString(36).slice(2, 8);
  return `${folder}/${sanitizeHint(hint)}_${Date.now()}_${random}.${ext}`;
}

function isValidKey(key) {
  if (typeof key !== 'string' || key.length > 300) return false;
  if (key.includes('..') || key.startsWith('/')) return false;
  return FOLDERS.some((folder) => key.startsWith(`${folder}/`)) && /^[a-zA-Z0-9/_.-]+$/.test(key);
}

async function presignPut(key, contentType, expiresIn = 600) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3(), command, { expiresIn });
}

async function presignGet(key, expiresIn = 300) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3(), command, { expiresIn });
}

async function deleteObject(key) {
  if (!isValidKey(key)) return;
  await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

async function deleteObjects(keys) {
  const valid = [...new Set((keys || []).filter(isValidKey))];
  if (!valid.length) return;

  await s3().send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: valid.map((Key) => ({ Key })), Quiet: true },
    })
  );
}

async function deleteByPrefix(prefix) {
  const list = await s3().send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  );
  const keys = (list.Contents || []).map((item) => item.Key).filter(Boolean);
  await deleteObjects(keys);
}

async function bucketExists() {
  await s3().send(new HeadBucketCommand({ Bucket: BUCKET }));
  return true;
}

async function configureCors(origins) {
  await s3().send(
    new PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ['GET', 'PUT', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );
}

/** Extrai a chave do storage a partir de uma URL interna /api/files?key=... */
function urlToKey(url) {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsed = new URL(url, 'http://localhost');
    if (parsed.pathname !== '/api/files') return null;
    const key = parsed.searchParams.get('key');
    return key && isValidKey(key) ? key : null;
  } catch {
    return null;
  }
}

module.exports = {
  BUCKET,
  FOLDERS,
  CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  s3,
  buildKey,
  isValidKey,
  presignPut,
  presignGet,
  deleteObject,
  deleteObjects,
  deleteByPrefix,
  bucketExists,
  configureCors,
  urlToKey,
};
