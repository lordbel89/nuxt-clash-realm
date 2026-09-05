import { closeDatabase, createDatabase } from './client.ts'
import { readDatabaseEnv } from './env.ts'
import type { NewUserRow } from './schema/users.ts'
import { users } from './schema/users.ts'

const SEED_USERS: NewUserRow[] = [
  { name: 'Giulia Bianchi', email: 'giulia.bianchi@example.com' },
  { name: 'Marco Ferrari', email: 'marco.ferrari@example.com' },
  { name: 'Sofia Greco', email: 'sofia.greco@example.com', isActive: false }
]

/**
 * Dati di partenza per lo sviluppo. Rieseguibile: gli utenti già presenti
 * vengono ignorati grazie al vincolo di unicità sull'email.
 */
async function main() {
  const env = readDatabaseEnv()
  const db = await createDatabase(env)

  const inserted = await db
    .insert(users)
    .values(SEED_USERS)
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, email: users.email })

  console.info(`Utenti inseriti: ${inserted.length} (${SEED_USERS.length - inserted.length} già presenti)`)

  await closeDatabase(db)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
