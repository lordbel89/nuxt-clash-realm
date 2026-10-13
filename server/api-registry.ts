import type { GenericSchema } from 'valibot';
import { ListQuery } from '../shared/schemas/common.ts';
import {
  AddOrganizationMemberInput,
  CreateOrganizationInput,
  OrganizationIdParams,
  OrganizationMemberParams,
  UpdateOrganizationInput,
  UpdateOrganizationMemberInput,
} from '../shared/schemas/organization.ts';
import { CreateTournamentInput, TournamentIdParams, TournamentListQuery, UpdateTournamentInput } from '../shared/schemas/tournament.ts';
import { UserIdParams, UserListQuery } from '../shared/schemas/user.ts';

/**
 * Registro delle rotte: da qui `npm run api:spec` genera `docs/api/openapi.json`, il riferimento
 * che Marco consulta su `/_docs`.
 *
 * Una rotta nuova si scrive qui prima dell'handler, con `status: 'proposed'`: da quel momento
 * Marco può costruire il suo mock sul tipo vero. Quando arriva l'handler passa ad `available`.
 * `tests/backend/api-registry.test.ts` confronta il registro con i file di `server/api/` e fallisce
 * se divergono: una rotta senza voce, una voce senza rotta, schemi o tipo di risposta diversi.
 *
 * `/api/auth/**` resta fuori: è il territorio di Better Auth, con forma ed errori suoi.
 *
 * Gli import sono relativi e non `#shared/…`: il registro lo leggono anche script e test, che
 * girano con Node senza gli alias di Nuxt.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Ciclo di vita di un endpoint: proposto (tipi e schemi pronti), disponibile (handler), deprecato. */
export type RouteStatus = 'proposed' | 'available' | 'deprecated';

/** Errori del dominio. 400 e 401 si deducono da input e accesso, quindi non si elencano. */
export type DomainErrorStatus = 403 | 404 | 409;

export interface RouteSpec {
  method: HttpMethod;
  /** Con i parametri nella forma di Nitro: `/api/users/:id` */
  path: string;
  /** Gruppo nel riferimento */
  tag: string;
  /** Una riga, in italiano */
  summary: string;
  description?: string;
  status: RouteStatus;
  /** `session`: senza sessione risponde 401. `public`: nessuna sessione richiesta. */
  access: 'session' | 'public';
  /** Gli stessi schemi che l'handler passa a `readParams`, `readQuery`, `readInput` */
  params?: GenericSchema;
  query?: GenericSchema;
  body?: GenericSchema;
  /**
   * Il tipo di risposta come espressione TypeScript sui nomi di `shared/types`: `Paginated<UserSummary>`.
   * `void` vuol dire `204` senza corpo.
   */
  response: string;
  /** Quando ciascun errore del dominio può capitare */
  errors?: Partial<Record<DomainErrorStatus, string>>;
}

export const routes: RouteSpec[] = [
  {
    method: 'GET',
    path: '/api/users',
    tag: 'Utenti',
    summary: 'Rubrica degli utenti registrati',
    description: 'Solo id e nome, per cercare qualcuno da aggiungere a un\'organizzazione. `search` trova il nome per sottostringa e l\'email solo se scritta per intero. I dati privati stanno su `/api/users/me`.',
    status: 'available',
    access: 'session',
    query: UserListQuery,
    response: 'Paginated<UserSummary>',
  },
  {
    method: 'GET',
    path: '/api/users/:id',
    tag: 'Utenti',
    summary: 'Un utente della rubrica',
    description: 'Nessun dato privato, nemmeno per il proprio id.',
    status: 'available',
    access: 'session',
    params: UserIdParams,
    response: 'UserSummary',
    errors: { 404: 'Nessun utente con questo id' },
  },
  {
    method: 'GET',
    path: '/api/users/me',
    tag: 'Utenti',
    summary: 'Il proprio account',
    description: 'L\'identità arriva solo dalla sessione.',
    status: 'available',
    access: 'session',
    response: 'User',
    errors: { 404: 'L\'utente della sessione non esiste più' },
  },
  {
    method: 'GET',
    path: '/api/organizations',
    tag: 'Organizzazioni',
    summary: 'Le proprie organizzazioni',
    description: 'Quelle di cui chi chiama è membro, ciascuna con il suo ruolo (`myRole`).',
    status: 'available',
    access: 'session',
    query: ListQuery,
    response: 'Paginated<Organization>',
  },
  {
    method: 'POST',
    path: '/api/organizations',
    tag: 'Organizzazioni',
    summary: 'Crea un\'organizzazione',
    description: 'Qualunque utente può crearne una, e ne diventa owner. Lo slug si calcola dal nome (`Negozio Rossi` → `negozio-rossi`, poi `negozio-rossi-2`…) e non cambia più.',
    status: 'available',
    access: 'session',
    body: CreateOrganizationInput,
    response: 'Organization',
  },
  {
    method: 'GET',
    path: '/api/organizations/:id',
    tag: 'Organizzazioni',
    summary: 'Un\'organizzazione',
    status: 'available',
    access: 'session',
    params: OrganizationIdParams,
    response: 'Organization',
    errors: { 404: 'L\'organizzazione non esiste, o chi chiama non ne è membro' },
  },
  {
    method: 'PATCH',
    path: '/api/organizations/:id',
    tag: 'Organizzazioni',
    summary: 'Rinomina un\'organizzazione',
    description: 'Owner e admin. Lo slug resta quello di prima.',
    status: 'available',
    access: 'session',
    params: OrganizationIdParams,
    body: UpdateOrganizationInput,
    response: 'Organization',
    errors: { 404: 'L\'organizzazione non esiste, o chi chiama non ne è membro' },
  },
  {
    method: 'GET',
    path: '/api/organizations/:id/members',
    tag: 'Organizzazioni',
    summary: 'I membri di un\'organizzazione',
    status: 'available',
    access: 'session',
    params: OrganizationIdParams,
    query: ListQuery,
    response: 'Paginated<OrganizationMember>',
    errors: { 404: 'L\'organizzazione non esiste, o chi chiama non ne è membro' },
  },
  {
    method: 'POST',
    path: '/api/organizations/:id/members',
    tag: 'Organizzazioni',
    summary: 'Aggiunge un membro',
    description: 'Un utente registrato, trovato con `GET /api/users?search=`. Un owner aggiunge owner e admin, un admin solo admin.',
    status: 'available',
    access: 'session',
    params: OrganizationIdParams,
    body: AddOrganizationMemberInput,
    response: 'OrganizationMember',
    errors: {
      403: 'Un admin prova ad aggiungere un owner',
      404: 'L\'organizzazione o l\'utente non esistono, o chi chiama non è membro',
      409: 'L\'utente è già membro',
    },
  },
  {
    method: 'PATCH',
    path: '/api/organizations/:id/members/:userId',
    tag: 'Organizzazioni',
    summary: 'Cambia il ruolo di un membro',
    description: 'Solo un owner. L\'ultimo owner non si può declassare.',
    status: 'available',
    access: 'session',
    params: OrganizationMemberParams,
    body: UpdateOrganizationMemberInput,
    response: 'OrganizationMember',
    errors: {
      403: 'Chi chiama è admin',
      404: 'L\'organizzazione non esiste, chi chiama non è membro, o l\'utente non è membro',
      409: 'Si declasserebbe l\'ultimo owner',
    },
  },
  {
    method: 'DELETE',
    path: '/api/organizations/:id/members/:userId',
    tag: 'Organizzazioni',
    summary: 'Toglie un membro, o esce',
    description: 'Con il proprio `userId` si esce dall\'organizzazione. Un owner toglie chiunque, un admin solo admin. L\'ultimo owner non esce.',
    status: 'available',
    access: 'session',
    params: OrganizationMemberParams,
    response: 'void',
    errors: {
      403: 'Un admin prova a togliere un owner',
      404: 'L\'organizzazione non esiste, chi chiama non è membro, o l\'utente non è membro',
      409: 'Uscirebbe l\'ultimo owner',
    },
  },
  {
    method: 'GET',
    path: '/api/tournaments',
    tag: 'Tornei',
    summary: 'Elenco dei tornei',
    description: 'Pubblico. Senza `organizationId`: i tornei pubblicati di tutte le organizzazioni. Con `organizationId`: quelli dell\'organizzazione, bozze comprese se chi chiama ne è membro. Dal più recente.',
    status: 'available',
    access: 'public',
    query: TournamentListQuery,
    response: 'Paginated<TournamentSummary>',
  },
  {
    method: 'POST',
    path: '/api/tournaments',
    tag: 'Tornei',
    summary: 'Crea un torneo',
    description: 'Owner e admin dell\'organizzazione. Nasce in bozza (`draft`), visibile solo all\'organizzazione. `startsAt` è l\'orario locale nel fuso del torneo (`2026-11-29T10:00`); `timezone` vale `Europe/Rome` se manca.',
    status: 'available',
    access: 'session',
    body: CreateTournamentInput,
    response: 'Tournament',
    errors: { 404: 'L\'organizzazione non esiste, o chi chiama non ne è membro' },
  },
  {
    method: 'GET',
    path: '/api/tournaments/:id',
    tag: 'Tornei',
    summary: 'Un torneo',
    description: 'Pubblico da `published` in poi; una bozza la vede solo l\'organizzazione.',
    status: 'available',
    access: 'public',
    params: TournamentIdParams,
    response: 'Tournament',
    errors: { 404: 'Il torneo non esiste, o è una bozza e chi chiama non è dell\'organizzazione' },
  },
  {
    method: 'PATCH',
    path: '/api/tournaments/:id',
    tag: 'Tornei',
    summary: 'Modifica un torneo',
    description: 'Owner e admin dell\'organizzazione. Un campo assente resta com\'è, `null` lo svuota. Cambiare solo `timezone` mantiene l\'orario locale di inizio.',
    status: 'available',
    access: 'session',
    params: TournamentIdParams,
    body: UpdateTournamentInput,
    response: 'Tournament',
    errors: {
      404: 'Il torneo non esiste, o chi chiama non è dell\'organizzazione',
      409: 'Il torneo è concluso o annullato',
    },
  },
];
