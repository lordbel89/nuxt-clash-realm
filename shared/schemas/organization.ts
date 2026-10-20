import type { OrganizationId, UserId } from '#shared/types/ids';
import * as v from 'valibot';
import { brandedUuid } from './common.ts';

/**
 * Contratti d'ingresso delle organizzazioni. Chi può fare cosa (owner, admin) lo decidono i
 * servizi: qui si valida solo la forma.
 */

export const OrganizationRoleInput = v.picklist(['owner', 'admin'], 'Il ruolo è owner o admin');

const OrganizationName = v.pipe(
  v.string('Il nome è richiesto'),
  v.trim(),
  v.minLength(2, 'Il nome deve avere almeno due caratteri'),
  v.maxLength(80, 'Il nome può avere al massimo 80 caratteri'),
);

export const CreateOrganizationInput = v.object({
  name: OrganizationName,
}, 'Dati dell\'organizzazione richiesti');

export type CreateOrganizationInput = v.InferOutput<typeof CreateOrganizationInput>;

/** Lo slug non cambia con il nome: gli URL già condivisi restano validi. */
export const UpdateOrganizationInput = v.object({
  name: OrganizationName,
}, 'Dati dell\'organizzazione richiesti');

export type UpdateOrganizationInput = v.InferOutput<typeof UpdateOrganizationInput>;

export const AddOrganizationMemberInput = v.object({
  userId: brandedUuid<UserId>(),
  role: OrganizationRoleInput,
}, 'Utente e ruolo richiesti');

export type AddOrganizationMemberInput = v.InferOutput<typeof AddOrganizationMemberInput>;

export const UpdateOrganizationMemberInput = v.object({
  role: OrganizationRoleInput,
}, 'Ruolo richiesto');

export type UpdateOrganizationMemberInput = v.InferOutput<typeof UpdateOrganizationMemberInput>;

export const OrganizationIdParams = v.object({
  id: brandedUuid<OrganizationId>(),
}, 'Identificativo dell\'organizzazione richiesto');

export type OrganizationIdParams = v.InferOutput<typeof OrganizationIdParams>;

export const OrganizationMemberParams = v.object({
  id: brandedUuid<OrganizationId>(),
  userId: brandedUuid<UserId>(),
}, 'Organizzazione e utente richiesti');

export type OrganizationMemberParams = v.InferOutput<typeof OrganizationMemberParams>;
