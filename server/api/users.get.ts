import type { Paginated } from '#shared/types/api';
import type { UserSummary } from '#shared/types/user';
import { UserListQuery } from '#shared/schemas/user';
import { listUsers } from '../services/users.ts';

/** GET /api/users — rubrica minima, accessibile solo con sessione; `search` per trovare qualcuno. */
export default defineEventHandler(async (event): Promise<Paginated<UserSummary>> => {
  await requireSession(event);
  const query = readQuery(event, UserListQuery);
  return listUsers(await useDatabase(), query);
});
