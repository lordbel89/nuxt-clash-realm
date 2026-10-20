import type { Organization } from '#shared/types/organization';
import { CreateOrganizationInput } from '#shared/schemas/organization';
import { createOrganization } from '../services/organizations.ts';

/** POST /api/organizations — qualunque utente crea un'organizzazione e ne diventa owner. */
export default defineEventHandler(async (event): Promise<Organization> => {
  const actorId = await requireUserId(event);
  const input = await readInput(event, CreateOrganizationInput);
  return createOrganization(await useDatabase(), actorId, input);
});
