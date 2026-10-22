import type { TournamentId, UserId } from '#shared/types/ids';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../database/client.ts';
import { historyEntries, type HistoryEntity } from '../database/schema/history.ts';
import { tournaments, type TournamentRow } from '../database/schema/tournaments.ts';
import { TOURNAMENT_CHANNEL, type TournamentEvent, type TournamentNotification } from '../realtime/events.ts';

/** La transazione di Drizzle: le letture d'appoggio girano sia fuori sia dentro una transazione. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Executor = Database | Transaction;

export interface TournamentCommandContext {
  tournamentId: TournamentId;
  /** Viene dalla sessione, mai dal body. */
  actorId: UserId;
  /** La motivazione che finisce in ogni voce del comando (override, annullamento, correzione). */
  reason?: string | null;
}

export interface HistoryRecord {
  entity: HistoryEntity;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}

export interface TournamentCommandScope {
  tx: Transaction;
  /** Il torneo com'è ora, riletto con la riga bloccata: i controlli di stato vanno fatti su questo. */
  tournament: TournamentRow;
  /** Aggiunge una voce di storico, scritta nella stessa transazione. Vale anche per un'intenzione che non cambia lo stato. */
  record: (entry: HistoryRecord) => void;
  /** Annuncia un evento ai client live. Parte solo al commit. */
  emit: (event: TournamentEvent) => void;
}

export class TournamentNotFoundError extends Error {
  readonly tournamentId: TournamentId;

  constructor(tournamentId: TournamentId) {
    super(`Torneo ${tournamentId} non trovato`);
    this.name = 'TournamentNotFoundError';
    this.tournamentId = tournamentId;
  }
}

/**
 * Ogni scrittura su un torneo passa da qui. Apre una transazione e blocca la riga del torneo
 * (`FOR UPDATE`): due comandi sullo stesso torneo si serializzano, e il secondo vede lo stato lasciato
 * dal primo. Poi, nella stessa transazione, scrive le voci di storico e fa `pg_notify`, che Postgres
 * consegna solo al commit.
 *
 * Il comando che lancia un errore annulla tutto: né modifica, né storico, né notifica. Il comando che
 * ritorna fa commit anche quando rifiuta l'atto con un esito, perché un tentativo respinto è una voce
 * di storico da conservare: chi rifiuta senza voler lasciare tracce non deve chiamare `record`.
 *
 * Lancia `TournamentNotFoundError` se il torneo non esiste.
 */
export async function runTournamentCommand<T>(
  db: Database,
  { tournamentId, actorId, reason = null }: TournamentCommandContext,
  command: (scope: TournamentCommandScope) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).for('update');
    if (!tournament) throw new TournamentNotFoundError(tournamentId);

    const records: HistoryRecord[] = [];
    const events: TournamentEvent[] = [];

    const result = await command({
      tx,
      tournament,
      record: entry => records.push(entry),
      emit: event => events.push(event),
    });

    if (records.length > 0) {
      await tx.insert(historyEntries).values(records.map(entry => ({
        tournamentId,
        entity: entry.entity,
        entityId: entry.entityId,
        action: entry.action,
        actorId,
        reason,
        before: entry.before ?? null,
        after: entry.after ?? null,
      })));
    }

    for (const event of events) {
      const notification: TournamentNotification = { tournamentId, event };
      await tx.execute(sql`SELECT pg_notify(${TOURNAMENT_CHANNEL}, ${JSON.stringify(notification)})`);
    }

    return result;
  });
}
