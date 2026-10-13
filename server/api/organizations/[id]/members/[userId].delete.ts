import { OrganizationMemberParams } from '#shared/schemas/organization';
import { removeMember } from '../../../../services/organizations.ts';

/**
 * DELETE /api/organizations/:id/members/:userId — toglie un membro, o esce se `userId` è il
 * proprio. Un owner toglie chiunque, un admin solo admin; l'ultimo owner non esce.
 */
export default defineEventHandler(async (event): Promise<void> => {
  const { id, userId } = readParams(event, OrganizationMemberParams);
  const actor = await requireOrganizationRole(event, id, ANY_ORGANIZATION_ROLE);

  const result = await removeMember(await useDatabase(), id, actor, userId);
  if (!result.ok) throw memberChangeError(result.reason);
  setResponseStatus(event, 204);
});
