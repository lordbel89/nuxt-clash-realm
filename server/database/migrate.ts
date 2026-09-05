import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator'
import { closeDatabase, createDatabase } from './client.ts'
import { MIGRATIONS_DIR, readDatabaseEnv } from './env.ts'

/**
 * Applica le migrazioni al dialetto configurato in .env.
 * Eseguito da `npm run db:migrate` (Node esegue direttamente il .ts).
 */
async function main() {
  const env = readDatabaseEnv()
  const db = await createDatabase(env)

  console.info(`Migrazioni ${env.dialect} in corso…`)

  if (env.dialect === 'postgres') {
    await migratePostgres(db, { migrationsFolder: MIGRATIONS_DIR })
  }
  else {
    await migratePglite(db as never, { migrationsFolder: MIGRATIONS_DIR })
  }

  await closeDatabase(db)
  console.info('Migrazioni applicate.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
