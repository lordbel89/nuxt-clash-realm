import type { Paginated } from '#shared/types/api';
import type { Organization } from '#shared/types/organization';
import { ListQuery } from '#shared/schemas/common';
import { listOwnOrganizations } from '../services/organizations.ts';

/** GET /api/organizations — le organizzazioni di cui chi chiama è membro, con il suo ruolo. */
export default defineEventHandler(async (event): Promise<Paginated<Organization>> => {
  const actorId = await requireUserId(event);
  const query = readQuery(event, ListQuery);
  return listOwnOrganizations(await useDatabase(), actorId, query);
});
