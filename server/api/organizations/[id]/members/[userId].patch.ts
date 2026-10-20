import type { OrganizationMember } from '#shared/types/organization';
import { OrganizationMemberParams, UpdateOrganizationMemberInput } from '#shared/schemas/organization';
import { updateMemberRole } from '../../../../services/organizations.ts';

/**
 * PATCH /api/organizations/:id/members/:userId — cambia il ruolo. Solo un owner: è sempre una
 * promozione a owner o il declassamento di un owner. L'ultimo owner non si declassa.
 */
export default defineEventHandler(async (event): Promise<OrganizationMember> => {
  const { id, userId } = readParams(event, OrganizationMemberParams);
  await requireOrganizationRole(event, id, ['owner']);
  const input = await readInput(event, UpdateOrganizationMemberInput);

  const result = await updateMemberRole(await useDatabase(), id, userId, input.role);
  if (!result.ok) throw memberChangeError(result.reason);
  return result.member;
});
