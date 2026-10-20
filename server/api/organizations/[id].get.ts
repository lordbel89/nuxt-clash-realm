import type { Organization } from '#shared/types/organization';
import { OrganizationIdParams } from '#shared/schemas/organization';
import { findOrganization } from '../../services/organizations.ts';

/** GET /api/organizations/:id — solo per i membri; per gli altri non esiste. */
export default defineEventHandler(async (event): Promise<Organization> => {
  const { id } = readParams(event, OrganizationIdParams);
  const { role } = await requireOrganizationRole(event, id, ANY_ORGANIZATION_ROLE);
  const organization = await findOrganization(await useDatabase(), id, role);
  if (!organization) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Organizzazione non trovata' });
  }
  return organization;
});
