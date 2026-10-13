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

PGlite è una connessione sola: i test [I] non vedono bug di lock o di concorrenza. Tutto ciò che
dipende dal comportamento transazionale sotto carico va provato in [C].
