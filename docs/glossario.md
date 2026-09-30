# Glossario

Un termine per ogni concetto del dominio, con il nome che ha nel codice. `brainstorm.md` usa il
termine italiano nella prosa e l'identificatore inglese dove parla di modello, tipi o valori.

## Convenzioni

- **Identificatori sempre in inglese**: tipi, tabelle, colonne, valori enum, nomi dei moduli. Come
  il codice esistente (`User`, `users`, `toUser`).
- **Italiano solo per prosa, testo dell'interfaccia e commenti** (CLAUDE.md, *Conventions*).
- **Tipi e interfacce** in PascalCase (`ByeCredit`); **proprietà e colonne TypeScript** in camelCase
  (`byeRounds`, `expiresAt`), come lo schema Drizzle esistente; **tabelle** in snake_case plurale
  (`bye_credits`), come `users` e `sessions`.
- **Valori enum e stringhe letterali** in snake_case minuscolo (`no_show`, `win_loss_draw`). Quelli
  già nel codice sono parole singole (`draft`, `pending`) e restano validi.
- **Un concetto, una parola.** Nella prosa si dice **torneo**, mai «evento»; **fase**, mai «stage».

## Struttura del torneo

| Termine | Identificatore | Definizione |
|---|---|---|
| Torneo | `Tournament` | La competizione che un'organizzazione crea e gestisce. Non c'è un livello sopra: le categorie d'età vivono dentro il torneo. |
| Stato del torneo | `status` | `draft`, `published`, `registration_open`, `checkin_open`, `running`, `finished`, `cancelled`. «Pubblicato» vuol dire annunciato, prima delle iscrizioni. |
| Pubblicazione dei risultati | `ResultsPublication` | Invio dei risultati di un torneo concluso a circuito o lega, con scadenza a 7 giorni. Diversa dallo stato `published` e dalla pubblicazione di un round. |
| Categoria d'età | `Division` | Gruppo di giocatori per anno di nascita (Junior, Senior, Masters) che gioca in parallelo con classifica propria. Sotto il minimo si combina con la più vicina: abbinamenti condivisi, classifiche separate. |
| Fase | `Phase` | Blocco del torneo con un tipo (svizzera, round robin, gironi, eliminazione singola o doppia, top cut). Prende un elenco ordinato e ne restituisce uno. |
| Gate | `Gate` | Taglio davanti a una fase: per posizione, per punti, o tutti i pari punteggio con l'n-esimo. |
| Eredità | `PhaseInheritance` | Cosa una fase riceve dalla precedente oltre all'elenco: punti, storia degli avversari, dati di tiebreak. Tre parametri separati. |
| Girone | `Group` | Sottoinsieme di una fase a gironi. |
| Round | `Round` | Un turno di una fase. Stati: `draft`, `published`, `started`, `closed`, `cancelled`. Atti: `generate`, `publish`, `start`. |
| Match | `Match` | Incontro fra partecipanti, a slot numerati. `kind`: `duel`, `ffa`, `bye`. |
| Slot | `MatchSlot` | Posizione di un partecipante in un match: `participantId`, `result`, `rank`, `forfeit`, `score`. |
| Tavolo | `Board` | Nei tornei a squadre, l'incontro fra due membri dentro un match. |
| Partita | `Game` | Una singola partita di un best-of. |
| Tavolo (numero) | `table` | Il numero del tavolo assegnato dal motore: tavolo 1 = i più forti. |

## Persone e iscrizioni

| Termine | Identificatore | Definizione |
|---|---|---|
| Utente | `User` | L'account di Better Auth. |
| Giocatore | `Player` | Identità globale di piattaforma. Nasce `unclaimed` quando un'organizzazione lo crea al volo, diventa `claimed` quando un utente lo rivendica. Ha nome, cognome, nickname facoltativo, anno di nascita. |
| Nome visualizzato | `displayName` | Il nickname se c'è, altrimenti nome e iniziale del cognome. Non si sceglie. |
| Partecipante | `Participant` | Il soggetto dell'iscrizione a un torneo: 1..n membri che puntano a `Player`. L'unica cosa che abbinamento, risultati e classifica conoscono. È il nome già usato dal frontend. **Non** ha il significato di start.gg, dove `Participant` è qualunque persona presente, spettatori compresi. |
| Membro del partecipante | `ParticipantMember` | Un giocatore dentro un partecipante; in un torneo individuale è uno solo. |
| Posto | `seat` | `booked`, `waitlisted`, `cancelled`. |
| Presenza | `attendance` | `expected`, `present`, `no_show`. |
| Gioco | `play` | `active`, `dropped`, `disqualified`. |
| Numero di sorteggio | `drawNumber` | Numero casuale assegnato a ogni partecipante all'avvio: l'ultimo tiebreak ovunque. |
| Lista | `Decklist` | La lista di un membro, per fase nei tornei multi-formato. Stati: `missing`, `draft`, `submitted`, `locked`, `valid`, `invalid`. |
| Offerta di posto | `SeatOffer` | Posto offerto al primo in lista d'attesa: `queuePosition`, `issuedAt`, `expiresAt`, `token`, `outcome`. |
| Stato del pagamento | `paymentStatus` | Marcato dall'organizzatore; nessun pagamento passa dalla piattaforma. |

## Organizzazione e ruoli

| Termine | Identificatore | Definizione |
|---|---|---|
| Organizzazione | `Organization` | Proprietaria dei tornei. Non esistono tornei personali. |
| Ruoli di organizzazione | `owner`, `admin` | I ruoli predefiniti del plugin `organization` di Better Auth. |
| Ruoli di torneo | `head_judge`, `judge`, `scorekeeper` | Assegnati al singolo torneo, anche a utenti esterni all'organizzazione. |
| Lega interna | `League` | Creata dall'organizzazione; tornei propri, ricorrenti. |
| Circuito nazionale | `Circuit` | Uno per gioco, creato solo dalla piattaforma. Accetta solo il proprio preset, non modificato. |
| Template | `Template` | Torneo ricorrente salvato, con la composizione dell'organizzatore. |
| Messaggio dell'organizzatore | `OrganizerMessage` | Comunicazione libera ai partecipanti di un torneo, via push e in app. |

## Regole e configurazione

| Termine | Identificatore | Definizione |
|---|---|---|
| Catalogo dei moduli | `ModuleCatalog` | Le varianti di regola implementate nel motore. Codice. |
| Modulo | `Module` | Una variante di regola, con i suoi parametri e i loro limiti. |
| Composizione, ruleset | `Ruleset` | Una scelta di moduli con i loro parametri. Il torneo ne conserva una copia risolta. |
| Origine del ruleset | `origin` | `preset:<game>@<version>`, `custom`, `free`. |
| Preset | `Preset` | Composizione di piattaforma, una per gioco, in un file TypeScript del repository. |
| Torneo libero | `free` | Torneo senza preset: l'organizzatore sceglie tutto dal catalogo. |
| Forma del risultato | `resultShape` | `win_loss_draw`, `best_of_n`, `continuous_score`. |
| Late entry | `lateEntry` | `none`, `with_losses`, `with_byes`. |
| Bye nella lista avversari | `byeInOpponents` | `exclude`, `dummy_own_score`, `dummy_fixed`. |
| Bye nel proprio record | `byeInRecord` | `win`, `excluded`. |
| Composizione del tabellone | `bracketSeeding` | `overall_standing` (default), `fixed_cross`. |
| Ranking policy | `RankingPolicy` | Forma fissa parametrizzata dei punti di circuito. File del repository; il torneo di circuito ne conserva la copia. |

## Risultati, storico, crediti

| Termine | Identificatore | Definizione |
|---|---|---|
| Risultato contestato | `disputed` | Stato di un match con una refertazione contraddittoria. |
| Voce di storico | `HistoryEntry` | `{ tournamentId, entity, entityId, action, actorId, reason, before, after, at }`. Solo aggiunta. |
| Firma di generazione | `GenerationSignature` | `{ engineVersion, seed, input }` sul round: serve a verificare un abbinamento, non a rieseguirlo. |
| Snapshot | `StandingsSnapshot` | Classifica calcolata alla chiusura di un round. Per un torneo terminato è la classifica mostrata. |
| Penalità | `Penalty` | *warning*, *game loss*, *match loss*, *disqualification*. |
| Chiamata arbitro | `JudgeCall` | Dal telefono del giocatore, agganciata al tavolo. |
| Estensione di tempo | `TimeExtension` | Un `endsAt` proprio del match. |
| Cronometro | `endsAt`, `pausedMs`, `status` | Quello che il server manda: il client calcola da solo i secondi. |
| Qualifica | `Qualification` | Diritto di iscriversi a un torneo di circuito: `{ playerId, circuitId, origin, expiresAt }`. Si consuma per intero. |
| Credito bye | `ByeCredit` | Un bye premiale, una riga per bye: `{ playerId, circuitId, origin, expiresAt }`. |
| Bye spesi | `byeRounds` | Quanti bye premiali il partecipante usa in quel torneo. |
