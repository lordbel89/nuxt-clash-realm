import type { Paginated } from '#shared/types/api';
import type { OrganizationMember } from '#shared/types/organization';
import { ListQuery } from '#shared/schemas/common';
import { OrganizationIdParams } from '#shared/schemas/organization';
import { listMembers } from '../../../services/organizations.ts';

/** GET /api/organizations/:id/members — i membri, visibili a ogni membro. */
export default defineEventHandler(async (event): Promise<Paginated<OrganizationMember>> => {
  const { id } = readParams(event, OrganizationIdParams);
  await requireOrganizationRole(event, id, ANY_ORGANIZATION_ROLE);
  const query = readQuery(event, ListQuery);
  return listMembers(await useDatabase(), id, query);
});
