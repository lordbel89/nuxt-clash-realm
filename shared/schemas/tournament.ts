import type { OrganizationId, TournamentId } from '#shared/types/ids';
import * as v from 'valibot';
import { brandedUuid, ListQuery } from './common.ts';

/**
 * Contratti d'ingresso del torneo. Gli stessi schemi validano il form e il body.
 *
 * Gira anche nel browser, dove Temporal non c'è ancora: fuso e data si controllano con `Intl` e con
 * l'aritmetica dei giorni del mese, non con Temporal.
 */

export const DEFAULT_TIMEZONE = 'Europe/Rome';

/**
 * Un fuso IANA (`Europe/Rome`), riportato al nome canonico (`europe/rome` → `Europe/Rome`). Gli
 * offset fissi (`+01:00`) non valgono: non seguono l'ora legale, e un torneo alle 20 finirebbe alle
 * 19 o alle 21 per metà dell'anno.
 */
export const TimeZoneInput = v.pipe(
  v.string('Fuso orario richiesto'),
  v.trim(),
  v.check(id => !/^[+-]/.test(id), 'Indicare un fuso orario per nome, come Europe/Rome'),
  v.rawTransform(({ dataset, addIssue, NEVER }) => {
    try {
      return new Intl.DateTimeFormat('en', { timeZone: dataset.value }).resolvedOptions().timeZone;
    }
    catch {
      addIssue({ message: 'Fuso orario sconosciuto' });
      return NEVER;
    }
  }),
);

function dayExists(local: string) {
  const [year, month, day] = local.slice(0, 10).split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day;
}

/**
 * Data e ora locali nel fuso del torneo, senza fuso né secondi: `2026-11-29T10:00`. È il valore di
 * un campo `datetime-local`. La conversione in istante la fa il server, con il fuso del torneo.
 */
export const LocalDateTimeInput = v.pipe(
  v.string('Data e ora richieste'),
  v.trim(),
  v.isoDateTime('Usare il formato 2026-11-29T10:00'),
  v.transform(local => local.replace(' ', 'T')),
  v.check(dayExists, 'Questo giorno non esiste'),
);

/** Il testo vuoto di un campo facoltativo vale come assente. */
function optionalText(max: number, message: string) {
  return v.optional(v.nullable(v.pipe(
    v.string(message),
    v.trim(),
    v.maxLength(max, `Al massimo ${max} caratteri`),
    v.transform(text => text || null),
  )), null);
}

const TournamentName = v.pipe(
  v.string('Il nome è richiesto'),
  v.trim(),
  v.minLength(2, 'Il nome deve avere almeno due caratteri'),
  v.maxLength(120, 'Il nome può avere al massimo 120 caratteri'),
);

const Game = v.pipe(
  v.string('Il gioco è richiesto'),
  v.trim(),
  v.minLength(1, 'Il gioco è richiesto'),
  v.maxLength(80, 'Il gioco può avere al massimo 80 caratteri'),
);

export const TournamentLocationInput = v.object({
  name: v.pipe(
    v.string('Il nome del luogo è richiesto'),
    v.trim(),
    v.minLength(2, 'Il nome del luogo deve avere almeno due caratteri'),
    v.maxLength(120, 'Il nome del luogo può avere al massimo 120 caratteri'),
  ),
  position: optionalText(500, 'Posizione non valida'),
}, 'Luogo non valido');

const MaxParticipants = v.pipe(
  v.number('Indicare un numero di posti'),
  v.integer('Il numero di posti è un intero'),
  v.minValue(2, 'Servono almeno due posti'),
  v.maxValue(1024, 'Al massimo 1024 posti'),
);

/** I campi del torneo che l'organizzatore sceglie; `organizationId` solo alla creazione. */
const tournamentFields = {
  name: TournamentName,
  game: Game,
  description: optionalText(2000, 'Descrizione non valida'),
  timezone: v.optional(TimeZoneInput, DEFAULT_TIMEZONE),
  /** null = data non ancora fissata */
  startsAt: v.optional(v.nullable(LocalDateTimeInput), null),
  /** null = nessun limite */
  maxParticipants: v.optional(v.nullable(MaxParticipants), null),
  location: v.optional(v.nullable(TournamentLocationInput), null),
};

export const CreateTournamentInput = v.object({
  organizationId: brandedUuid<OrganizationId>(),
  ...tournamentFields,
}, 'Dati del torneo richiesti');

export type CreateTournamentInput = v.InferOutput<typeof CreateTournamentInput>;

/**
 * Modifica parziale: un campo assente resta com'è, `null` lo svuota. Cambiare solo il fuso
 * mantiene l'orario locale (le 10 restano le 10, nel fuso nuovo).
 */
export const UpdateTournamentInput = v.object({
  name: v.optional(TournamentName),
  game: v.optional(Game),
  description: v.optional(v.nullable(v.pipe(
    v.string('Descrizione non valida'),
    v.trim(),
    v.maxLength(2000, 'Al massimo 2000 caratteri'),
    v.transform(text => text || null),
  ))),
  timezone: v.optional(TimeZoneInput),
  startsAt: v.optional(v.nullable(LocalDateTimeInput)),
  maxParticipants: v.optional(v.nullable(MaxParticipants)),
  location: v.optional(v.nullable(TournamentLocationInput)),
}, 'Dati del torneo richiesti');

export type UpdateTournamentInput = v.InferOutput<typeof UpdateTournamentInput>;

export const TournamentIdParams = v.object({
  id: brandedUuid<TournamentId>(),
}, 'Identificativo del torneo richiesto');

export type TournamentIdParams = v.InferOutput<typeof TournamentIdParams>;

/**
 * Elenco dei tornei. Senza `organizationId`: quelli pubblici di tutte le organizzazioni. Con
 * `organizationId`: quelli dell'organizzazione, bozze comprese se chi chiama ne è membro.
 */
export const TournamentListQuery = v.object({
  ...ListQuery.entries,
  organizationId: v.optional(brandedUuid<OrganizationId>()),
}, 'Parametri di ricerca non validi');

export type TournamentListQuery = v.InferOutput<typeof TournamentListQuery>;
