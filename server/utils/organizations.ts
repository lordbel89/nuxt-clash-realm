import type { MemberChange } from '../services/organizations.ts';

type MemberChangeFailure = Extract<MemberChange, { ok: false; }>['reason'] | 'forbidden';

/** Il motivo per cui una modifica ai membri non si è fatta, tradotto nell'errore HTTP. */
export function memberChangeError(reason: MemberChangeFailure) {
  switch (reason) {
    case 'user_not_found':
      return createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Utente non trovato' });
    case 'not_member':
      return createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Questo utente non è membro dell\'organizzazione' });
    case 'already_member':
      return createError({ statusCode: 409, statusMessage: 'Conflict', message: 'Questo utente è già membro dell\'organizzazione' });
    case 'last_owner':
      return createError({ statusCode: 409, statusMessage: 'Conflict', message: 'L\'organizzazione deve avere almeno un owner' });
    case 'forbidden':
      return createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Un admin non può toccare un owner' });
  }
}
