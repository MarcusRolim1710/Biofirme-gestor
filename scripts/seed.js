'use strict';

/**
 * Cria/atualiza os usuarios iniciais (admin).
 * Uso: npm run db:seed
 *
 * Senhas:
 *   - SEED_PASSWORD_MARCUS / SEED_PASSWORD_GESTOR em .env.local
 *   - se ausentes, uma senha forte e gerada e exibida uma unica vez
 */

const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const USERS = [
  {
    username: 'marcus.rolim',
    email: 'marcus.rolim@biofirme.local',
    role: 'admin',
    passwordEnv: 'SEED_PASSWORD_MARCUS',
  },
  {
    username: 'gestor.biofirme',
    email: 'gestor.biofirme@biofirme.local',
    role: 'admin',
    passwordEnv: 'SEED_PASSWORD_GESTOR',
  },
];

function generatePassword() {
  return crypto.randomBytes(12).toString('base64url');
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL nao configurada (.env.local ou variavel de ambiente).');
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    for (const user of USERS) {
      const provided = process.env[user.passwordEnv];
      const generated = !provided;
      const password = provided || generatePassword();

      if (password.length < 8) {
        throw new Error(`${user.passwordEnv} precisa ter ao menos 8 caracteres.`);
      }

      const hash = await bcrypt.hash(password, 12);

      await client.query(
        `insert into profiles (username, email, password_hash, role, active)
         values ($1, $2, $3, $4, true)
         on conflict (username) do update
           set email = excluded.email,
               password_hash = excluded.password_hash,
               role = excluded.role,
               active = true,
               updated_at = now()`,
        [user.username, user.email, hash, user.role]
      );

      if (generated) {
        console.log(`[novo] ${user.username} / ${password}  (guarde esta senha, ela nao sera exibida novamente)`);
      } else {
        console.log(`[ok]   ${user.username}  (senha definida em ${user.passwordEnv})`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Falha no seed:', err.message);
  process.exit(1);
});
