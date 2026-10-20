/**
 * Date e fusi orari, sopra Temporal (nativo in Node 26). Le regole sono quelle del brainstorm,
 * § Date e fusi orari:
 *
 * - ogni torneo ha il proprio fuso IANA (`Europe/Rome`), salvato accanto agli istanti, perché
 *   `timestamptz` conserva l'istante ma non il fuso con cui è stato scritto;
 * - ricorrenze, offset e «domani alla stessa ora» sono di calendario locale, non durate: sommare
 *   24 ore nella notte del cambio d'ora sbaglia di un'ora;
 * - le scadenze in giorni valgono fino a fine giornata nel fuso del torneo;
 * - un orario locale che non esiste (si salta un'ora) o che esiste due volte si risolve con la
 *   disambiguazione `compatible`: il primo va avanti, il secondo prende la prima occorrenza.
 *
 * Ai confini il database parla `Date` (le colonne `timestamptz`), qui dentro si ragiona in
 * `Temporal.ZonedDateTime`: `inTimeZone()` entra, `toDate()` esce. Nessun `Date` fa aritmetica di
 * calendario.
 *
 * Non c'è un `now()` qui: chi ha bisogno dell'ora la riceve come parametro, così i test la fissano.
 * Il motore non importa questo modulo: il tempo, se gli serve, gli arriva come input.
 */

const DISAMBIGUATION = 'compatible';

/**
 * Un fuso valido per un torneo: un nome IANA con le sue regole di ora legale (`Europe/Rome`, `UTC`).
 * Temporal accetta anche gli offset fissi (`+01:00`), che però non cambiano con l'ora legale:
 * un torneo ricorrente sbaglierebbe di un'ora metà dell'anno, quindi si rifiutano.
 */
export function canonicalTimeZone(id: string): string | null {
  if (/^[+-]/.test(id)) return null;

  try {
    // Il nome canonico corregge le maiuscole: `europe/rome` → `Europe/Rome`
    return new Temporal.ZonedDateTime(0n, id).timeZoneId;
  }
  catch {
    return null;
  }
}

export function isTimeZone(id: string) {
  return canonicalTimeZone(id) !== null;
}

/** Un istante del database (`Date`) visto nel fuso del torneo. */
export function inTimeZone(instant: Date | Temporal.Instant, timeZone: string): Temporal.ZonedDateTime {
  const value = instant instanceof Date ? Temporal.Instant.fromEpochMilliseconds(instant.getTime()) : instant;
  return value.toZonedDateTimeISO(timeZone);
}

/** Verso il database: le colonne `timestamptz` vogliono un `Date`. */
export function toDate(value: Temporal.ZonedDateTime | Temporal.Instant): Date {
  return new Date(value.epochMilliseconds);
}

/**
 * Un orario locale nel fuso del torneo: «il 29 novembre alle 10, a Roma». Se l'orario non esiste
 * (notte del passaggio all'ora legale) si sposta avanti; se esiste due volte prende la prima.
 */
export function fromLocal(local: Temporal.PlainDateTime | string, timeZone: string): Temporal.ZonedDateTime {
  return Temporal.PlainDateTime.from(local).toZonedDateTime(timeZone, { disambiguation: DISAMBIGUATION });
}

/** Un giorno locale a un'ora locale: «6 giorni prima, alle 10» è sempre alle 10. */
export function atLocalTime(date: Temporal.PlainDate | string, time: Temporal.PlainTime | string, timeZone: string): Temporal.ZonedDateTime {
  return fromLocal(Temporal.PlainDate.from(date).toPlainDateTime(time), timeZone);
}

/**
 * Giorni di calendario locale, avanti o indietro: stessa ora, giorno diverso. Fra le due date
 * possono passare 23 o 25 ore. È «domani alla stessa ora» (offerte, §5) e «ogni venerdì alle 20»
 * (ricorrenze, con 7).
 */
export function addLocalDays(instant: Date | Temporal.ZonedDateTime, days: number, timeZone: string): Temporal.ZonedDateTime {
  const zoned = instant instanceof Date ? inTimeZone(instant, timeZone) : instant.withTimeZone(timeZone);
  return zoned.add({ days });
}

/**
 * La fine del giorno locale in cui cade l'istante, come **limite escluso**: l'inizio del giorno
 * dopo. Una scadenza è rispettata se l'istante è strettamente prima. Il limite escluso evita le
 * 23:59:59.999, e l'inizio del giorno lo calcola Temporal: in qualche fuso il giorno comincia
 * all'01:00, perché la mezzanotte salta col cambio d'ora.
 */
export function endOfLocalDay(instant: Date | Temporal.ZonedDateTime, timeZone: string): Temporal.ZonedDateTime {
  const zoned = instant instanceof Date ? inTimeZone(instant, timeZone) : instant.withTimeZone(timeZone);
  return zoned.toPlainDate().add({ days: 1 }).toZonedDateTime(timeZone);
}

/**
 * «Entro N giorni», fino a fine giornata nel fuso del torneo (pubblicazione dei risultati entro
 * 7 giorni, §9): il limite escluso è l'inizio del giorno N+1 dopo quello dell'istante.
 */
export function deadlineAfterDays(instant: Date | Temporal.ZonedDateTime, days: number, timeZone: string): Temporal.ZonedDateTime {
  return endOfLocalDay(addLocalDays(instant, days, timeZone), timeZone);
}
