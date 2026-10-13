import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { AccountError, createAccount } from '../server/auth/accounts.ts';
import { readAuthEnv } from '../server/auth/env.ts';
import { createAuth } from '../server/auth/index.ts';
import { closeDatabase, createDatabase } from '../server/database/client.ts';
import { readDatabaseEnv } from '../server/database/env.ts';

/**
 * Crea un account con email e password sul database configurato in .env.
 *
 *     npm run user:create -- --email mario@example.com --name "Mario Rossi"
 *
 * In v1 l'iscrizione pubblica è spenta e non c'è un mailer: la password si genera qui, si stampa
 * una volta sola e si consegna a mano. Chi la riceve la cambia dopo il primo accesso.
 */

const USAGE = 'Uso: npm run user:create -- --email <email> --name "<nome e cognome>"';

async function main() {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, name: { type: 'string' } },
    strict: true,
  });

  if (!values.email || !values.name) {
    console.error(USAGE);
    process.exit(1);
  }

  // 18 byte casuali: 24 caratteri base64url, ben oltre il minimo di Better Auth
  const password = randomBytes(18).toString('base64url');
  const db = await createDatabase(readDatabaseEnv());

  try {
    const id = await createAccount(db, createAuth(db, readAuthEnv()), { email: values.email, name: values.name, password });

    console.info(`Utente creato: ${id}`);
    console.info(`Email:    ${values.email.trim().toLowerCase()}`);
    console.info(`Password: ${password}`);
    console.info('La password non è salvata da nessuna parte: consegnala ora.');
  }
  catch (error) {
    if (!(error instanceof AccountError)) throw error;

    console.error(error.message);
    process.exitCode = 1;
  }
  finally {
    await closeDatabase(db);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
