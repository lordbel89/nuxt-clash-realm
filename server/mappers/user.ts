import type { User, UserSummary } from '#shared/types/user';
import type { UserRow } from '../database/schema/users.ts';

/** Proiezioni minime: nessun bisogno di caricare colonne amministrative. */
export type UserSummarySource = Pick<UserRow, 'id' | 'name'>;
export type UserSource = Pick<UserRow, 'id' | 'name' | 'email' | 'emailVerified' | 'isActive' | 'createdAt'>;

/** Allowlist della vista consultabile dagli altri utenti autenticati. */
export function toUserSummary(row: UserSummarySource): UserSummary {
  return { id: row.id, name: row.name };
}

/** Allowlist privata: il chiamante deve aver autorizzato la lettura. */
export function toUser(row: UserSource): User {
  return {
    ...toUserSummary(row),
    email: row.email,
    emailVerified: row.emailVerified,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}
