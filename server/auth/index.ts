import type { UserId } from '#shared/types/ids';
import type { Database } from '../database/client.ts';
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { accounts, sessions, users, verifications } from '../database/schema/index.ts';

/**
 * Istanza di Better Auth.
 *
 * Perimetro dichiarato: tutto ciò che sta sotto `/api/auth/**` è territorio di
 * Better Auth — validazione, forma della risposta ed errori (`{ code, message }`)
 * sono suoi, non passano da `readInput` e non hanno la forma di `ApiErrorData`.
 * Il resto dell'API resta il nostro contratto. L'unico punto di contatto fra i
 * due mondi è `server/utils/auth.ts`.
 */

export interface AuthOptions {
  /** Firma i cookie di sessione: cambiarlo invalida tutte le sessioni attive */
  secret: string;
  /** Origine dell'applicazione, es. http://localhost:3000 */
  url: string;
}

/** Sospensione attiva: `bannedUntil` null significa a tempo indeterminato. */
function isBanned(row: { bannedAt: Date | null; bannedUntil: Date | null; }) {
  if (!row.bannedAt) return false;

  return !row.bannedUntil || row.bannedUntil.getTime() > Date.now();
}

export function createAuth(db: Database, options: AuthOptions) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.url || undefined,
    basePath: '/api/auth',

    database: drizzleAdapter(db, {
      provider: 'pg',
      // Le nostre tabelle sono al plurale: senza questo Better Auth cerca
      // `user`, `session`, `account`, `verification` al singolare
      usePlural: true,
      // Passato esplicitamente: il client è costruito con `relations`, non con
      // `schema`, quindi l'adapter non ha da dove dedurre le tabelle
      schema: { users, sessions, accounts, verifications },
    }),

    advanced: {
      database: {
        // I nostri id sono uuid, non stringhe opache
        generateId: 'uuid',
      },
    },

    emailAndPassword: {
      enabled: true,
      // Nessun mailer, quindi nessun link da spedire: si riaccende insieme a
      // `sendVerificationEmail` quando ci sarà
      requireEmailVerification: false,
    },

    session: {
      /**
       * Cache di sessione nel cookie spenta di proposito. Con la cache attiva
       * il server si fida del cookie e non interroga il database: un utente
       * sospeso continuerebbe a navigare fino alla scadenza della cache.
       * Riaccenderla solo accettando quella finestra.
       */
      cookieCache: { enabled: false },
    },

    databaseHooks: {
      session: {
        create: {
          /**
           * Unico punto di applicazione della sospensione: qualunque metodo di
           * login (email, in futuro OAuth o secondo fattore) passa di qui per
           * creare la sessione.
           *
           * Attenzione: questo blocca i login futuri, non le sessioni già
           * aperte. Chi sospende un utente deve anche revocarle:
           * `auth.api.revokeUserSessions({ body: { userId } })`.
           */
          before: async (session) => {
            const row = await db.query.users.findFirst({
              // Colonna con tipo oggetto (il marchio): niente scorciatoia `{ id }`
              where: { id: { eq: session.userId as UserId } },
              columns: { isActive: true, bannedAt: true, banReason: true, bannedUntil: true },
            });

            if (!row) return;

            if (!row.isActive) {
              throw new APIError('FORBIDDEN', { message: 'Account disattivato' });
            }

            if (isBanned(row)) {
              throw new APIError('FORBIDDEN', {
                message: row.banReason
                  ? `Account sospeso: ${row.banReason}`
                  : 'Account sospeso',
              });
            }
          },
        },
      },
    },

    // Nessuna telemetria verso l'esterno
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
