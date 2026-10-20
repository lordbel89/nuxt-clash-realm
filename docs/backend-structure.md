# Struttura backend consolidata

Questo documento descrive il codice attuale e aggiorna le convenzioni API utenti
precedenti di AGENTS.md e CLAUDE.md. Il brainstorm rimane una proposta di dominio.

## Contratti e autorizzazioni

Tutte le route utenti richiedono una sessione:

| Route | Risposta | Visibilità |
|---|---|---|
| GET /api/users | Paginated<UserSummary> | ID e nome degli utenti |
| GET /api/users/:id | UserSummary | ID e nome, anche per il proprio ID |
| GET /api/users/me | User | Account identificato dalla sessione |

La modifica di elenco e dettaglio è una restrizione intenzionale del contratto:
email, emailVerified, isActive e createdAt sono disponibili solo su /me.
Il consumer app/pages/hello.vue legge ancora email, createdAt e isActive dall'elenco:
il typecheck globale ne segnala l'incompatibilità. Il frontend non è stato modificato;
quel consumer dovrà usare la vista minima oppure /me per il proprio account.
Non esiste ancora un ruolo amministrativo: nessuna route ne simula i privilegi.
UserSummary non è un Player; l'identità sportiva non è ancora implementata.

## Organizzazioni

Tutte nostre: Better Auth gestisce solo account e login. `organizations` e `members` (ruolo `owner`
o `admin`, vincolo `CHECK`) sono scritte solo da `server/services/organizations.ts`, che contiene
anche le regole fra ruoli come funzioni pure (`canAssignRole`, `canChangeRole`, `canRemoveMember`).
Gli handler chiedono `requireOrganizationRole(event, id, roles)`: chi non è membro riceve 404, come se
l'organizzazione non esistesse. Le modifiche che possono togliere un owner bloccano la riga
dell'organizzazione (`FOR UPDATE`), così l'ultimo owner resta anche sotto modifiche simultanee.

## Tornei

Un torneo appartiene a un'organizzazione e nasce in bozza. La bozza la vedono solo i membri
dell'organizzazione (agli altri risponde 404); da `published` in poi le letture sono pubbliche e non
chiedono sessione (`findUserId`, non `requireUserId`). `startsAt` è un istante con il fuso in
`timezone`: in ingresso arriva come orario locale e lo converte il mapper (`fromLocal`), in uscita
c'è anche come `startsAtLocal`. Il `seed` (256 bit, crittografico) non esce mai sul filo. Le modifiche
passano dall'helper dei comandi (sotto).

## Comandi del torneo e storico

Ogni scrittura su un torneo esistente passa da `runTournamentCommand`
(`server/services/tournament-commands.ts`). La creazione no: prima del torneo non c'è una riga da
bloccare. L'helper apre una transazione e rilegge il torneo con `SELECT … FOR UPDATE`, quindi due
comandi sullo stesso torneo si serializzano e il secondo vede lo stato lasciato dal primo; per questo i
controlli di stato (un torneo concluso non si modifica) si fanno sulla riga che l'helper consegna e
non su una lettura fatta prima. Il comando riceve `{ tx, tournament, record, emit }`:

- `record({ entity, entityId, action, before, after })` aggiunge una voce a `history_entries`, scritta
  nella stessa transazione. Attore e motivazione vengono dal contesto del comando. Lo storico è solo
  aggiunta e registra anche le intenzioni che non cambiano lo stato (un risultato respinto);
- `emit(event)` fa `pg_notify` sul canale `tournament_events` (`server/realtime/events.ts`), con soli
  identificativi. Postgres consegna al commit; il notifier che ascolta è F0.9.

Un comando che lancia un errore annulla modifica, voci ed eventi. Un comando che ritorna fa commit
anche quando rifiuta l'atto con un esito, così un tentativo respinto lascia la sua voce; chi rifiuta
senza voler lasciare tracce non chiama `record`. L'ordine delle voci è `history_entries.id`, che dentro
un torneo segue l'ordine reale grazie al blocco; `at` è l'istante della transazione e le voci di uno
stesso comando lo condividono. Il ruolo Postgres con solo `INSERT` e `SELECT` sulla tabella è parte
del deploy (F0.11).

## Live: notifier e SSE

`server/realtime/notifier.ts` tiene una connessione in `LISTEN` per processo (`useNotifier()`, creato
alla prima richiesta e chiuso dal plugin `database` prima del database) e smista in memoria ai client
iscritti a un torneo. L'ascolto dipende dal driver (`listenSourceOf`): PGlite in sviluppo, postgres-js
in produzione, che apre una connessione sua e la riapre da solo. `LISTEN/NOTIFY` non conserva niente:
alla riconnessione il notifier manda `resync` a tutti e il flusso riparte da un nuovo `hello`.

`GET /api/tournaments/:id/stream` controlla la visibilità come la lettura del torneo, apre un
`createEventStream` e lo collega con `pipeTournamentEvents` (`server/realtime/stream.ts`): `hello` con
`now`, un messaggio per evento con i soli identificativi, `ping` ogni 30 secondi. h3 manda già
`X-Accel-Buffering: no` (per l'nginx di CapRover) e non scrive commenti SSE, quindi il keepalive è un
evento `ping`. Il permesso è controllato solo alla connessione. Un `nuxt dev` con più processi non
condivide gli eventi: in sviluppo (PGlite) c'è un processo solo, e in produzione Postgres li smista.

## Job: pg-boss

Esito della prova tecnica (F0.10, pg-boss 12.38): **funziona in entrambi gli ambienti, e un job accodato
in una transazione esiste solo se la transazione fa commit.** In v1 nessuna funzione lo usa, quindi il
plugin `server/plugins/jobs.ts` è spento (`NUXT_JOBS_ENABLED=false`); da F7 si accende.

- **Avvio.** `startBoss(db, { dialect, url })` (`server/jobs/boss.ts`), con `useBoss()` come singleton
  lazy. Applica da sé le migrazioni del suo schema `pgboss` nello stesso database (versione 46). Il
  plugin lo avvia all'accensione se i job sono abilitati; un avvio fallito si registra nel log e non
  ferma il server. `database.ts` lo ferma (`stop({ graceful: true })`) prima di chiudere il database:
  dopo un SIGTERM la sua riga in `pgboss.instance` ha `stopped_on`, dopo un SIGKILL no.
- **Produzione (Postgres).** pg-boss apre un pool suo (4 connessioni, `application_name =
  clash-realm-jobs`) con la stessa `NUXT_DATABASE_URL`: non esiste un adattatore per postgres-js. Provato
  col build vero (`node .output/server/index.mjs`) su Postgres 18: parte, risponde, si ferma in
  meno di un secondo senza connessioni residue. Pesa 1,2 MB nel bundle e PGlite resta fuori.
- **Sviluppo (PGlite).** pg-boss usa la stessa istanza di Drizzle tramite `fromPglite`, con
  `backend: 'pglite'`. Una connessione sola, quindi i worker girano uno alla volta.
- **Nella transazione.** `boss.send(queue, data, { db: fromDrizzle(tx, sql) })` funziona sia su PGlite sia
  su Postgres, anche se PGlite non è fra i driver che la documentazione elenca. Con rollback il job non
  esiste, e una modifica e il suo job vivono o muoiono insieme.
- **Trappola.** Senza `db: fromDrizzle(tx, sql)`, il job non segue la transazione. Su Postgres passa da
  un'altra connessione e **sopravvive al rollback**. Su PGlite aspetta la fine della transazione: con
  un `await` dentro la transazione non finisce più (deadlock), senza `await` termina dopo e il job
  esiste comunque. Dentro una transazione di Drizzle si accoda sempre con `fromDrizzle(tx, sql)`.
- **Tutto il resto** (ritentativi, cron, job differiti, code fallite) è F7.1. LISTEN/NOTIFY di pg-boss
  è spento: le code si interrogano a intervalli.

## Date e fusi orari

L'aritmetica di calendario passa da `server/utils/time.ts`, sopra Temporal: fuso del torneo valido
(`canonicalTimeZone`, solo nomi IANA), istante ↔ fuso (`inTimeZone`, `toDate`), orari locali con la
disambiguazione `compatible` (`fromLocal`, `atLocalTime`), giorni di calendario (`addLocalDays`: 23 o
25 ore nelle notti del cambio d'ora), scadenze a fine giornata come limite escluso (`endOfLocalDay`,
`deadlineAfterDays`). Il database parla `Date`; nessun `Date` fa aritmetica di calendario. Il modulo
non legge l'ora: chi ne ha bisogno la riceve come parametro.

## Responsabilità

- Gli handler leggono la sessione, validano input e traducono l'assenza in HTTP 404.
- server/services/users.ts contiene le letture con dipendenza Database esplicita,
  senza dipendenze HTTP. getOwnAccount riceve solo l'ID ricavato dalla sessione.
- I mapper sono funzioni pure con allowlist e sorgenti minime. Non fanno query,
  hashing, controlli di permesso o scritture. Un mapper non autorizza la lettura.
- Gli schemi condivisi validano il contratto e possono normalizzarlo. InferOutput
  descrive il dato dopo parsing; InferInput serve quando occorre il tipo precedente.
- I vincoli persistenti restano nel database. Le regole dipendenti da stato e
  autorizzazioni appartengono ai casi d'uso, non agli schemi condivisi.

Per i futuri comandi, il servizio coordinerà autorizzazioni e transazione; il
motore puro vivrà in server/engine quando esisterà un primo algoritmo.
Nessuna classe entità, repository generico o directory vuota è necessaria oggi.
Le operazioni su più righe non diventano mapper d'ingresso. Un ritorno NewRow
verifica la forma della riga, non che tutti i campi significativi siano utilizzati.

I DTO si compongono quando significato e visibilità coincidono; non è obbligatoria
una gerarchia unica di viste. Non si derivano i contratti pubblici dalle tabelle.

## Paginazione e validazione

Le query numeriche accettano stringhe di cifre decimali, entro i limiti dichiarati.
Stringhe vuote, esponenziali, esadecimali e parametri ripetuti vengono rifiutati.
L'assenza usa i default. Gli errori di schema conservano campi e messaggi di radice.
Gli errori di parsing HTTP del body restano responsabilità di h3.

L'elenco mantiene offset, ordinamento stabile e totale. Il totale è informativo:
le due query non condividono uno snapshot e possono osservare scritture concorrenti.
I futuri elenchi potranno usare cursori senza imporre un conteggio esatto universale.

## Verifica

Cinque livelli, tutti con `node --test` (Node 26 esegue i `.ts` senza flag). `npm run test`
lancia [M], [U] e [I], cioè quello che non chiede Docker né un server avviato.

| Livello | Cartella | Comando | Con cosa |
|---|---|---|---|
| [M] motore | `tests/engine/` | `npm run test:engine` | motore puro, fixture |
| [U] unitari | `tests/backend/` | `npm run test:backend` | nessun database, dipendenze simulate |
| [I] integrazione | `tests/integration/` | `npm run test:integration` | PGlite in memoria, un database per file |
| [C] concorrenza | `tests/concurrency/` | `npm run test:concurrency` | Postgres 18 in Docker (`compose.test.yml`) |
| [S] scenario | `tests/scenario/` | `npm run test:scenario` | `nuxt dev` su un PGlite nuovo, via HTTP |

Gli aiuti stanno in `tests/support/`:

- `createTestDatabase()` (`database.ts`): PGlite in memoria con le migrazioni applicate. Uno per
  file di test, chiuso con `closeDatabase(db)` in un `after`.
- `createTestPostgres()` (`postgres.ts`): un database nuovo, dal nome casuale, sul Postgres di
  `compose.test.yml` (porta 54329), con le migrazioni; `drop()` lo cancella. `npm run
  test:concurrency` avvia il container da sé; si spegne con `docker compose -f compose.test.yml down`.
- `startTestServer()` (`server.ts`): `nuxt dev --envName scenario` su una porta libera e su un
  PGlite nuovo in una cartella temporanea, con i mock spenti (`NUXT_MOCKS=false`). L'ambiente
  `scenario` ha una cartella di build sua (`node_modules/.cache/nuxt-scenario`), così i test non
  riscrivono `.nuxt/` sotto un dev server acceso; per lo stesso motivo i file [S] girano uno alla
  volta. Si usa `nuxt dev` e non il build di produzione perché quello esclude PGlite dal bundle.
  L'iscrizione pubblica è spenta: gli utenti dello scenario si passano in `startTestServer({ users })`
  e si creano prima dell'avvio; `signIn(server, email, password)` apre la sessione via HTTP.

PGlite è una connessione sola: i test [I] non vedono bug di lock o di concorrenza. Tutto ciò che
dipende dal comportamento transazionale sotto carico va provato in [C].
