import { randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { CreateTournamentInput, TournamentListQuery, UpdateTournamentInput } from '#shared/schemas/tournament';
import type { Paginated } from '#shared/types/api';
import type { OrganizationId, TournamentId, UserId } from '#shared/types/ids';
import type { Tournament, TournamentStatus, TournamentSummary } from '#shared/types/tournament';
import { and, eq, ne } from 'drizzle-orm';
import type { Database } from '../database/client.ts';
import { tournaments, type TournamentRow } from '../database/schema/tournaments.ts';
import {
  TOURNAMENT_COLUMNS,
  TOURNAMENT_SUMMARY_COLUMNS,
  toNewTournamentRow,
  toTournament,
  toTournamentSummary,
  toTournamentUpdate,
} from '../mappers/tournament.ts';
import { findMemberRole } from './organizations.ts';
import { runTournamentCommand, TournamentNotFoundError, type Executor } from './tournament-commands.ts';

/**
 * Tornei. Visibilità (brainstorm, ciclo di vita): una bozza la vede solo l'organizzazione; da
 * `published` in poi il torneo è pubblico e si legge anche senza sessione.
 *
 * Chi può creare e modificare lo controlla chi chiama (`requireOrganizationRole`); la matrice
 * dei permessi completa arriva in F2.1.
 */

const ORGANIZATION_COLUMNS = { id: true, name: true, slug: true } as const;

/** Stati in cui il torneo non si modifica più. */
const CLOSED: readonly TournamentStatus[] = ['finished', 'cancelled'];

/** 256 bit da un generatore crittografico: il motore ne deriva i sorteggi del torneo. */
export function generateSeed() {
  return randomBytes(32).toString('hex');
}

async function isMember(db: Database, organizationId: OrganizationId, viewerId: UserId | null) {
  return viewerId !== null && await findMemberRole(db, organizationId, viewerId) !== null;
}

async function readTournament(db: Executor, id: TournamentId) {
  return await db.query.tournaments.findFirst({
    where: { id: { eq: id } },
    columns: { ...TOURNAMENT_COLUMNS, organizationId: true },
    with: { organization: { columns: ORGANIZATION_COLUMNS } },
  });
}

/** Il permesso (owner o admin dell'organizzazione) lo controlla chi chiama. */
export async function createTournament(db: Database, actorId: UserId, input: CreateTournamentInput): Promise<Tournament> {
  const [row] = await db.insert(tournaments).values(toNewTournamentRow(input, actorId, generateSeed())).returning({ id: tournaments.id });
  return toTournament((await readTournament(db, row!.id))!);
}

/**
 * Senza `organizationId`: i tornei pubblici di tutte le organizzazioni. Con `organizationId`:
 * quelli dell'organizzazione, bozze comprese solo se chi guarda ne è membro.
 */
export async function listTournaments(db: Database, viewerId: UserId | null, { limit, offset, organizationId }: TournamentListQuery): Promise<Paginated<TournamentSummary>> {
  const withDrafts = organizationId !== undefined && await isMember(db, organizationId, viewerId);

  const [rows, total] = await Promise.all([
    db.query.tournaments.findMany({
      where: {
        ...(organizationId !== undefined && { organizationId: { eq: organizationId } }),
        ...(!withDrafts && { status: { ne: 'draft' } }),
      },
      columns: TOURNAMENT_SUMMARY_COLUMNS,
      with: { organization: { columns: ORGANIZATION_COLUMNS } },
      orderBy: { createdAt: 'desc', id: 'desc' },
      limit,
      offset,
    }),
    db.$count(tournaments, and(
      organizationId !== undefined ? eq(tournaments.organizationId, organizationId) : undefined,
      withDrafts ? undefined : ne(tournaments.status, 'draft'),
    )),
  ]);

  return { items: rows.map(toTournamentSummary), total, limit, offset };
}

/** Il torneo, o `null` se non esiste o se è una bozza e chi guarda non è dell'organizzazione. */
export async function findVisibleTournament(db: Database, id: TournamentId, viewerId: UserId | null): Promise<Tournament | null> {
  const row = await readTournament(db, id);
  if (!row) return null;
  if (row.status === 'draft' && !await isMember(db, row.organizationId, viewerId)) return null;
  return toTournament(row);
}

/** L'organizzazione del torneo, per controllare il ruolo di chi lo modifica. */
export async function findTournamentOrganization(db: Database, id: TournamentId): Promise<OrganizationId | null> {
  const row = await db.query.tournaments.findFirst({ where: { id: { eq: id } }, columns: { organizationId: true } });
  return row?.organizationId ?? null;
}

export type TournamentUpdate = { ok: true; tournament: Tournament; } | { ok: false; reason: 'not_found' | 'closed'; };

/**
 * Un torneo concluso o annullato non si modifica più. Lo stato si controlla con la riga bloccata
 * dall'helper dei comandi, e lo storico porta solo i campi che cambiano davvero: una modifica che
 * non cambia niente non lascia voci.
 */
export async function updateTournament(db: Database, id: TournamentId, actorId: UserId, input: UpdateTournamentInput): Promise<TournamentUpdate> {
  try {
    return await runTournamentCommand(db, { tournamentId: id, actorId }, async ({ tx, tournament, record, emit }) => {
      if (CLOSED.includes(tournament.status)) return { ok: false, reason: 'closed' } as const;

      const changes = Object.entries(toTournamentUpdate(input, tournament))
        .filter(([column, value]) => !isDeepStrictEqual(value, tournament[column as keyof TournamentRow]));

      if (changes.length > 0) {
        await tx.update(tournaments).set(Object.fromEntries(changes)).where(eq(tournaments.id, id));
        record({
          entity: 'tournament',
          entityId: id,
          action: 'updated',
          before: Object.fromEntries(changes.map(([column]) => [column, tournament[column as keyof TournamentRow]])),
          after: Object.fromEntries(changes),
        });
        emit({ type: 'tournament.updated' });
      }

      return { ok: true, tournament: toTournament((await readTournament(tx, id))!) } as const;
    });
  }
  catch (error) {
    if (error instanceof TournamentNotFoundError) return { ok: false, reason: 'not_found' };
    throw error;
  }
}
