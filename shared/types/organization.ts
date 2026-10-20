import type { OrganizationId } from '#shared/types/ids';
import type { UserSummary } from '#shared/types/user';

/**
 * Ruoli di organizzazione: gli unici due, con pieno controllo sui tornei dell'organizzazione.
 * Solo un owner aggiunge o promuove un owner; l'ultimo owner non può uscire né essere declassato.
 */
export type OrganizationRole = 'owner' | 'admin';

/** Il minimo per nominare un'organizzazione: id, nome e slug (l'identificativo leggibile negli URL). */
export interface OrganizationSummary {
  id: OrganizationId;
  name: string;
  slug: string;
}

/** Un'organizzazione vista da un suo membro. */
export interface Organization extends OrganizationSummary {
  /** ISO 8601 */
  createdAt: string;
  /** Il ruolo di chi legge: le organizzazioni si leggono solo da membri */
  myRole: OrganizationRole;
}

export interface OrganizationMember {
  user: UserSummary;
  role: OrganizationRole;
  /** ISO 8601: quando è entrato nell'organizzazione */
  joinedAt: string;
}
