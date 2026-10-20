import type { Organization } from '#shared/types/organization';
import { OrganizationIdParams, UpdateOrganizationInput } from '#shared/schemas/organization';
import { updateOrganization } from '../../services/organizations.ts';

/** PATCH /api/organizations/:id — owner e admin cambiano il nome; lo slug resta. */
export default defineEventHandler(async (event): Promise<Organization> => {
  const { id } = readParams(event, OrganizationIdParams);
  const { role } = await requireOrganizationRole(event, id, ANY_ORGANIZATION_ROLE);
  const input = await readInput(event, UpdateOrganizationInput);
  const organization = await updateOrganization(await useDatabase(), id, role, input);
  if (!organization) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Organizzazione non trovata' });
  }
  return organization;
});
