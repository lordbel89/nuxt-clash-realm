import postgres from 'postgres';
import { applyGrants } from './grants.ts';
import { readDatabaseEnv } from './env.ts';

/**
 * Applica i permessi al ruolo dell'applicazione sul database configurato in .env, con le credenziali
 * del ruolo owner (`NUXT_DATABASE_URL` qui è quella dell'owner: lo script di avvio del container la
 * sostituisce). Il ruolo è `DATABASE_APP_ROLE`, `clash_app` se manca.
 *
 *     DATABASE_APP_ROLE=clash_app npm run db:grant
 */
async function main() {
  const { dialect, url } = readDatabaseEnv();
  const role = process.env.DATABASE_APP_ROLE || 'clash_app';

  if (dialect !== 'postgres') {
    console.info('Permessi non necessari: PGlite ha un solo utente.');
    return;
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    console.info(`Permessi al ruolo ${role} in corso…`);
    await applyGrants(sql, role);
    console.info('Permessi applicati.');
  }
  finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
