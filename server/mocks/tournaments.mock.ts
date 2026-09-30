import type { Paginated } from '#shared/types/api';
import type { Match, Participant, Round, Tournament, TournamentStatus } from '#shared/types/tournament';
import { fakerIT as faker } from '@faker-js/faker';
import { defineMock } from './define.ts';

/**
 * Tornei finti: `server/api/tournaments/` non esiste ancora, queste rotte sono
 * l'unica cosa che risponde. Quando l'handler vero arriverà, `enabled: false`
 * qui sotto lo lascia passare: il file resta, ed è lo strumento con cui si
 * riproduce a comando uno stato che il database non ha.
 */

// Seed fisso: gli id sopravvivono ai riavvii del server, quindi i link a
// /tournaments/:id salvati nel browser continuano a funzionare.
faker.seed(20260913);

const GAMES = ['Magic: the Gathering', 'Warhammer 40.000', 'Blood Bowl', 'Catan'];
const STATUSES: TournamentStatus[] = ['draft', 'ready', 'running', 'paused', 'finished'];

function createParticipant(_: unknown, index: number): Participant {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    seed: index + 1,
  };
}

function createRound(number: number, participants: Participant[]): Round {
  const matches: Match[] = [];

  for (let i = 0; i + 1 < participants.length; i += 2) {
    matches.push({
      id: faker.string.uuid(),
      round: number,
      table: `Tavolo ${i / 2 + 1}`,
      status: 'pending',
      home: participants[i],
      away: participants[i + 1],
    });
  }

  return { number, label: `Round ${number}`, durationMinutes: 50, matches };
}

function createTournament(index: number): Tournament {
  const participants = Array.from({ length: faker.number.int({ min: 4, max: 12 }) }, createParticipant);

  // ponytail: `startDate` è omesso di proposito. Il tipo lo dichiara `Date`,
  // ma attraverso HTTP arriverebbe come stringa ISO (vedi `User.createdAt`):
  // è una decisione che spetta al contratto reale, non a un mock.
  return {
    id: faker.string.uuid(),
    name: `${faker.location.city()} Open`,
    game: GAMES[index % GAMES.length]!,
    isTeam: faker.datatype.boolean(),
    maxParticipants: 16,
    description: faker.lorem.sentence(),
    location: { name: faker.company.name() },
    status: STATUSES[index % STATUSES.length]!,
    participants,
    rounds: [createRound(1, participants)],
    currentRound: 1,
  };
}

const tournaments = Array.from({ length: 6 }, (_, index) => createTournament(index));

export default [
  defineMock<Paginated<Tournament>>({
    method: 'GET',
    path: '/api/tournaments',
    // A `false` la chiamata prosegue verso l'handler reale
    enabled: true,
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
    enabled: true,
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
