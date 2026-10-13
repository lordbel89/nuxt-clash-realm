# Piano di implementazione del backend

Il percorso per portare backend e motore da dove sono oggi (utenti, sessioni e ban) a un sistema che
gestisce tutto via API: organizzazioni, tornei, giocatori, composizione, iscrizioni, abbinamenti,
risultati, classifiche, fasi, e poi l'ecosistema (circuiti, crediti, leghe, rating). Prima la v1,
poi tutto il resto, nell'ordine del §11 di [`brainstorm.md`](brainstorm.md).

Il dominio è in [`brainstorm.md`](brainstorm.md) e [`glossario.md`](glossario.md), che restano la
fonte di verità: questo piano non decide regole nuove. Dove una regola manca, lo dice e apre uno step
di brainstorm. Le scelte tecniche che il brainstorm non fissa sono segnate come **proposta** e si
confermano nello step che le implementa.

Il piano non ha date: conta l'ordine. Le milestone M0–M3 del §11 restano come raggruppamento.

---

## Come si legge

- **Fasi** `F0`…`F19`, **step** `F3.6`. Uno step è atomico: un pezzo che si chiude da solo, con i
  suoi test verdi, senza lasciare il sistema a metà. Di regola sta in una sessione di lavoro.
- Ogni step dice **cosa** fa, **come si testa** e quando è **fatto**.
- Livelli di test (dettagli nella sezione *Test*):
  - **[M]** motore, puro, con fixture;
  - **[U]** unitari del backend senza database (come i test di oggi);
  - **[I]** integrazione dei servizi su PGlite in memoria;
  - **[C]** concorrenza su Postgres vero in Docker;
  - **[S]** scenario via HTTP contro il server avviato.
- **[contratto]**: lo step cambia `shared/`, quindi cambia il contratto di Marco (vedi *Contratto con
  il frontend*).
- **[brainstorm]**: lo step è un argomento di progettazione da chiudere con il metodo solito (ricerca →
  domande → decisioni) **prima** di implementare. Gli step che seguono restano a grana grossa finché
  non è chiuso.

### Definizione di fatto, per ogni step

1. I test del livello indicato sono verdi, e lo sono anche tutti gli altri (`npm run test`).
2. `npx eslint .` è pulito.
3. Se lo step tocca `shared/`, `docs/api/openapi.json` è rigenerato e `docs/api/CHANGELOG.md` ha la
   sua voce.
4. Ogni comando che modifica un torneo passa dall'helper dei comandi (F0.8) e lascia la sua voce di
   storico.
5. Nomi dal glossario: identificatori in inglese, prosa e commenti in italiano.

---

## Dove si parte

Cosa c'è oggi nel codice:

| Pezzo | Stato |
|---|---|
| Better Auth, email e password, ban, sessioni | fatto |
| `users`, `sessions`, `accounts`, `verifications` | fatto, con migrazioni |
| `GET /api/users`, `/api/users/:id`, `/api/users/me` | fatto, con test [U] |
| `readInput` / `readParams` / `readQuery`, `ApiErrorData` | fatto |
| Plugin `organization`, pg-boss, SSE, deploy CapRover | **mancano: la M0 non è chiusa** |
| `server/engine/` | vuoto |
| `shared/types/tournament.ts` | modello provvisorio del frontend, servito solo dai mock |

Due cose da sapere prima di iniziare:

- **Node locale è la 24.15**, mentre `.nvmrc` chiede la 26, l'unica con `Temporal` nativo. Va
  sistemato per primo (F0.1).
- `docs/backend-structure.md` parla ancora del test runner di Node 24. Si aggiorna in F0.2.

---

## Architettura di arrivo

```
server/
  engine/            motore puro: nessun import da Nuxt, h3, Nitro, Drizzle, server/, shared/
    catalog/         dichiarazione dei moduli: parametri, limiti, scope, requires, conflicts
    math/            razionali su BigInt, arrotondamento dichiarato
    rng/             generatore seedato e mescolamento
    matching/        blossom pesato su BigInt
    results/         forme del risultato → esito normalizzato
    standings/       record, punti, applicazione della lista di tiebreak
    tiebreaks/       OMW%, GW%, OGW%… (moduli del catalogo)
    phases/          svizzera, eliminazione, gate, linearizzazione, eredità
    pairing/         pesi lessicografici, bye, tavoli, avvisi
    signature.ts     firma di generazione e verifica
    cli.ts           verifica di un round da riga di comando
    version.ts       ENGINE_VERSION
  services/          casi d'uso: permessi, transazione, storico, traduzione righe ↔ motore
  api/               handler: sessione, validazione, servizio, 404
  realtime/          notifier LISTEN/NOTIFY e fan-out SSE
  jobs/              pg-boss: code, worker, cron (dopo la v1)
  database/schema/   una tabella per file d'area
shared/
  types/             DTO
  schemas/           input Valibot
tests/
  engine/            [M]
  backend/           [U]
  integration/       [I]
  concurrency/       [C]
  scenario/          [S]
```

### Tre pezzi che reggono tutto il resto

**1. L'helper dei comandi del torneo** (F0.8). Ogni scrittura su un torneo passa da qui:

```ts
await runTournamentCommand(db, { tournamentId, actorId, reason }, async ({ tx, record, emit }) => {
  // legge e modifica dentro tx
  record({ entity: 'match', entityId, action: 'result_reported', before, after });
  emit({ type: 'match.updated', matchId });
});
```

- apre la transazione e blocca la riga del torneo (`SELECT … FOR UPDATE`), così i comandi su uno
  stesso torneo sono serializzati: due scorekeeper che refertano insieme non si pestano i piedi;
- scrive le voci di storico nella stessa transazione (§7, *Storico del torneo*);
- emette `pg_notify` nella stessa transazione. Postgres consegna la notifica solo al commit, quindi
  un comando fallito non notifica niente.

**2. I permessi** (F2.1). Sono una matrice pura `azione × ruolo → sì/no` più i controlli a livello
di match (il judge che gioca, §7). È una funzione testabile senza database. Il servizio carica i
ruoli dell'attore (owner e admin dell'organizzazione, ruoli di torneo) e chiede alla matrice.

**3. La traduzione righe ↔ motore** (F3.2). Il motore ha tipi propri, e il servizio traduce in due
direzioni: righe → input del motore, esito del motore → righe. Il motore non vede mai un DTO né una
riga.

### Convenzioni API (proposta, da fissare in F0.3)

- **Letture**: `GET`. Gli elenchi rispondono `Paginated<T>`.
- **Atti**: `POST /api/<risorsa>/:id/<atto>` (`/api/rounds/:id/publish`), non `PATCH` dello stato.
  Gli atti del dominio hanno nomi propri (`generate`, `publish`, `start`) e precondizioni.
- **Motivazione**: dove serve (override, annullamento, correzione), è un campo `reason` obbligatorio
  nel body.
- **Avvisi**: un comando che «avvisa ma non impedisce» (rivincita, secondo bye, round oltre il
  limite, profilo di un minore) risponde `200` con `warnings: ApiWarning[]`, dove ogni avviso ha un
  `code` stabile e un `message` in italiano. Va in `shared/types/api.ts`.
- **Errori**: `400` validazione (`ApiErrorData`), `401` senza sessione, `403` senza permesso, `404`,
  `409` per uno stato che non consente l'atto («il round ha ancora risultati mancanti»).
- **Visibilità**: un torneo in `draft` lo vede solo lo staff. Da `published` in poi le letture
  pubbliche (abbinamenti dei round pubblicati, cronometro, classifica dell'ultimo snapshot) non
  chiedono sessione: in v1 i giocatori non hanno account e guardano dal telefono.

---

## Contratto con il frontend

Marco costruisce l'interfaccia su `shared/` e sull'OpenAPI generato. L'argomento 14 aveva deciso
«nessun documento per il collega»; per le API quella scelta è riaperta: il riferimento ora si genera
dal codice, quindi non è un documento da tenere allineato a mano.

### Cosa riceve Marco

| Cosa | Dove | A cosa serve |
|---|---|---|
| Tipi delle risposte | `shared/types/*.ts` | li importa; `useFetch` inferisce già i tipi degli handler |
| Schemi d'ingresso | `shared/schemas/*.ts` | lo stesso schema valida il form (`UForm`) e il body |
| Riferimento navigabile | `/_docs` in sviluppo (Scalar) | rotte, parametri, body, risposte, errori, da provare dal browser |
| Specifica versionata | `docs/api/openapi.json` | il diff in git mostra cosa è cambiato nel contratto |
| Registro dei cambiamenti | `docs/api/CHANGELOG.md` | cosa è nuovo, cambiato o rotto, e quale seam `ponytail:` chiude |
| Dati di prova | `npm run scenario -- <nome>` | porta il database locale in uno stato preciso (F6.1) |

### Ciclo di vita di un endpoint

1. **Proposto.** Scrivo tipi e schemi in `shared/`, aggiungo la rotta al registro, rigenero
   l'OpenAPI e la voce del changelog dice `proposto`. Da qui Marco può scrivere il suo mock sul tipo
   vero.
2. **Disponibile.** Arriva l'handler con i suoi test. La voce passa a `disponibile`, e Marco spegne
   il mock (`enabled: false`) quando vuole.
3. **Cambiato** o **deprecato.** Una voce nuova che dice cosa si rompe e cosa fare.

I mock restano di Marco: io non li tocco. Un handler vero non serve finché il suo mock è acceso
(`server/middleware/mocks.ts` risponde prima), e il changelog serve proprio a dirgli quando può
spegnerlo.

### Come si genera l'OpenAPI (F0.3)

**Proposta**, da verificare con uno spike:

- un **registro delle rotte** (`server/api-registry.ts`) dichiara per ogni rotta metodo, percorso,
  schemi Valibot di parametri, query e body, nome del tipo di risposta, errori possibili, una riga di
  descrizione;
- uno script (`npm run api:spec`) produce `docs/api/openapi.json`. Gli schemi d'ingresso li converte
  `@valibot/to-json-schema` (le `transform`, come `brandedUuid`, vanno ignorate o mappate), quelli di
  risposta `ts-json-schema-generator` dai tipi di `shared/types` (i tipi marchiati vanno ridotti a
  `string`);
- una rotta solo di sviluppo (`server/routes/_docs.ts`) serve Scalar su quel file;
- un test [U] confronta il registro con i file in `server/api/`: una rotta senza voce, o una voce
  senza rotta, fa fallire la suite. L'OpenAPI non può restare indietro senza che qualcuno se ne
  accorga.

Alternativa, se la conversione dei tipi costa troppo: l'OpenAPI integrato di Nitro
(`nitro.experimental.openAPI`, `defineRouteMeta`, Scalar su `/_scalar`), con i metadati scritti a mano
nell'handler. Più semplice, ma nessuno controlla che restino veri.

---

## Test

Tutto il mio lato si prova senza interfaccia.

| Livello | Cartella | Comando | Cosa | Con cosa |
|---|---|---|---|---|
| [M] motore | `tests/engine/` | `npm run test:engine` | abbinamento, classifica, tiebreak, fasi, firma | `node --test`, fixture JSON, **fast-check** per le proprietà |
| [U] unitari | `tests/backend/` | `npm run test:backend` | mapper, validazione, matrice dei permessi, macchine a stati | `node --test`, dipendenze finte (come oggi) |
| [I] integrazione | `tests/integration/` | `npm run test:integration` | servizi e comandi su un database vero | PGlite in memoria, migrazioni applicate a ogni file di test |
| [C] concorrenza | `tests/concurrency/` | `npm run test:concurrency` | capienza, comandi paralleli sullo stesso torneo, LISTEN/NOTIFY | Postgres in Docker (`compose.test.yml`) |
| [S] scenario | `tests/scenario/` | `npm run test:scenario` | un torneo intero via HTTP, come lo farebbe l'interfaccia | server avviato su un database PGlite nuovo, client HTTP con sessione Better Auth |

`npm run test` lancia [M], [U] e [I], cioè quello che non chiede Docker né un server avviato.

Il motore si prova anche **per proprietà**, non solo con esempi: per qualunque input generato
l'abbinamento è completo, è deterministico (stesso input e stesso seed danno lo stesso esito), e
sui grafi piccoli il blossom trova lo stesso ottimo della forza bruta. Le fixture «storiche» (gli
esempi dell'MTR, Appendice C, e delle regole Pokémon) fissano i tiebreak.

Lo **scenario runner** ha due usi: come test, gioca un torneo dall'inizio alla fine e controlla la
classifica; come strumento, ferma il database in uno stato preciso («round 3 pubblicato con un match
contestato») per Marco e per le prove in sala.

---

## Dipendenze fra le fasi

```
F0 Fondamenta ──────┬──> F2 Giocatori, torneo, iscrizioni ──> F3 Round e risultati ──┬──> F4 Live
                    │                                                                  │
F1 Motore svizzero ─┴──────────────────────────────────────────> (F3 lo usa) ──────────┴──> F5 Top cut ──> F6 Rodaggio
     (puro: si può fare in parallelo a F0, da subito)
```

Dopo la v1 le fasi F7–F19 seguono l'ordine del §11: ognuna sblocca o prepara la successiva.

---

# v1

## F0 · Fondamenta (M0)

Fatto quando: in produzione su CapRover un admin crea un'organizzazione e un torneo libero via API, e
un client SSE vede l'aggiornamento quando il torneo cambia nome.

**F0.1 · Node 26.** `nvm use` sulla 26; verificare che `Temporal` sia nativo, che `node --test`
esegua i `.ts` senza flag e che `nuxt dev` e `nuxt build` girino. Aggiungere `engines` a
`package.json`. *Test:* uno [U] che usa `Temporal.ZonedDateTime` con `Europe/Rome`. *Fatto:* tutto
verde sulla 26.

**F0.2 · Impianto dei test.** Gli script `test:engine`, `test:integration`, `test:concurrency`,
`test:scenario` e `test`; l'helper `createTestDatabase()` (PGlite in memoria, migrazioni applicate);
`compose.test.yml` con Postgres. Aggiornare la sezione test di `docs/backend-structure.md` e di
`.claude/rules/engine.md` («Test location and runner script are not decided yet»). *Test:* un test
banale per livello. *Fatto:* ogni comando gira e fallisce se un test fallisce.

**F0.3 · Pipeline del contratto.** Spike sulla generazione dell'OpenAPI (vedi *Contratto con il
frontend*); poi il registro delle rotte, `npm run api:spec`, Scalar su `/_docs`, `docs/api/CHANGELOG.md`,
il test che confronta registro e handler. Si documentano i tre endpoint `users` esistenti. Si fissano
le convenzioni API, `ApiWarning` compreso. **[contratto]** *Test:* [U] del confronto
registro/handler. *Fatto:* Marco apre `/_docs` e vede gli endpoint `users`.

**F0.4 · Account creati a mano.** In v1 non c'è iscrizione pubblica: `emailAndPassword.disableSignUp`
e uno script `npm run user:create -- --email … --name …` che crea l'utente con le API server di Better
Auth. Va detto a Marco: una pagina di registrazione, se c'è, smette di funzionare. *Test:* [I] lo
script crea un utente che poi fa login. *Fatto:* nessuno si registra da solo.

**F0.5 · Plugin `organization`.** Le tabelle `organizations`, `members`, `invitations` scritte a mano
come quelle di `auth.ts`, più `activeOrganizationId` sulla sessione. Ruoli: solo `owner` e `admin`.
Chi crea un'organizzazione ne diventa owner. In `server/utils/auth.ts` va
`requireOrganizationRole(event, organizationId, roles)`. Senza mailer i membri si aggiungono cercandoli
fra gli utenti registrati: `GET /api/users?search=` e `POST /api/organizations/:id/members` (le API
server del plugin, perché `addMember` non è esposta al client). **[contratto]** *Test:* [I] creazione,
aggiunta di un membro, rifiuto di un non membro. *Fatto:* un utente crea un'organizzazione e aggiunge
un admin.

**F0.6 · Fuso orario e date.** Un piccolo modulo `server/utils/time.ts` sopra Temporal: istante ↔
`ZonedDateTime` nel fuso del torneo, disambiguazione `compatible`, «fine giornata nel fuso». Serve
subito per `startsAt` e più avanti per offerte, ricorrenze e scadenze. *Test:* [U] sulle due notti
del cambio d'ora a Roma. *Fatto:* nessun `new Date()` fa aritmetica di calendario.

**F0.7 · Torneo minimo.** La tabella `tournaments`: `organizationId`, `name`, `game` (testo libero),
`timezone`, `startsAt`, `status` (i sette stati del glossario), `maxParticipants`, `location`,
`createdBy`, `seed` (crittografico, alla creazione), `ruleset` (`jsonb`, null finché non c'è una
composizione), `rulesetOrigin`. Endpoint: `POST /api/tournaments`, `GET /api/tournaments` (quelli
dell'organizzazione), `GET /api/tournaments/:id`, `PATCH /api/tournaments/:id`. **[contratto]**
`shared/types/tournament.ts` si riscrive qui (decisione 14.3): è un cambiamento che rompe le pagine
di Marco e il suo mock, quindi va concordato con lui prima. *Test:* [U] mapper e schema, [I]
servizio. *Fatto:* un admin crea e legge un torneo via API.

**F0.8 · Helper dei comandi e storico.** La tabella `history_entries`
(`{ tournamentId, entity, entityId, action, actorId, reason, before, after, at }`) e
`runTournamentCommand` come descritto sopra. `PATCH /api/tournaments/:id` passa già di qui. *Test:*
[I] la voce esiste se il comando riesce e manca se fallisce; [C] due comandi paralleli sullo stesso
torneo si serializzano. *Fatto:* nessuna scrittura su un torneo bypassa l'helper.

**F0.9 · Live: notifier e SSE.** `server/realtime/notifier.ts`: una connessione dedicata per processo
in `LISTEN` (`postgres-js` `listen`, PGlite `.listen()`), smistamento in memoria agli iscritti per
torneo. `GET /api/tournaments/:id/stream` con `createEventStream`, keepalive ogni 30 secondi,
`X-Accel-Buffering: no`. Payload di soli identificativi; alla connessione il server manda un evento
`hello` col proprio `now`. *Test:* [I] su PGlite un comando produce un evento sul flusso. *Fatto:* un
`curl -N` vede l'evento quando il torneo cambia.

**F0.10 · Prova tecnica di pg-boss.** pg-boss avviato da un plugin Nitro (start e stop puliti),
`fromDrizzle(tx, sql)` provato su PGlite e su Postgres. L'esito si scrive in
`docs/backend-structure.md`: se su PGlite non funziona, in sviluppo si accoda fuori dalla
transazione. In v1 nessuna funzione usa i job. *Test:* [I] e [C], un job accodato in una transazione
annullata non esiste. *Fatto:* esito documentato.

**F0.11 · Deploy su CapRover.** `captain-definition` e `Dockerfile` (Node 26, `node-server`); il
Postgres come app CapRover a sé; variabili `NUXT_*`; migrazioni applicate al rilascio; template nginx
dell'app con `proxy_read_timeout` alto e buffering spento per SSE; `GET /api/health`. In produzione,
il ruolo Postgres dell'app ha solo `INSERT` e `SELECT` su `history_entries`. Prova di
`LISTEN/NOTIFY` dietro l'nginx di CapRover. *Test:* [S] ridotto contro l'istanza di produzione
(health, login, SSE che resta aperto oltre 60 secondi). *Fatto:* il criterio della fase.

## F1 · Motore svizzero puro (M1)

È indipendente da F0: si può iniziare subito. Fatto quando: dati partecipanti, risultati e
composizione, il motore produce abbinamenti di qualunque round e la classifica con OMW%, GW% e OGW%,
in modo deterministico e verificabile, tutto con [M].

**F1.1 · Scheletro.** Cartelle, `version.ts`, tipi d'ingresso e d'uscita del motore. Una regola
ESLint `no-restricted-imports` su `server/engine/**` rende il confine un errore di lint, non una
buona intenzione. *Test:* [M] banale. *Fatto:* un import da `server/database` nel motore non passa
il lint.

**F1.2 · Generatore seedato.** Il seed è una stringa esadecimale da 256 bit (lo genera il server). Un
PRNG con aritmetica intera (per esempio xoshiro128**), sotto-flussi derivati per scopo
(`derive(seed, 'round:1')`), Fisher–Yates con estrazione intera senza distorsione. *Test:* [M]
vettori noti, stesso seed → stessa sequenza. *Fatto:* nessun `Math.random()` nel motore.

**F1.3 · Aritmetica esatta.** Razionali su `BigInt` (quattro operazioni, `min`, `max`, confronto) e
l'arrotondamento a una precisione dichiarata prima del confronto (§8). *Test:* [M] per proprietà.
*Fatto:* nessun numero in virgola mobile decide un ordine.

**F1.4 · Blossom pesato.** Matching a peso massimo con massima cardinalità, pesi `BigInt`. Pesi
raddoppiati, così le variabili duali restano intere. È un porting dell'algoritmo classico (quello di
Van Rantwijk, alla base di NetworkX): prima di copiarlo va verificata la licenza. *Test:* [M] confronto
con la forza bruta su grafi casuali fino a 12 nodi (fast-check), più grafi grandi a tempo. *Fatto:*
ottimo identico alla forza bruta su migliaia di casi.

**F1.5 · Forme del risultato.** `win_loss_draw` e `best_of_n`: validazione di un risultato (in un Bo3
`2-1` sì, `3-0` no; patta inseribile solo se la fase la consente) ed esito normalizzato per slot:
esito, partite vinte, perse e patte, forfait. Non presentarsi equivale a giocare e perdere.
*Test:* [M]. *Fatto:* tabelle di casi validi e non validi verdi.

**F1.6 · Record e punti.** Dai match ai record dei partecipanti: punti (3/1/0, parametri del modulo),
vittorie, patte, sconfitte, partite, elenco degli avversari, bye ricevuti. Il bye vale una vittoria
piena. *Test:* [M]. *Fatto:* record corretti su fixture a mano.

**F1.7 · Tiebreak.** `MW%`, `OMW%`, `GW%`, `OGW%` come moduli del catalogo, con pavimento e tetto,
`byeInOpponents` (`exclude`, `dummy_own_score`, `dummy_fixed`) e `byeInRecord` (`win`, `excluded`).
Vittoria per forfait o per ritiro dell'avversario: avversario reale (§8). *Test:* [M] fixture dagli
esempi dell'MTR, Appendice C, e delle regole Pokémon, più i default del torneo libero. *Fatto:* i
numeri coincidono con le fonti.

**F1.8 · Classifica.** Ordina per punti, poi per la lista di tiebreak del ruleset, poi per
`drawNumber`. Il ritirato resta al suo posto. L'uscita dichiara la vista (iscritti, presenti, in
gioco) e porta i valori di ogni tiebreak già arrotondati. *Test:* [M]. *Fatto:* il nucleo non nomina
nessun tiebreak.

**F1.9 · Catalogo e composizione.** Il formato di dichiarazione di un modulo (parametri e limiti,
`scope`, `requires`, `conflicts`), i moduli della v1 e il validatore di una composizione, che
restituisce problemi e non lancia. Il ruleset risolto è un'unione discriminata per modulo (proposta
tecnica 15.1), con le sole varianti v1 dei moduli dell'applicazione: tempo `round`, tutti i match
insieme, `judging` spento. Si esporta anche un **descrittore JSON** del catalogo: da quello il
frontend costruisce il form, perché non può importare il motore. *Test:* [M] composizioni valide, e
non valide per ogni vincolo (patta in eliminazione). *Fatto:* il torneo libero della v1 si esprime
come composizione e passa il validatore.

> **Decisione da prendere qui.** Lo schema Valibot «generato dal catalogo» (§3) vive sul server, che
> lo costruisce dalla dichiarazione del motore. Il frontend riceve il descrittore (`GET /api/catalog`)
> e chiede la validazione al server (`POST /api/rulesets/validate`), invece di importare uno schema
> che dipende dal motore. È la proposta: da confermare.

**F1.10 · Round 1 e bye.** Mescolamento seedato dei partecipanti attivi. I bye premiali (`byeRounds`)
tolgono il partecipante dall'abbinamento dei suoi primi round; il bye strutturale, se il numero è
dispari, va al più basso in classifica (al round 1, a sorte). *Test:* [M]. *Fatto:* il round 1 è
deterministico e completo.

**F1.11 · Round successivi.** I pesi lessicografici del §7 (niente secondo bye > niente rivincite >
differenza di punti quadratica > lato > cosmetici, con l'indice più basso a vincere a parità), il nodo
del bye, i tavoli (tavolo 1 = i più forti) e gli avvisi (rivincite, secondi bye) nell'uscita.
*Test:* [M] proprietà: abbinamento sempre completo; zero rivincite quando la forza bruta dice che si
può; il minimo di rivincite quando non si può; determinismo. Più fixture d'oro su tornei realistici
da 8 a 128 giocatori. *Fatto:* un torneo simulato da 64 giocatori su 7 round non produce mai una
rivincita evitabile.

**F1.12 · Limite delle rivincite.** Funzione che, dati i partecipanti ancora in gioco e i round
previsti, dice se si è oltre il limite (§5): serve all'avviso quando si impostano o aggiungono round e
a ogni drop. *Test:* [M] l'esempio del §10 (otto iscritti, quattro round, due drop). *Fatto:*
l'avviso scatta dove deve.

**F1.13 · Firma e verifica.** `generate(input, seed)` produce l'esito e la firma
`{ engineVersion, seed, input }` con l'input serializzato in forma canonica; `verify(firma, esito
salvato)`; `node server/engine/cli.ts verify <file.json>`. Una versione vecchia si verifica
riprendendo dal repository il motore di quella versione (un tag git per versione) e lanciando la sua
CLI. *Test:* [M] verifica positiva, e negativa su un esito alterato. *Fatto:* la CLI verifica una
firma salvata.

## F2 · Giocatori, torneo, iscrizioni (M1)

Fatto quando: via API si crea un torneo con la sua composizione, si iscrivono giocatori creati al
volo, si fa il check-in e si avvia il torneo.

**F2.1 · Permessi.** La matrice azione × ruolo, il caricamento dei ruoli dell'attore e la tabella
`tournament_staff` (`head_judge`, `judge`, `scorekeeper`; i primi due solo con `judging` acceso).
Gli endpoint `GET/POST /api/tournaments/:id/staff` e `DELETE …/staff/:userId`, con la ricerca fra gli
utenti registrati. Una **proposta** di matrice v1, da confermare: owner e admin fanno tutto; lo
scorekeeper fa check-in e referta; correggere un risultato o modificare un abbinamento spetta a owner
e admin. **[contratto]** *Test:* [U] la matrice, [I] un utente esterno all'organizzazione diventa
scorekeeper. *Fatto:* ogni servizio chiede alla matrice.

**F2.2 · Giocatori.** La tabella `players`: `firstName`, `lastName`, `nickname`, `birthYear`, `status`
(`unclaimed`, `claimed`), `userId`, `originOrganizationId`. `displayName` si calcola nel mapper (§2).
Due DTO: quello di ricerca, con nome visualizzato e organizzazione d'origine, per tutti; quello di
dettaglio, con nome completo, solo per l'organizzazione d'origine. Ricerca fuzzy con `pg_trgm`
(verificare che PGlite carichi l'estensione). La creazione di un minore risponde con un `warning`.
Endpoint: `GET /api/players?search=`, `POST /api/players`, `GET /api/players/:id`,
`PATCH /api/players/:id`. **[contratto]** *Test:* [U] `displayName`, [I] ricerca fuzzy, modifica
rifiutata a un'altra organizzazione. *Fatto:* il flusso cerca → nessuno di questi → crea funziona via
API.

**F2.3 · Composizione del torneo.** `GET /api/catalog` (il descrittore), `POST /api/rulesets/validate`,
`PUT /api/tournaments/:id/ruleset`: la composizione libera si valida e si salva risolta, con
`rulesetOrigin = 'free'`. Si cambia finché il torneo non parte. **[contratto]** *Test:* [I]. *Fatto:*
il torneo della v1 (svizzera con N round, top 8, Bo1 poi Bo3) si salva via API.

**F2.4 · Ciclo di vita del torneo.** Una macchina a stati pura (`draft → published →
registration_open → checkin_open → running → finished`, più `cancelled`) e gli atti
`POST /api/tournaments/:id/{publish,open-registration,open-checkin,cancel}`, tutti via helper dei
comandi. **[contratto]** *Test:* [U] le transizioni, [I] gli atti. *Fatto:* una transizione non
ammessa risponde 409.

**F2.5 · Partecipanti.** Le tabelle `participants` (`seat`, `attendance`, `play`, `drawNumber`,
`byeRounds`, `paymentStatus`) e `participant_members` (in v1 un membro solo). Iscrizione al banco
solo con posti liberi, difesa da un vincolo in database, non da un conteggio. Cancellazione prima del
check-in. Elenco con i tre assi e i tre conteggi (iscritti, presenti, in gioco). Endpoint:
`GET/POST /api/tournaments/:id/participants`, `POST /api/participants/:id/cancel`. **[contratto]**
*Test:* [I], e [C]: venti iscrizioni concorrenti a un torneo con dieci posti ne accettano dieci.
*Fatto:* il cap regge sotto concorrenza.

**F2.6 · Check-in.** `POST /api/participants/:id/{check-in,undo-check-in}` a check-in aperto, fatti
dallo staff in v1. **[contratto]** *Test:* [I]. *Fatto:* la presenza è nello storico.

**F2.7 · Bye premiali manuali.** Nel torneo libero l'organizzatore assegna `byeRounds` prima del primo
abbinamento (§7): `PUT /api/participants/:id/bye-rounds`. Facoltativo per la v1, costa poco.
**[contratto]** *Test:* [I]. *Fatto:* rifiutato dopo il primo abbinamento.

**F2.8 · Avvio del torneo.** `POST /api/tournaments/:id/start`: richiede `checkin_open` e almeno due
presenti. Chi non ha fatto check-in diventa `no_show` e `dropped`. I `drawNumber` si sorteggiano dal
seed del torneo. Le fasi si materializzano dalla composizione (tabella `phases`, con ordine, tipo,
gate, eredità, impostazioni) e il torneo passa a `running`. **[contratto]** *Test:* [I]. *Fatto:*
dopo l'avvio la prima fase è pronta per generare il round 1.

## F3 · Round e risultati (M1)

Fatto quando: via API si gioca una svizzera completa, con override, contestazioni, drop, correzioni,
annullamenti, cronometro e classifica a ogni round.

**F3.1 · Schema.** `rounds` (numero, stato, `seed`, firma di generazione in `jsonb`, cronometro:
`timerStatus`, `endsAt`, `pausedAt`, `pausedMs`), `matches` (`kind`, `table`, `status` con `disputed`,
`endsAt` proprio per le estensioni, `cancelledAt`), `match_slots` (`participantId`, `result`, `rank`,
`forfeit`, `score`). Il conteggio delle partite di un best-of sta in `score`; la tabella `games` arriva
quando serve la singola partita (penalità *game loss*, F10). *Test:* [I] migrazione e vincoli.
*Fatto:* lo schema ospita duel e bye.

**F3.2 · Traduzione e `generate`.** Il servizio costruisce l'input del motore (partecipanti in
gioco, punti, coppie già incontrate, bye già ricevuti, configurazione della fase), genera il seed del
round con un generatore crittografico, chiama il motore e salva match e firma. Il round nasce `draft`,
visibile solo allo staff, e la risposta porta gli avvisi del motore. Richiede il round precedente
chiuso. Endpoint: `POST /api/phases/:id/rounds`, `GET /api/rounds/:id`, `GET /api/phases/:id/rounds`.
**[contratto]** *Test:* [I]. *Fatto:* rigenerare con lo stesso input dà lo stesso abbinamento.

**F3.3 · `publish` e `start`.** `POST /api/rounds/:id/publish` rende visibili gli abbinamenti;
`POST /api/rounds/:id/start` fa partire il cronometro (`endsAt = now + durata`) se il ruleset ha il
tempo. **[contratto]** *Test:* [I]. *Fatto:* un round `draft` non compare nelle letture pubbliche.

**F3.4 · Cronometro.** `POST /api/rounds/:id/{pause,resume}` (la pausa sposta `endsAt` e accumula
`pausedMs`), `POST /api/matches/:id/extension` (un `endsAt` proprio del match). Ogni lettura del
cronometro porta `{ endsAt, pausedMs, status }` più il `now` del server. **[contratto]** *Test:* [U]
il calcolo con un orologio iniettato, [I] gli atti. *Fatto:* nessun tick lato server.

**F3.5 · Override dell'abbinamento.** `PUT /api/rounds/:id/pairings` con il nuovo abbinamento e un
`reason` obbligatorio, permesso prima di `start`. Avvisa (rivincite, secondi bye: il motore espone
`evaluatePairing`) e non impedisce mai. **[contratto]** *Test:* [I] lo storico porta il prima e il
dopo. *Fatto:* un override con rivincita passa, con l'avviso.

**F3.6 · Risultati e contestazioni.** `POST /api/matches/:id/result`: validato dalla forma del
risultato della fase. Il primo inserimento è valido. Un secondo uguale è una conferma (voce di
storico); uno diverso è un tentativo respinto (voce di storico) e porta il match a `disputed`.
`PUT /api/matches/:id/result` con `reason`: la sovrascrittura di chi ha il permesso, che risolve la
contestazione. **[contratto]** *Test:* [I] i tre casi, [C] due refertazioni simultanee diverse:
una vince, l'altra diventa il tentativo respinto. *Fatto:* nessun risultato si perde in silenzio.

**F3.7 · Drop e mancato arrivo.** `POST /api/participants/:id/{drop,undo-drop}`. Il mancato arrivo
al match è un risultato (sconfitta con forfait) che droppa il partecipante. Un drop si annulla solo
finché il round successivo non è generato. A ogni drop si ricalcola l'avviso sul limite delle
rivincite. **[contratto]** *Test:* [I]. *Fatto:* l'annullamento dopo la generazione risponde 409.

**F3.8 · Chiusura e snapshot.** `POST /api/rounds/:id/close` richiede tutti i risultati. Calcola la
classifica col motore e la salva in `standings_snapshots` (round, vista, valori, versione del motore).
**Decisione da prendere qui:** un match `disputed` blocca la chiusura? (Proposta: sì, perché il §9 già
chiede zero contestati per pubblicare.) Endpoint di lettura: `GET /api/rounds/:id/standings` e
`GET /api/tournaments/:id/standings` (l'ultimo snapshot). **[contratto]** *Test:* [I]. *Fatto:* la
classifica pubblicata cambia solo alla chiusura.

**F3.9 · Riaprire e annullare.** `POST /api/rounds/:id/reopen` invalida il suo snapshot e i successivi.
`POST /api/rounds/:id/cancel` (con `reason`, solo sul round corrente) marca match e risultati come
annullati e scarta lo snapshot. Le letture escludono gli annullati, lo storico li conserva.
**[contratto]** *Test:* [I] annullare tre round a ritroso, uno alla volta. *Fatto:* niente si
cancella.

**F3.10 · Correzione di un round chiuso.** Correggere un risultato di un round chiuso ricalcola gli
snapshot da quel round in avanti. *Test:* [I]. *Fatto:* la classifica corrente riflette la
correzione.

**F3.11 · Riabbinamento proposto.** Se il round successivo è generato ma non avviato, la correzione
propone un riabbinamento con lo stesso seed e ne mostra il diff:
`GET /api/rounds/:id/repairing-proposal`, `POST …/accept`. Rifiutare vuol dire proseguire con gli
abbinamenti attuali e il punteggio corretto. Facoltativo per la v1. **[contratto]** *Test:* [I] il
diff contiene solo l'effetto della correzione. *Fatto:* accettare sostituisce il round, e la
sostituzione finisce nello storico.

**F3.12 · Round in più o in meno.** `PATCH /api/phases/:id` cambia il numero di round della svizzera
in corsa, con l'avviso sul limite delle rivincite. **[contratto]** *Test:* [I]. *Fatto:* togliere un
round già giocato risponde 409.

**F3.13 · Letture di servizio.** `GET /api/tournaments/:id/history?entity=&entityId=` (staff),
`GET /api/rounds/:id/verification` (staff: rilancia il motore sulla firma e confronta),
`POST /api/tournaments/:id/standings/recompute` (riparazione esplicita, con `reason`).
**[contratto]** *Test:* [I]. *Fatto:* la verifica di un round alterato a mano in database fallisce.

**F3.14 · Fine della fase.** Chiudere l'ultimo round della svizzera chiude la fase e salva il suo
elenco ordinato in uscita. Se è l'ultima fase, il torneo passa a `finished`. *Test:* [I] e il primo
[S]: una svizzera da 16 giocatori su 4 round, giocata via HTTP dall'inizio alla fine. *Fatto:* il
criterio della fase.

## F4 · Live (M1)

Fatto quando: il display in sala e i telefoni ricevono abbinamenti, stato dei match e cronometro senza
ricaricare, e la classifica solo alla chiusura del round.

**F4.1 · Catalogo degli eventi.** I tipi (`tournament.updated`, `round.updated`, `match.updated`,
`timer.updated`, `standings.updated`) in `shared/types/live.ts`, emessi dall'helper dei comandi.
Durante un round non viaggia mai la classifica. **[contratto]** *Test:* [I] ogni atto emette
l'evento atteso. *Fatto:* la tabella atto → evento è nel changelog.

**F4.2 · Stato live.** `GET /api/tournaments/:id/live`: in una lettura sola il round corrente
pubblicato, i suoi match, il cronometro e il `now` del server. È ciò che il client rilegge alla
connessione e dopo ogni evento. Pubblico da `published` in poi. **[contratto]** *Test:* [I].
*Fatto:* il display si costruisce con questa lettura più il flusso.

**F4.3 · Prova sotto carico.** Cento client SSE sull'istanza CapRover per la durata di un round, e
riconnessione dopo un riavvio del container. *Test:* [S] script di carico. *Fatto:* nessun flusso
cade per inattività.

## F5 · Top cut (M2)

Fatto quando: via API si gioca una svizzera seguita da un top 8 a eliminazione singola, fino alla
classifica finale composta a ritroso.

**F5.1 · Gate.** Puro, i tre criteri del §4: per posizione, per punti, tutti i pari punteggio con
l'n-esimo. In v1 serve solo il primo, ma costano poco insieme. *Test:* [M]. *Fatto:* i tagliati
escono in ordine.

**F5.2 · Tabellone a eliminazione singola.** Seeding standard (1 contro 8, 4 contro 5…), bye ai seed
più alti se il gate non dà una potenza di due, avanzamento dai risultati, patta non inseribile.
*Test:* [M] per 2…64 partecipanti, potenze di due e no. *Fatto:* il tabellone di 6 dà due bye ai
primi due seed.

**F5.3 · Linearizzazione.** Round di uscita, poi seed d'ingresso, poi `drawNumber` (§4). *Test:* [M].
*Fatto:* i perdenti dei quarti sono ordinati.

**F5.4 · Catena di fasi ed eredità.** L'elenco ordinato passa da una fase all'altra con i tre
parametri d'eredità (punti, storia degli avversari, dati di tiebreak). In v1 i parametri sono tutti a
«no» (verso l'eliminazione), ma il meccanismo si scrive completo: lo usa il day 2 (F11). *Test:* [M].
*Fatto:* l'eredità è un parametro, non un caso speciale.

**F5.5 · Classifica finale.** Composta a ritroso: chi è arrivato in fondo all'ultima fase, poi i
tagliati dall'ultimo gate nel loro ordine, poi quelli tagliati prima. *Test:* [M]. *Fatto:* nessun
partecipante manca.

**F5.6 · Passaggio di fase.** Il servizio: chiusa la svizzera, si applica il gate al suo elenco, si
materializza la fase a eliminazione e si congela il seeding all'inizio del primo round. Una
correzione arrivata prima di `start` lo rifà. **[contratto]** *Test:* [I]. *Fatto:* il top 8 parte
dall'ultimo snapshot della svizzera.

**F5.7 · Round di eliminazione.** `generate` produce il turno successivo del tabellone. Il cronometro
è solo informativo (nessun esito a tempo) e il risultato non ammette patta. **[contratto]** *Test:*
[I]. *Fatto:* una finale si chiude con un vincitore.

**F5.8 · Fine del torneo.** Chiusa l'ultima fase, la classifica finale si salva e il torneo passa a
`finished`. `GET /api/tournaments/:id/standings` restituisce la classifica finale. **[contratto]**
*Test:* [I], più lo [S] completo: 24 giocatori, 5 round di svizzera, top 8 in Bo3. *Fatto:* il
criterio della fase.

## F6 · Rodaggio (M3)

Fatto quando: la prova generale nel negozio si è giocata interamente via API e app, e i difetti trovati
sono chiusi.

**F6.1 · Scenari come strumento.** `npm run scenario -- <nome>` porta un database locale in uno stato
nominato (torneo in iscrizione, round 3 pubblicato, un match contestato, top cut in corso). Gli stati
li sceglie Marco, perché servono alle sue pagine. *Fatto:* Marco ne usa almeno uno al posto di un
mock.

**F6.2 · Backup e ripristino.** `pg_dump` pianificato del Postgres di CapRover, conservato fuori dal
server, e un ripristino provato davvero. *Fatto:* il ripristino è documentato in un runbook.

**F6.3 · Osservabilità minima.** Log strutturati dei comandi (torneo, atto, durata, esito), errori 5xx
con contesto, `GET /api/health` che controlla anche il database. *Fatto:* da un log si ricostruisce
cosa è successo in un round.

**F6.4 · Runbook di sala.** Cosa fare quando: un risultato è sbagliato, un round va annullato, un
giocatore arriva in ritardo, il wifi cade (dati mobili, match slip a mano), il server non risponde.
*Fatto:* una pagina in `docs/`, provata durante la prova generale.

**F6.5 · Prova generale e correzioni.** Un torneo vero con persone vere. Ogni difetto diventa un test
[I] o [S] prima della correzione.

---

# Dopo la v1

L'ordine è quello del §11, *Dopo la v1*. Gli step sono più grossi perché il dettaglio dipende da
quanto si impara nella v1; ognuno si spezza in step atomici quando la fase comincia.

## F7 · Job, mailer, push, risultati dai giocatori

- **F7.1 · pg-boss in produzione.** Code, worker nel plugin Nitro, ritentativi, job accodati nella
  transazione (o fuori, secondo l'esito di F0.10), monitoraggio delle code fallite.
- **F7.2 · Mailer.** SMTP con `NUXT_MAIL_*`, invio solo da un job, modelli in italiano; verifica
  email e reset password di Better Auth; inviti dell'organizzazione via email. Lo schema GET →
  conferma → POST vale per ogni link monouso. **[contratto]**
- **F7.3 · Push.** Chiavi VAPID, tabella delle sottoscrizioni (una per dispositivo), invio da un job;
  prima notifica: abbinamenti pubblicati. **[contratto]**
- **F7.4 · [brainstorm] Rivendicazione del profilo.** Il §2 dice «con un token» ma non come arriva
  (argomento 8: «non detto»). Va deciso prima di F7.5.
- **F7.5 · Rivendicazione.** Il token, il passaggio `unclaimed → claimed` e il legame `Player ↔ User`,
  che non è un merge. **[contratto]**
- **F7.6 · Risultati dai giocatori.** Un giocatore referta il proprio match; la conferma
  dell'avversario è un segno visivo; il contraddittorio porta a `disputed`, con una push allo staff.
  Il permesso è a livello di match. **[contratto]**
- **F7.7 · Iscrizione e check-in self-service.** L'iscrizione del giocatore con account, fino al cap,
  e il check-in dal telefono. **[contratto]**
- La **stampa** (abbinamenti, match slip, classifiche) è soprattutto frontend: le letture esistono
  già. Se serve, una vista per nome oltre a quella per tavolo.

## F8 · Lista d'attesa con offerte

- **F8.1 · Capienza a tre stati.** Occupato, riservato da un'offerta, libero, difesi da un vincolo in
  database. [C] obbligatorio.
- **F8.2 · Lista d'attesa e `SeatOffer`.** `queuePosition`, `issuedAt`, `expiresAt` (fino a «domani
  alla stessa ora» nel fuso del torneo, o fino all'apertura del check-in se viene prima), `token`,
  `outcome`. **[contratto]**
- **F8.3 · Scadenza come job.** Un job differito per offerta, che alla scadenza emette quella
  successiva; la lettura resta difensiva. Il congelamento all'apertura del check-in taglia tutte le
  offerte.
- **F8.4 · Link dell'offerta.** Senza login, monouso, GET che mostra e POST che consuma; email più
  push se c'è. **[contratto]**

## F9 · Template e tornei ricorrenti

- **F9.1 · Template.** Contiene la composizione dell'organizzatore e le tre date come offset di
  calendario locale. **[contratto]**
- **F9.2 · Ricorrenza.** «Ogni venerdì alle 20» in ora locale, con disambiguazione `compatible`;
  creazione del torneo dal template. [U] sulle notti del cambio d'ora. **[contratto]**

## F10 · Arbitraggio e comunicazioni

- **F10.1 · Modulo `judging`.** Acceso, esistono `head_judge` e `judge`; l'opzione del judge che gioca
  e il controllo di permesso a livello di match. **[contratto]**
- **F10.2 · Partite.** La tabella `games`, dove serve la singola partita di un best-of.
- **F10.3 · Penalità.** `Penalty` con le quattro penalità e la loro traduzione nella forma del
  risultato (*game loss* vale match loss dove non ci sono partite), senza upgrade automatico. La
  traduzione è codice del motore. **[contratto]**
- **F10.4 · Chiamata arbitro.** Dal telefono del giocatore, agganciata al tavolo, con push e live
  allo staff. **[contratto]**
- **F10.5 · Messaggio dell'organizzatore.** `OrganizerMessage`, push e in app. **[contratto]**

## F11 · Fasi e moduli avanzati

- **F11.1 · Day 2.** Svizzera → svizzera con gate a punti ed eredità completa; il no-rematch vale
  sulla catena che eredita la storia; fasi consecutive senza gate per azzerare la storia.
- **F11.2 · Round robin.**
- **F11.3 · Gironi.** `Group`, l'elenco per girone e la composizione del tabellone
  (`overall_standing`, `fixed_cross`).
- **F11.4 · Eliminazione doppia**, con la sua linearizzazione.
- **F11.5 · Catalogo completo.** `continuous_score`, i tiebreak che mancano (punteggio continuo
  totale, Buchholz, scontro diretto, numero di vittorie), l'alternanza del lato, il tempo per tavolo,
  la late entry (`with_losses`, `with_byes`, con la finestra fino al round N).
- **F11.6 · [brainstorm] Simulazione della composizione.** Punto aperto dell'argomento 15: provare
  una composizione su partecipanti finti con risultati seedati. Il motore puro la rende quasi
  gratuita: è lo scenario runner senza database.

Ogni modulo nuovo, nel motore, è una versione nuova: le firme dei round già giocati restano
verificabili.

## F12 · Multi-formato e liste

- **F12.1 · `Decklist`.** Per membro e per fase, con gli stati da `missing` a `valid`/`invalid`,
  deadline e blocco dichiarati dal ruleset, e la versione giocata in ciascun round. **[contratto]**
- **F12.2 · Avvio bloccato.** Il torneo non parte con liste mancanti; la via d'uscita è il drop.
- **F12.3 · Formato per fase.** Gioco e formato possono cambiare da una fase all'altra.

## F13 · Squadre

- **F13.1 · Squadre di n membri.** Roster bloccato alla chiusura delle iscrizioni, senza sostituti;
  «pronta» solo se lo sono tutti i membri. **[contratto]**
- **F13.2 · `Board` e spaiamento cieco.** I capitani ordinano i membri senza vedere l'altro; a conferma
  di entrambi il sistema rivela e incrocia; chi non schiera in tempo riceve un'assegnazione casuale dal
  seed del round. **[contratto]**
- **F13.3 · Risultati di squadra.** I match point dell'incontro derivano dai tavoli. Nessuna classifica
  individuale, ma i tavoli restano registrati.

## F14 · Categorie d'età

- **F14.1 · `Division`.** Anno di nascita obbligatorio all'iscrizione, categoria fissata a inizio
  stagione, minimo di giocatori. **[contratto]**
- **F14.2 · Combinazione.** Sotto il minimo si combina con la categoria più vicina: la svizzera abbina
  l'unione e restituisce un elenco per categoria, ognuna verso il proprio top cut.

## F15 · Preset, circuito, pubblicazione dei risultati, ranking policy

- **F15.1 · [brainstorm] Amministrazione della piattaforma.** Il circuito lo crea «solo la
  piattaforma», ma un ruolo di piattaforma non esiste. Va deciso chi è e come si assegna (plugin
  `admin` di Better Auth o una colonna nostra).
- **F15.2 · [brainstorm] Arbitraggio e preset.** Punto aperto dell'argomento 15: l'arbitraggio sta
  fuori dal preset del circuito?
- **F15.3 · Preset.** File TypeScript tipati dal catalogo, origine `preset:<game>@<version>`, preset
  modificato → `custom`. **[contratto]**
- **F15.4 · Circuito.** Uno per gioco, accetta solo il proprio preset non modificato; il minimo di
  giocatori è una condizione d'avvio (sotto il minimo → `cancelled`). **[contratto]**
- **F15.5 · Ranking policy.** Forma fissa parametrizzata, copia congelata nel torneo, best-N con quote
  per taglia.
- **F15.6 · Pubblicazione dei risultati.** `ResultsPublication`, scadenza a 7 giorni a fine giornata
  nel fuso del torneo, warning all'organizzazione come entità, condizioni confermate dall'aggregatore.
  **[contratto]**
- **F15.7 · Correzione e ritiro.** La correzione si fa in loco anche a stagione chiusa e il ricalcolo
  di stagione è un job.

## F16 · Qualifiche e crediti

- **F16.1 · `Qualification` e `ByeCredit`.** Una riga per bye; consumo transazionale con la
  prenotazione; ritorno del credito se l'iscrizione si cancella. [C] obbligatorio. **[contratto]**
- **F16.2 · Spesa dei bye.** Fino al limite del torneo, prima quelli che scadono prima, stessa origine
  se il circuito non è cumulativo.
- **F16.3 · Emissione e riallineamento.** Alla chiusura del torneo o della stagione; il job di
  ricalcolo revoca ed emette nella stessa transazione; un credito speso non si revoca.
- **F16.4 · Quote di emissione.**

## F17 · Leghe interne

- **F17.1 · `League`.** Creata dall'organizzazione, con tornei propri e ricorrenti, dove conta la
  presenza; pubblicazione senza la condizione del preset; ammissione decisa dall'organizzatore.
  **[contratto]**

## F18 · Rating, statistiche, profilo pubblico

- **F18.1 · [brainstorm] Glicko.** Quale variante, quali parametri, decadimento dell'RD con un cron o
  in modo pigro.
- **F18.2 · Rating.** Separato dai punti di circuito; l'unico numero che non è funzione pura dei
  risultati.
- **F18.3 · Statistiche del giocatore.** Un secondo read model sui risultati, tutto tranne fazione e
  archetipo. **[contratto]**
- **F18.4 · Profilo pubblico.** Tornei e piazzamenti; il flag del minore, che serve al `noindex`.
  **[contratto]**

## F19 · Postazioni, piattaforma, apertura al pubblico

- **F19.1 · [brainstorm] Postazioni limitate.** La ricerca è rimandata dall'argomento 15: start.gg
  *stations*, Challonge, tornei di Smash e di Beyblade.
- **F19.2 · Postazioni.** `Station`, il ciclo di vita del singolo match (in coda, chiamato, in corso,
  refertato), la chiamata per ordine di arrivo e disponibilità, la scelta manuale.
- **F19.3 · [brainstorm] Rischi accettati.** La revisione del §2 obbligatoria prima di aprire al
  pubblico: minori, titolarità, anonimizzazione.
- **F19.4 · Rimozione = anonimizzazione.** Il `Player` diventa «giocatore rimosso», i fatti del
  torneo restano.
- **F19.5 · 2FA TOTP**, dalla roadmap dell'autenticazione.
- **F19.6 · Motore come pacchetto.** L'estrazione in un pacchetto con versione propria, se il tag git
  per versione (F1.13) non basta più.

---

## Riepilogo degli endpoint della v1

Bozza: ogni rotta si fissa nello step che la introduce, ed è il registro di F0.3 a fare fede.

| Area | Rotte | Step |
|---|---|---|
| Salute | `GET /api/health` | F0.11 |
| Organizzazioni | `/api/auth/organization/*` (Better Auth), `POST /api/organizations/:id/members`, `GET /api/users?search=` | F0.5 |
| Tornei | `GET/POST /api/tournaments`, `GET/PATCH /api/tournaments/:id` | F0.7 |
| Atti del torneo | `POST /api/tournaments/:id/{publish,open-registration,open-checkin,start,cancel}` | F2.4, F2.8 |
| Live | `GET /api/tournaments/:id/stream` (SSE), `GET /api/tournaments/:id/live` | F0.9, F4.2 |
| Staff | `GET/POST /api/tournaments/:id/staff`, `DELETE /api/tournaments/:id/staff/:userId` | F2.1 |
| Giocatori | `GET/POST /api/players`, `GET/PATCH /api/players/:id` | F2.2 |
| Composizione | `GET /api/catalog`, `POST /api/rulesets/validate`, `PUT /api/tournaments/:id/ruleset` | F2.3 |
| Partecipanti | `GET/POST /api/tournaments/:id/participants`, `POST /api/participants/:id/{cancel,check-in,undo-check-in,drop,undo-drop}`, `PUT /api/participants/:id/bye-rounds` | F2.5–F2.7, F3.7 |
| Fasi e round | `PATCH /api/phases/:id`, `GET/POST /api/phases/:id/rounds`, `GET /api/rounds/:id`, `POST /api/rounds/:id/{publish,start,pause,resume,close,reopen,cancel}` | F3.2–F3.4, F3.8, F3.9, F3.12 |
| Abbinamenti | `PUT /api/rounds/:id/pairings`, `GET /api/rounds/:id/repairing-proposal`, `POST …/accept` | F3.5, F3.11 |
| Match | `POST/PUT /api/matches/:id/result`, `POST /api/matches/:id/extension` | F3.4, F3.6 |
| Classifiche | `GET /api/rounds/:id/standings`, `GET /api/tournaments/:id/standings`, `POST /api/tournaments/:id/standings/recompute` | F3.8, F3.13, F5.8 |
| Storico e verifica | `GET /api/tournaments/:id/history`, `GET /api/rounds/:id/verification` | F3.13 |

## Decisioni da prendere lungo la strada

Sono quelle che il brainstorm non fissa e che il piano non decide da solo:

| Dove | Domanda | Proposta |
|---|---|---|
| F0.3 | OpenAPI generato dal registro o metadati scritti a mano in Nitro? | generato, se lo spike regge |
| F0.7 | Quando riscrivere `shared/types/tournament.ts` | concordarlo con Marco, in una volta sola |
| F1.9 | Dove vive lo schema della composizione | sul server; al frontend il descrittore e la validazione via API |
| F2.1 | La matrice dei permessi della v1 | owner/admin tutto; scorekeeper check-in e risultati |
| F3.8 | Un match `disputed` blocca la chiusura del round? | sì |
| F7.4 | Come arriva il token di rivendicazione | [brainstorm] |
| F15.1 | Chi è l'amministratore della piattaforma | [brainstorm] |
