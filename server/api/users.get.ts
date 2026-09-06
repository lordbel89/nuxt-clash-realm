import type { User } from '#shared/types/user'
import { toUser } from '../mappers/user.ts'

/** GET /api/users — elenco degli utenti */
export default defineEventHandler(async (): Promise<User[]> => {
  const db = await useDatabase()

  const rows = await db.query.users.findMany({
    orderBy: { createdAt: 'asc' },
  })

  return rows.map(toUser)
})
