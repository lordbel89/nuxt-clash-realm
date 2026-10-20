import type { UserId } from '#shared/types/ids';
import * as v from 'valibot';
import type { Database } from '../database/client.ts';
import { accounts } from '../database/schema/auth.ts';
import { users } from '../database/schema/users.ts';
import type { Auth } from './index.ts';

/**
 * Creazione di un account con email e password, senza l'endpoint di iscrizione.
 *
 * In v1 l'iscrizione pubblica è spenta (`disableSignUp`), e Better Auth applica il divieto dentro
 * l'endpoint: anche `auth.api.signUpEmail` chiamato dal server viene rifiutato. Gli account li
 * crea quindi chi gestisce la piattaforma, con `npm run user:create` (e il seed in sviluppo).
 *
 * Utente e account `credential` si scrivono in una transazione sola, con l'hasher di Better Auth:
 * lo stesso che verifica la password al login. Le regole sono quelle dell'endpoint di iscrizione
 * (email valida e minuscola, lunghezza della password configurata nella libreria).
 */

export interface NewAccount {
  email: string;
  name: string;
  password: string;
}

const AccountInput = v.object({
  email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email('Indirizzo email non valido')),
  name: v.pipe(v.string(), v.trim(), v.minLength(2, 'Il nome deve avere almeno due caratteri')),
  password: v.string(),
});

/** Errore di un dato fornito, con il messaggio da mostrare a chi lancia lo script. */
export class AccountError extends Error {}

export async function createAccount(db: Database, auth: Auth, input: NewAccount): Promise<UserId> {
  const parsed = v.safeParse(AccountInput, input);
  if (!parsed.success) throw new AccountError(parsed.issues.map(issue => issue.message).join('; '));

  const { email, name, password } = parsed.output;
  const { password: hasher } = await auth.$context;
  const { minPasswordLength, maxPasswordLength } = hasher.config;

  if (password.length < minPasswordLength || password.length > maxPasswordLength) {
    throw new AccountError(`La password deve avere fra ${minPasswordLength} e ${maxPasswordLength} caratteri`);
  }

  const existing = await db.query.users.findFirst({ where: { email: { eq: email } }, columns: { id: true } });
  if (existing) throw new AccountError(`Esiste già un utente con l'email ${email}`);

  const hash = await hasher.hash(password);

  return await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email, name }).returning({ id: users.id });

    await tx.insert(accounts).values({
      userId: user!.id,
      accountId: user!.id,
      providerId: 'credential',
      password: hash,
    });

    return user!.id;
  });
}
