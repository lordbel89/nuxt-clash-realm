import { eq } from 'drizzle-orm';
import { readAuthEnv } from '../auth/env.ts';
import { createAuth } from '../auth/index.ts';
import { closeDatabase, createDatabase } from './client.ts';
import { readDatabaseEnv } from './env.ts';
import { accounts } from './schema/auth.ts';
import { users } from './schema/users.ts';

/**
 * Dati di partenza per lo sviluppo. Rieseguibile.
 *
 * La registrazione passa da `auth.api.signUpEmail` e non da un `insert`: è
 * l'unico modo di ottenere anche la riga in `accounts` con l'hash della
 * password, quindi utenti con cui si può davvero accedere. Per chi era già nel
 * database prima dell'autenticazione (o è nato senza credenziali) le
 * credenziali si aggiungono a parte, con l'hasher della libreria.
 *
 * Sofia serve a provare il divieto: la sospensione si applica dopo la
 * registrazione, come farebbe un'azione amministrativa.
 */

const SEED_PASSWORD = 'password';

const SEED_USERS = [
  { name: 'Luca Rossi', email: 'test@example.com' },
  { name: 'Giulia Bianchi', email: 'giulia.bianchi@example.com' },
  { name: 'Marco Ferrari', email: 'marco.ferrari@example.com' },
  { name: 'Sofia Greco', email: 'sofia.greco@example.com', banReason: 'Comportamento antisportivo' },
];

async function main() {
  const db = await createDatabase(readDatabaseEnv());
  const auth = createAuth(db, readAuthEnv());

  let registered = 0;
  let repaired = 0;

  for (const seed of SEED_USERS) {
    const existing = await db.query.users.findFirst({
      where: { email: { eq: seed.email } },
      columns: { id: true },
      with: { accounts: { columns: { id: true }, where: { providerId: { eq: 'credential' } } } },
    });

    if (!existing) {
      await auth.api.signUpEmail({
        body: { name: seed.name, email: seed.email, password: SEED_PASSWORD },
      });

      registered += 1;
    }
    else if (existing.accounts.length === 0) {
      // Utente senza credenziali: gli si allega un account `credential` con lo
      // stesso hasher che usa il login, invece di reinserire l'utente
      const { password } = await auth.$context;

      await db.insert(accounts).values({
        userId: existing.id,
        accountId: existing.id,
        providerId: 'credential',
        password: await password.hash(SEED_PASSWORD),
      });

      repaired += 1;
    }

    if (seed.banReason) {
      await db
        .update(users)
        .set({ bannedAt: new Date(), banReason: seed.banReason, bannedUntil: null })
        .where(eq(users.email, seed.email));
    }
  }

  console.info(
    `Utenti registrati: ${registered}, credenziali aggiunte: ${repaired}, `
    + `già a posto: ${SEED_USERS.length - registered - repaired} — password: ${SEED_PASSWORD}`,
  );

  await closeDatabase(db);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
