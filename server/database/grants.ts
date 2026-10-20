import type postgres from 'postgres';

/**
 * Le tabelle che l'applicazione può solo leggere e aggiungere: lo storico non si riscrive. Non
 * protegge da chi accede al database direttamente (brainstorm, *Storico del torneo*), ma un bug
 * dell'applicazione non può alterarlo.
 */
export const APPEND_ONLY_TABLES = ['history_entries'] as const;

/**
 * Dà al ruolo dell'applicazione i permessi su tutte le tabelle dello schema `public`, tranne quelle
 * di sola aggiunta. Va eseguito con il ruolo che possiede le tabelle (owner) dopo ogni migrazione:
 * è idempotente, e le tabelle nuove le copre da sé. L'applicazione non può creare né cancellare
 * tabelle, e non vede lo schema `drizzle` con il registro delle migrazioni.
 *
 * Con `NUXT_JOBS_ENABLED` (F7) pg-boss vorrà anche il suo schema `pgboss`: i permessi si
 * aggiungono qui quando i job si accendono.
 */
export async function applyGrants(sql: postgres.Sql, role: string) {
  await sql.begin(async (tx) => {
    await tx`GRANT USAGE ON SCHEMA public TO ${tx(role)}`;
    await tx`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${tx(role)}`;
    await tx`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${tx(role)}`;

    for (const table of APPEND_ONLY_TABLES) {
      await tx`REVOKE UPDATE, DELETE, TRUNCATE ON ${tx(table)} FROM ${tx(role)}`;
    }
  });
}
