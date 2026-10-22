import { fromPglite, PgBoss } from 'pg-boss';
import type { Database, DatabaseDialect } from '../database/client.ts';

/**
 * pg-boss: code e job persistenti nello stesso Postgres, in uno schema suo (`pgboss`) con le migrazioni
 * che si applica da sé a `start()`. In v1 nessuna funzione lo usa; da F7 ci passano mailer, push e le
 * scadenze (F8).
 *
 * - **Produzione (Postgres):** pg-boss apre un pool suo, con la stessa stringa di connessione del
 *   database. Per accodare un job nella transazione di una modifica si usa
 *   `fromDrizzle(tx, sql)` nell'opzione `db` di `send()`: il job esiste solo se la transazione fa commit.
 * - **Sviluppo (PGlite):** pg-boss parla con la stessa istanza PGlite che usa Drizzle, tramite
 *   `fromPglite`. PGlite è una connessione sola: un worker alla volta, e dentro una transazione di
 *   Drizzle un `send()` senza `db: fromDrizzle(tx, sql)` aspetterebbe la fine della transazione per
 *   sempre (vedi `docs/backend-structure.md`).
 */

export interface BossOptions {
  dialect: DatabaseDialect;
  /** Stringa di connessione Postgres, usata solo con il dialetto postgres. */
  url: string;
}

const POOL_SIZE = 4;

/** Costruisce pg-boss senza avviarlo. */
export function createBoss(db: Database, { dialect, url }: BossOptions) {
  if (dialect === 'postgres') {
    if (!url) throw new Error('Connessione Postgres non configurata: valorizza NUXT_DATABASE_URL');

    return new PgBoss({ connectionString: url, application_name: 'clash-realm-jobs', max: POOL_SIZE });
  }

  // `Database` è tipato come il Postgres di rete; con questo dialetto il client è PGlite (vedi `createDatabase`)
  return new PgBoss({ db: fromPglite(db.$client as unknown as Parameters<typeof fromPglite>[0]), backend: 'pglite' });
}

/** Costruisce e avvia pg-boss; un errore asincrono dopo l'avvio va nel log e non butta giù il processo. */
export async function startBoss(db: Database, options: BossOptions) {
  const boss = createBoss(db, options);

  boss.on('error', error => console.error('[pg-boss]', error));
  await boss.start();

  return boss;
}

/** Ferma pg-boss in modo pulito: aspetta i job in corso, poi lascia andare le connessioni sue. */
export async function stopBoss(boss: PgBoss) {
  await boss.stop({ graceful: true, timeout: 10_000 });
}
