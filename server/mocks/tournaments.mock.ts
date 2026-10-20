import type { Paginated } from '#shared/types/api';
import type { OrganizationId, TournamentId } from '#shared/types/ids';
import type { Tournament, TournamentStatus, TournamentSummary } from '#shared/types/tournament';
import { fakerIT as faker } from '@faker-js/faker';
import { toLocalDateTime } from '../mappers/tournament.ts';
import { defineMock } from './define.ts';

/**
 * Tornei finti, uno per stato. Gli handler veri ci sono (F0.7), quindi il mock è spento:
 * riaccenderlo serve a riprodurre a comando uno stato che il database non ha. Copre solo i due
 * `GET`: `POST` e `PATCH` arrivano comunque agli handler, che questi id non li conoscono.
 */

// Seed fisso: gli id sopravvivono ai riavvii del server, quindi i link a
// /tournaments/:id salvati nel browser continuano a funzionare.
faker.seed(20260913);

const TIMEZONE = 'Europe/Rome';
const GAMES = ['Magic: the Gathering', 'Warhammer 40.000', 'Blood Bowl', 'Catan'];
const STATUSES: TournamentStatus[] = ['draft', 'published', 'registration_open', 'checkin_open', 'running', 'finished', 'cancelled'];

const organization = { id: faker.string.uuid() as OrganizationId, name: 'Negozio finto', slug: 'negozio-finto' };

function createTournament(status: TournamentStatus, index: number): Tournament {
  const startsAt = faker.date.soon({ days: 60 });
  startsAt.setUTCSeconds(0, 0);

  return {
    id: faker.string.uuid() as TournamentId,
    name: `${faker.location.city()} Open`,
    game: GAMES[index % GAMES.length]!,
    status,
    organization,
    timezone: TIMEZONE,
    startsAt: startsAt.toISOString(),
    startsAtLocal: toLocalDateTime(startsAt, TIMEZONE),
    description: faker.lorem.sentence(),
    maxParticipants: 16,
    location: { name: faker.company.name(), position: null },
    createdAt: faker.date.recent().toISOString(),
  };
}

const tournaments = STATUSES.map(createTournament);

export default [
  defineMock<Paginated<TournamentSummary>>({
    method: 'GET',
    path: '/api/tournaments',
    // A `false` la chiamata prosegue verso l'handler reale
    enabled: false,
    // Mezzo secondo di ritardo: senza, gli stati di caricamento non si vedono mai
    delay: 500,
    data: ({ query }) => {
      const limit = Number(query.limit ?? 25);
      const offset = Number(query.offset ?? 0);

      return {
        items: tournaments.slice(offset, offset + limit),
        total: tournaments.length,
        limit,
        offset,
      };
    },
  }),

  defineMock<Tournament>({
    method: 'GET',
    path: '/api/tournaments/:id',
    enabled: false,
    data: ({ params }) => {
      const tournament = tournaments.find(candidate => candidate.id === params.id);

      // Gli errori si simulano lanciandoli: la pagina riceve il 404 vero
      if (!tournament) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Not Found',
          message: 'Torneo non trovato',
        });
      }

      return tournament;
    },
  }),
];
