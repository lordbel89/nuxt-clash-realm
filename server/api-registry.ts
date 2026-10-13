import type { GenericSchema } from 'valibot';
import { ListQuery } from '../shared/schemas/common.ts';
import { UserIdParams } from '../shared/schemas/user.ts';

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
  /** Il tipo di risposta come espressione TypeScript sui nomi di `shared/types`: `Paginated<UserSummary>` */
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
    description: 'Solo id e nome, per cercare qualcuno da aggiungere. I dati privati stanno su `/api/users/me`.',
    status: 'available',
    access: 'session',
    query: ListQuery,
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
];
