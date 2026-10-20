# Convenzioni dell'API

Il riferimento di Clash Realm: rotte, parametri, body, risposte ed errori. È generato dal registro
delle rotte (`server/api-registry.ts`) con `npm run api:spec`, e in sviluppo si consulta su
[`/_docs`](/_docs). I tipi da importare stanno in `shared/types/`, gli schemi d'ingresso in
`shared/schemas/`. Cosa cambia di volta in volta è in `docs/api/CHANGELOG.md`.

## Stato di una rotta

Ogni rotta dichiara uno stato (`x-status`):

- **proposto**: tipi e schemi esistono, l'handler no. Il mock si può scrivere sul tipo vero.
- **disponibile**: l'handler esiste ed è provato. Il mock si può spegnere.
- **deprecato**: esiste ancora, ma il changelog dice cosa usare al suo posto.

## Letture e atti

- Le letture sono `GET`. Gli elenchi rispondono `Paginated<T>` (`{ items, total, limit, offset }`),
  mai un array nudo; `limit` e `offset` arrivano in query.
- Gli atti del dominio sono `POST /api/<risorsa>/:id/<atto>` (`/api/rounds/:id/publish`), non un
  `PATCH` dello stato: ogni atto ha un nome proprio e le sue precondizioni.
- `PATCH` modifica i campi di una risorsa; `PUT` sostituisce un insieme intero (la composizione di un
  torneo, gli abbinamenti di un round).
- Dove un atto chiede una motivazione (override, annullamento, correzione), il body ha un campo
  `reason` obbligatorio, che finisce nello storico del torneo.

## Date e identificativi

- Le date viaggiano come stringhe ISO 8601 in UTC. Il fuso di un torneo è un campo a sé (`timezone`).
- Gli id sono UUID. Nei tipi TypeScript sono marchiati (`UserId`, `TournamentId`): sul filo sono
  stringhe.

## Avvisi

Un comando che avvisa ma non impedisce (rivincita, secondo bye, round oltre il limite, profilo di un
minore) risponde `200` con la busta `WithWarnings<T>`:

```json
{ "data": { }, "warnings": [{ "code": "pairing.rematch", "message": "Testo in italiano" }] }
```

`warnings` c'è sempre su queste rotte, vuoto se non ci sono avvisi. `code` è un valore di
`ApiWarningCode`: un'unione chiusa, che cresce con le rotte che avvisano.

## Errori

Ogni errore ha il corpo `ApiError`. Il testo per l'utente è in `message`, in italiano;
`statusMessage` è la reason phrase HTTP, in inglese, e non va mostrata.

| Stato | Quando |
|---|---|
| `400` | input non valido: `data` è un `ApiErrorData`, con i messaggi per campo (`fields`) e quelli che non appartengono a nessun campo (`messages`) |
| `401` | la rotta chiede una sessione e la richiesta non ne ha una valida |
| `403` | la sessione c'è, ma l'utente non ha il permesso per questo atto |
| `404` | la risorsa non esiste, o l'utente non la può vedere |
| `409` | lo stato della risorsa non consente l'atto («il round ha ancora risultati mancanti») |

Fanno eccezione le rotte di Better Auth (`/api/auth/**`), che hanno forma ed errori propri
(`{ code, message }`) e si usano attraverso il suo client.

## Sessione

Le rotte con il lucchetto chiedono il cookie di sessione di Better Auth, che il browser manda da sé
dopo il login (`POST /api/auth/sign-in/email`). Da `published` in poi un torneo ha anche letture
pubbliche, senza sessione: abbinamenti dei round pubblicati, cronometro, classifica.
