import type { ListQuery } from '#shared/schemas/common';
import type { AddOrganizationMemberInput, CreateOrganizationInput, UpdateOrganizationInput } from '#shared/schemas/organization';
import type { Paginated } from '#shared/types/api';
import type { OrganizationId, UserId } from '#shared/types/ids';
import type { Organization, OrganizationMember, OrganizationRole } from '#shared/types/organization';
import { and, eq, like, or, sql } from 'drizzle-orm';
import type { Database } from '../database/client.ts';
import { members, organizations } from '../database/schema/organizations.ts';
import { toNewOrganizationRow, toOrganization, toOrganizationMember } from '../mappers/organization.ts';

/**
 * Organizzazioni e membri. Tutto nostro: Better Auth gestisce solo account e login.
 *
 * Chi chiama ha già verificato che l'attore sia membro e il suo ruolo
 * (`requireOrganizationRole`); qui stanno le regole fra ruoli e le scritture.
 */

// Regole fra ruoli: funzioni pure, provate in tests/backend/organizations.test.ts

/** Solo un owner crea un altro owner; un admin aggiunge solo admin. */
export function canAssignRole(actorRole: OrganizationRole, role: OrganizationRole) {
  return actorRole === 'owner' || role === 'admin';
}

/** Cambiare un ruolo è sempre una promozione a owner o il declassamento di un owner: spetta a un owner. */
export function canChangeRole(actorRole: OrganizationRole) {
  return actorRole === 'owner';
}

/** Chiunque può uscire; un owner toglie chiunque; un admin toglie solo admin. */
export function canRemoveMember(actor: { userId: UserId; role: OrganizationRole; }, target: { userId: UserId; role: OrganizationRole; }) {
  return actor.userId === target.userId || actor.role === 'owner' || target.role === 'admin';
}

/** `Negozio Rossì & Figli` → `negozio-rossi-figli`. Vuoto se il nome non ha né lettere né cifre. */
export function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 48)
    .replace(/^-+|-+$/g, '');
}

/** Il primo slug libero fra `base`, `base-2`, `base-3`… */
export function firstFreeSlug(base: string, taken: ReadonlySet<string>) {
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/** La transazione di Drizzle: le funzioni d'appoggio girano sia fuori sia dentro una transazione. */
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Executor = Database | Transaction;

const UNIQUE_VIOLATION = '23505';
const SLUG_ATTEMPTS = 3;

function isUniqueViolation(error: unknown, constraint: string) {
  const cause = (error as { cause?: { code?: string; constraint_name?: string; constraint?: string; }; })?.cause;
  return cause?.code === UNIQUE_VIOLATION && (cause.constraint_name ?? cause.constraint) === constraint;
}

/** Il ruolo di un utente nell'organizzazione, o `null` se non ne è membro (o l'organizzazione non esiste). */
export async function findMemberRole(db: Database, organizationId: OrganizationId, userId: UserId): Promise<OrganizationRole | null> {
  const row = await db.query.members.findFirst({
    where: { organizationId: { eq: organizationId }, userId: { eq: userId } },
    columns: { role: true },
  });
  return row?.role ?? null;
}

/**
 * Chi crea un'organizzazione ne diventa owner. Lo slug si calcola dal nome; se due creazioni
 * con lo stesso nome si incrociano, una trova lo slug preso dal vincolo unico e riprova.
 */
export async function createOrganization(db: Database, actorId: UserId, input: CreateOrganizationInput): Promise<Organization> {
  const base = slugify(input.name) || 'organizzazione';

  for (let attempt = 1; ; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const taken = await tx.select({ slug: organizations.slug }).from(organizations)
          .where(or(eq(organizations.slug, base), like(organizations.slug, `${base}-%`)));
        const slug = firstFreeSlug(base, new Set(taken.map(row => row.slug)));

        const [organization] = await tx.insert(organizations).values(toNewOrganizationRow(input, slug)).returning();
        await tx.insert(members).values({ organizationId: organization!.id, userId: actorId, role: 'owner' });

        return toOrganization(organization!, 'owner');
      });
    }
    catch (error) {
      if (attempt < SLUG_ATTEMPTS && isUniqueViolation(error, 'organizations_slug_key')) continue;
      throw error;
    }
  }
}

/** Le organizzazioni di cui l'attore è membro, nell'ordine in cui ci è entrato. */
export async function listOwnOrganizations(db: Database, actorId: UserId, { limit, offset }: ListQuery): Promise<Paginated<Organization>> {
  const [rows, total] = await Promise.all([
    db.query.members.findMany({
      where: { userId: { eq: actorId } },
      columns: { role: true },
      with: { organization: { columns: { id: true, name: true, slug: true, createdAt: true } } },
      orderBy: { createdAt: 'asc', id: 'asc' },
      limit,
      offset,
    }),
    db.$count(members, eq(members.userId, actorId)),
  ]);

  return { items: rows.map(row => toOrganization(row.organization, row.role)), total, limit, offset };
}

export async function findOrganization(db: Database, id: OrganizationId, myRole: OrganizationRole): Promise<Organization | null> {
  const row = await db.query.organizations.findFirst({
    where: { id: { eq: id } },
    columns: { id: true, name: true, slug: true, createdAt: true },
  });
  return row ? toOrganization(row, myRole) : null;
}

/** Cambia il nome, non lo slug: gli URL già condivisi restano validi. */
export async function updateOrganization(db: Database, id: OrganizationId, myRole: OrganizationRole, input: UpdateOrganizationInput): Promise<Organization | null> {
  const [row] = await db.update(organizations).set({ name: input.name }).where(eq(organizations.id, id)).returning();
  return row ? toOrganization(row, myRole) : null;
}

export async function listMembers(db: Database, id: OrganizationId, { limit, offset }: ListQuery): Promise<Paginated<OrganizationMember>> {
  const [rows, total] = await Promise.all([
    db.query.members.findMany({
      where: { organizationId: { eq: id } },
      columns: { role: true, createdAt: true },
      with: { user: { columns: { id: true, name: true } } },
      orderBy: { createdAt: 'asc', id: 'asc' },
      limit,
      offset,
    }),
    db.$count(members, eq(members.organizationId, id)),
  ]);

  return { items: rows.map(toOrganizationMember), total, limit, offset };
}

/** Esito di una modifica ai membri: il membro risultante, o il motivo per cui non si è fatta. */
export type MemberChange
  = | { ok: true; member: OrganizationMember; }
    | { ok: false; reason: 'user_not_found' | 'already_member' | 'not_member' | 'last_owner'; };

async function readMember(db: Executor, organizationId: OrganizationId, userId: UserId) {
  return await db.query.members.findFirst({
    where: { organizationId: { eq: organizationId }, userId: { eq: userId } },
    columns: { role: true, createdAt: true },
    with: { user: { columns: { id: true, name: true } } },
  });
}

/** Il permesso sul ruolo (`canAssignRole`) lo controlla chi chiama, che conosce il ruolo dell'attore. */
export async function addMember(db: Database, id: OrganizationId, input: AddOrganizationMemberInput): Promise<MemberChange> {
  const user = await db.query.users.findFirst({ where: { id: { eq: input.userId } }, columns: { id: true } });
  if (!user) return { ok: false, reason: 'user_not_found' };

  try {
    await db.insert(members).values({ organizationId: id, userId: input.userId, role: input.role });
  }
  catch (error) {
    if (isUniqueViolation(error, 'members_organization_user_unique')) return { ok: false, reason: 'already_member' };
    throw error;
  }

  return { ok: true, member: toOrganizationMember((await readMember(db, id, input.userId))!) };
}

/**
 * Le modifiche che possono togliere un owner bloccano la riga dell'organizzazione: due owner che
 * si declassano a vicenda nello stesso istante si serializzano, e il secondo trova l'ultimo owner.
 */
async function lockOrganization(tx: Executor, id: OrganizationId) {
  await tx.execute(sql`SELECT 1 FROM ${organizations} WHERE ${organizations.id} = ${id} FOR UPDATE`);
}

async function otherOwners(tx: Executor, id: OrganizationId, userId: UserId) {
  return await tx.$count(members, and(eq(members.organizationId, id), eq(members.role, 'owner'), sql`${members.userId} <> ${userId}`));
}

/** Solo un owner arriva qui (`canChangeRole`). Declassare l'ultimo owner non si può. */
export async function updateMemberRole(db: Database, id: OrganizationId, userId: UserId, role: OrganizationRole): Promise<MemberChange> {
  return await db.transaction(async (tx) => {
    await lockOrganization(tx, id);

    const current = await tx.query.members.findFirst({
      where: { organizationId: { eq: id }, userId: { eq: userId } },
      columns: { role: true },
    });
    if (!current) return { ok: false, reason: 'not_member' } as const;

    if (current.role === 'owner' && role !== 'owner' && await otherOwners(tx, id, userId) === 0) {
      return { ok: false, reason: 'last_owner' } as const;
    }

    await tx.update(members).set({ role }).where(and(eq(members.organizationId, id), eq(members.userId, userId)));

    return { ok: true, member: toOrganizationMember((await readMember(tx, id, userId))!) } as const;
  });
}

/**
 * Il permesso dipende dal ruolo del membro da togliere, quindi si controlla qui, dopo il lock:
 * fra il controllo e la cancellazione il ruolo non può cambiare. L'ultimo owner non esce.
 */
export async function removeMember(
  db: Database,
  id: OrganizationId,
  actor: { userId: UserId; role: OrganizationRole; },
  userId: UserId,
): Promise<{ ok: true; } | { ok: false; reason: 'not_member' | 'forbidden' | 'last_owner'; }> {
  return await db.transaction(async (tx) => {
    await lockOrganization(tx, id);

    const target = await tx.query.members.findFirst({
      where: { organizationId: { eq: id }, userId: { eq: userId } },
      columns: { userId: true, role: true },
    });
    if (!target) return { ok: false, reason: 'not_member' } as const;
    if (!canRemoveMember(actor, target)) return { ok: false, reason: 'forbidden' } as const;

    if (target.role === 'owner' && await otherOwners(tx, id, userId) === 0) {
      return { ok: false, reason: 'last_owner' } as const;
    }

    await tx.delete(members).where(and(eq(members.organizationId, id), eq(members.userId, userId)));

    return { ok: true } as const;
  });
}
