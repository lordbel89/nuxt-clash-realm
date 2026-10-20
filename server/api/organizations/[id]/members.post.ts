import type { OrganizationMember } from '#shared/types/organization';
import { AddOrganizationMemberInput, OrganizationIdParams } from '#shared/schemas/organization';
import { addMember, canAssignRole } from '../../../services/organizations.ts';

/**
 * POST /api/organizations/:id/members — aggiunge un utente registrato, trovato con
 * `GET /api/users?search=`. Un owner aggiunge owner e admin, un admin solo admin.
 */
export default defineEventHandler(async (event): Promise<OrganizationMember> => {
  const { id } = readParams(event, OrganizationIdParams);
  const actor = await requireOrganizationRole(event, id, ANY_ORGANIZATION_ROLE);
  const input = await readInput(event, AddOrganizationMemberInput);

  if (!canAssignRole(actor.role, input.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Solo un owner può aggiungere un owner' });
  }

  const result = await addMember(await useDatabase(), id, input);
  if (!result.ok) throw memberChangeError(result.reason);
  return result.member;
});
