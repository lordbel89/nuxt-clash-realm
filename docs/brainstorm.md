# Brainstorm — ecosistema tornei

Analisi del ciclo di vita del sistema, blocco per blocco. Ogni blocco: ricerca su come lavorano i software esistenti → decisioni prese → conseguenze sul modello.

Stato: **blocchi A e B chiusi.** C–F da analizzare (tabella in fondo).

---

## Fondamenta (dalla discussione iniziale)

Stack: Nuxt full stack, better-auth per identità multi-organizzazione, Drizzle su Postgres, pg-boss per code e job schedulati, SSE per il live in sala, PWA installabile per le push. Nessun Redis, nessun servizio esterno obbligatorio.

Tre entità ortogonali: **organizzazione** (proprietaria dei tornei), **circuito** (aggregatore di risultati pubblicati), **giocatore** (identità globale di piattaforma, profili creabili al volo e rivendicabili).

Due oggetti configurabili che sono il vero prodotto: il **ruleset** del torneo (supportare un gioco nuovo senza codice) e la **ranking policy** (una classifica nuova = una riga di configurazione). Entrambi **versionati**: un torneo giocato con le regole di marzo resta ricalcolabile a settembre.

Motore di **pairing in TypeScript puro**, deterministico, testato su fixture, che non sa nulla di Nuxt.

**Log dei match come fonte di verità**, classifiche come read model ricalcolabile.

---

## A · Circuito e lega

### Ricerca

Tre archetipi distinti, non varianti dello stesso:

- **Circuito a punti** (ITC / Best Coast Pairings, UKTC): aggregatore stagionale cross-organizzazione. Punti per piazzamento, pesati su dimensione dell'evento e sul *percorso* (vincere 5 e perdere l'ultima vale più che perdere subito). Contano solo i migliori N eventi (ITC 2025: max 6, di cui max 4 di taglia RTT 8–27 giocatori). Il circuito non possiede gli eventi: li ingerisce.
- **Circuito a qualificazione** (RCQ → Regional Championship → Pro Tour → Worlds): non produce punteggi ma **diritti**. Livelli gerarchici, finestra temporale secca, quote di emissione (solo negozi certificati, max 3 eventi a stagione).
- **Lega interna** (Longshanks, pattern del negozio): eventi di una sola organizzazione, ricorrenti, dove conta anche la presenza.

### Decisioni

| # | Decisione |
|---|---|
| A1 | **Due entità distinte**, non una macchina con scope diverso. **Circuito nazionale**: uno per ogni gioco supportato, creato **solo dalla piattaforma**. **Lega interna**: creata dall'organizzatore/negozio. |
| A2 | Un evento dell'organizzazione può valere per **il circuito, la lega, entrambi o nessuno**. |
| A3 | Entrambi i modelli: **a punti e a qualificazione**. |
| A4 | Ricalcolo **con congelamento**: ogni evento congela la versione di policy vigente alla sua data; ricalcolare = rieseguire ciascun evento con la *sua* versione. |
| A5 | Ammissione al circuito nazionale: **automatica per criteri**. Ammissione alla lega del negozio: **decide l'organizzatore del torneo**. |
| A6 | Fine stagione: la classifica **si congela**. Determina l'ingresso al nazionale **e il numero di bye**. |
| A7 | **Nessun merge di profili giocatore.** |
| A8 | **Best-N-of-M in v1**: alcuni circuiti contano solo i migliori X tornei. |

### Conseguenze sul modello

- **Evento ↔ aggregatore è molti-a-molti con dati propri** (vale per quale aggregatore? moltiplicatore? approvato da chi e quando?): è un'entità, non un array nel DTO. Trappola già segnalata in `CLAUDE.md`.
- **La qualifica ha un payload, non è booleana**: `{ giocatore, evento_destinazione, bye: n, scadenza }`. È emessa da un aggregatore e **consumata** da una prenotazione → collega A a C.
- **Circuito nazionale e ruleset nascono insieme**: entrambi per-gioco, entrambi di piattaforma. Aggiungere un gioco significa aggiungere anche il suo circuito.
- **Best-N-of-M cambia la natura del calcolo**: la classifica non è una somma ma una selezione.
- Conseguenza accettata di A7: due profili al volo dello stesso giocatore restano distinti per sempre e i punti si spaccano. **Unica difesa: rendere difficile sbagliare in fase di creazione al volo** (ricerca del giocatore esistente) → vincolo per il blocco C.

---

## B · Creazione di un evento

### Ricerca

- **EventLink**: il caso normale non è "creo un evento", è *ricreo quello di ogni venerdì*. Template ufficiali, duplicazione, scheduling di 10 eventi in blocco, timer di round integrato, numero di round raccomandato ma modificabile in corsa.
- **MTR Appendix E**: 9–16 giocatori → 4–5 round, 17–32 → 5, 33–64 → 6, 65–128 → 7, Pro Tour 8–9. È una *tabella*, non ⌈log₂(n)⌉: dipende anche dal formato.
- **Toornament**: il concetto portante è lo **stage**; un torneo è una sequenza di stage, ognuno col proprio motore di abbinamento e regola di travaso.
- **40k / Old World**: ordinamento per Tournament Points, primo tiebreak **VP totali** — punteggio continuo, non conteggio di game. Non esiste forma universale di risultato.

### Decisioni

| # | Decisione |
|---|---|
| B1 | I **ruleset li scrive il gestore della piattaforma**. Sono ammessi ruleset **custom**, ma un evento con ruleset custom **non si aggancia al circuito**. |
| B2 | Forma del risultato: **tre archetipi chiusi**, non un motore generico — `win_loss_draw`, `best_of_N` (conteggio game), `punteggio_continuo` (soglie che derivano l'esito). Copre MTG, 40k, Old World e la gran parte del resto senza diventare un DSL. |
| B3 | **Tutte le fasi**: svizzera, round robin, eliminazione singola, eliminazione doppia, gironi, **top cut** con tre criteri di taglio (per posizione, per punti, per *tutti quelli a pari punteggio con l'n-esimo*). |
| B4 | Il motore **deve permettere** di aggiungere/togliere round in corsa. Ma un evento che fa parte del circuito **segue un template non modificabile** e il numero di round è **fissato dalle regole del circuito**. |
| B5 | **Template ed eventi ricorrenti in v1.** |
| B6 | **Eventi a squadre sì**, con **n utenti** per squadra (non solo 2). |
| B7 | **Tavoli numerati alla maniera tradizionale**: tavolo 1 = i più forti in alto. |

### Conseguenze sul modello

- Il **ruleset definisce cinque cose**: forma del risultato · funzione risultato → punti · tie break come **lista ordinata di funzioni nominate** · forma della lista/deck e sua validabilità · default operativi (durata round, best-of, tabella round per fascia).
- Il **ruleset si congela alla creazione dell'evento**, stessa semantica di A4.
- **Il circuito impone un template all'evento** (B4): non è solo un criterio di ammissione a posteriori, è un vincolo di configurazione a monte. Da capire come si combina con A5 (ammissione automatica per criteri).
- **B6 è la decisione più invasiva presa finora**: "il partecipante è una squadra di n utenti" attraversa prenotazioni, check-in, decklist, pairing, risultati, classifica e statistiche. Va riflessa **in ogni blocco successivo**, non aggiunta dopo.
- **B7 non è cosmetica**: l'assegnazione tavolo è output del motore di pairing, non decorazione, e regge il display in sala.

### Aperto

- Un evento di circuito che scende sotto il minimo giocatori: decade automaticamente? L'ammissione va rivalutata alla **chiusura** dell'evento?
- Ruleset custom: chi li possiede, l'organizzazione o l'evento?

---

## Da analizzare

| Blocco | Argomenti | Note |
|---|---|---|
| **C · Ingresso** | Prenotazione, lista d'attesa, check-in, lista del deck | Il funnel del giocatore. Deve incorporare: consumo della **qualifica** (A), creazione al volo del profilo **con ricerca anti-duplicato** (A7), tutto declinato su **squadre di n utenti** (B6). Ricerca da fare: waitlist Battlefy (promozione automatica, ordine, chi può fare check-in), finestre di check-in, decklist lock e validazione (Melee). |
| **D · Svolgimento** | Fasi, abbinamenti, match, registrazione risultati, arbitraggio | Motore di pairing puro e deterministico. Vincoli svizzera (no rematch, gestione bye, drop a metà evento), assegnazione tavolo (B7), chi inserisce il risultato (giocatore/arbitro) e conferma, ruoli e permessi arbitro, penalità e squalifiche, timer di round ed extra turns, live in sala via SSE. |
| **E · Classifica e tie break** | Svizzera, taglio, eliminazione diretta | Tie break come lista ordinata di funzioni nominate (OMW% / GW% / OGW% vs TP / VP). Semantica dei bye nel calcolo. Seeding del taglio. I tre criteri di top cut (B3). Classifica come read model ricalcolabile dal log dei match. |
| **F · Post-torneo** | Statistiche giocatore, pubblicazione | Chiusura evento, pubblicazione verso circuito e lega, calcolo punti con la policy congelata (A4), profilo giocatore e storico, statistiche (win rate, matchup, archetipi), emissione delle qualifiche di fine stagione (A6). |

---

## Fonti consultate

Melee.gg Help (decklist per organizzatori e giocatori) · [MTR Appendix E](https://blogs.magicjudges.org/rules/mtr-appendix-e/) · [ITC 2025 — Warhammer Community](https://www.warhammer-community.com/en-gb/articles/x96wp1cj/itc-2025-key-changes-to-the-competitive-warhammer-calendar/) · [ITC scoring — Goonhammer](https://www.goonhammer.com/measuring-up-the-competition-a-review-of-the-itc-scoring-system) · [RCQ — WPN](https://wpn.wizards.com/en/news/regional-championship-qualifier-format-update-and-upcoming-promo-cards) · [Best Coast Pairings](https://www.bestcoastpairings.com/) · [Longshanks](https://www.longshanks.org/) · [EventLink — WPN](https://wpn.wizards.com/en/news/definitive-guide-wizards-eventlink) · [Toornament — Stages](https://developer.toornament.com/v2/core-concepts/structure/stage) · [Old World — Scoring & Tiebreakers](https://tow.whfb.app/matched-play/scoring-and-tiebreakers) · [Battlefy — Waitlists](https://medium.com/battlefy/waitlists-for-tournaments-2ec497e3ffb6)
