import type { Paginated } from '#shared/types/api';
import type { UserSummary } from '#shared/types/user';
import { ListQuery } from '#shared/schemas/common';
import { listUsers } from '../services/users.ts';

/** GET /api/users — rubrica minima, accessibile solo con sessione. */
export default defineEventHandler(async (event): Promise<Paginated<UserSummary>> => {
  await requireSession(event);
  const query = readQuery(event, ListQuery);
  return listUsers(await useDatabase(), query);
});
