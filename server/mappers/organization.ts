import type { CreateOrganizationInput } from '#shared/schemas/organization';
import type { Organization, OrganizationMember, OrganizationRole, OrganizationSummary } from '#shared/types/organization';
import type { MemberRow, NewOrganizationRow, OrganizationRow } from '../database/schema/organizations.ts';
import { type UserSummarySource, toUserSummary } from './user.ts';

export type OrganizationSummarySource = Pick<OrganizationRow, 'id' | 'name' | 'slug'>;
export type OrganizationSource = Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'createdAt'>;
export type OrganizationMemberSource = Pick<MemberRow, 'role' | 'createdAt'> & { user: UserSummarySource; };

export function toOrganizationSummary(row: OrganizationSummarySource): OrganizationSummary {
  return { id: row.id, name: row.name, slug: row.slug };
}

/** `myRole` è il ruolo di chi legge: il servizio lo ricava dalla sua riga in `members`. */
export function toOrganization(row: OrganizationSource, myRole: OrganizationRole): Organization {
  return {
    ...toOrganizationSummary(row),
    createdAt: row.createdAt.toISOString(),
    myRole,
  };
}

export function toOrganizationMember(row: OrganizationMemberSource): OrganizationMember {
  return {
    user: toUserSummary(row.user),
    role: row.role,
    joinedAt: row.createdAt.toISOString(),
  };
}

/** Lo slug non arriva dal client: lo calcola il servizio dal nome, controllando quelli già presi. */
export function toNewOrganizationRow(input: CreateOrganizationInput, slug: string): NewOrganizationRow {
  return { name: input.name, slug };
}
