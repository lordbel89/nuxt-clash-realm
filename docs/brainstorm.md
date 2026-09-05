# Linee guida — ecosistema tornei

Sintesi del brainstorm progettuale: i concetti che il sistema deve rispettare, senza la ricerca
che li ha prodotti. Non è una specifica e non descrive schemi o endpoint — fissa i vincoli che
rendono sbagliata un'implementazione anche quando compila.

---

## 0 · Principi invarianti

1. **Il log dei match è la fonte di verità.** Ogni classifica è un read model ricalcolabile dal log.
   Nessun punteggio è un campo che si aggiorna.
2. **Tutto ciò che è configurabile è versionato e si congela all'uso.** L'evento congela la versione
   del ruleset alla creazione; l'evento di circuito congela la ranking policy vigente alla sua data.
   Ricalcolare non significa riapplicare le regole di oggi: significa **rieseguire ogni evento con la
   propria versione**. Vale per i ruleset di piattaforma e per quelli custom, con un solo meccanismo.
3. **Il motore è TypeScript puro.** Abbinamento e calcolo della classifica non conoscono Nuxt né il
   database: prendono entrant, log e configurazione, restituiscono abbinamenti o classifica. Fixture
   e test su quelli.
4. **Ogni casualità è seedata e registrata.** Round 1, sorteggio di parità residua, spaiamento
   automatico di una squadra: il seed sta sul round, insieme alla versione del motore. Rieseguirlo
   a mesi di distanza deve dare lo stesso risultato.
5. **Aggiungere un gioco è configurazione, non codice.** Se una regola nuova richiede un deploy,
   è finita nel posto sbagliato: appartiene al ruleset o alla ranking policy.
6. **La riga di database non è il contratto API** (vedi `CLAUDE.md`): row → mapper → DTO in uscita,
   schema Valibot condiviso in entrata.

**Stack:** Nuxt full stack · better-auth per l'identità multi-organizzazione · Drizzle su Postgres ·
pg-boss per code e job schedulati · SSE per il live in sala · PWA installabile per le push.
Nessun Redis, nessun servizio esterno obbligatorio.

---

## 1 · Entità portanti

| Entità | Cos'è |
|---|---|
| **Organizzazione** | Proprietaria degli eventi e dello staff. |
| **Circuito nazionale** | Uno per ogni gioco supportato, creato **solo dalla piattaforma**. Non possiede gli eventi: li ingerisce. |
| **Lega interna** | Creata dall'organizzazione. Eventi propri, ricorrenti, dove conta anche la presenza. |
| **Player** | Identità globale di piattaforma. |
| **Entrant** | Il soggetto dell'iscrizione: 1..n membri che puntano a `Player`. Un evento individuale è `team_size = 1`. |

Circuito e lega sono **due entità distinte**, non la stessa macchina con scope diverso. Un evento
può valere per il circuito, per la lega, per entrambi o per nessuno. Circuito e ruleset nascono
insieme: entrambi per-gioco, entrambi di piattaforma — aggiungere un gioco significa aggiungere
anche il suo circuito.

**`Entrant` è l'unica cosa che pairing, risultati, classifica e display in sala conoscono.** Gli
eventi a squadre si pagano qui, una volta sola: nessun altro blocco deve sapere che dentro un
entrant ci sono più persone.

Regole di modellazione ricorrenti:

- **Evento ↔ aggregatore è molti-a-molti con dati propri** (quale aggregatore, moltiplicatore,
  approvato da chi e quando): è un'entità, non un array nel DTO.
- Anche `Entrant` ed `EntrantMember` hanno dati propri (seed, bye residui, stato pagamento,
  qualifica consumata, posizione in coda): stessa trappola.
- `Player` e `Entrant` sono **DTO diversi**: `Player` non contiene le proprie iscrizioni, o il
  grafo esplode. Si annida solo verso il basso.

---

## 2 · Identità del giocatore

- **Nessun merge di profili, mai.** Due profili creati al volo per la stessa persona restano
  distinti per sempre e i punti si spaccano: è una conseguenza accettata.
- **L'unica difesa è rendere difficile sbagliare in creazione.** Il profilo al volo non nasce mai da
  un campo libero: cerca → risultati con fuzzy match → «nessuno di questi» → crea.
- Il profilo nasce `unclaimed`: **cercabile da tutte le organizzazioni**, modificabile solo da
  quella che l'ha creato, rivendicabile con un token. La rivendicazione non è un merge.
- **Esposizione minima:** di un profilo non rivendicato si mostrano solo nome visualizzato e
  organizzazione d'origine, mai contatti. Il profilo pubblico mostra eventi e piazzamenti.
  Titolare del dato è l'organizzazione che l'ha creato, fino alla rivendicazione. Serve
  un'informativa e una procedura di rimozione: è il punto del sistema che le richiede.

---

## 3 · Ruleset e ranking policy

Sono i due oggetti configurabili che costituiscono il vero prodotto.

### Ruleset

I ruleset **li scrive il gestore della piattaforma**. Un'organizzazione può avere ruleset **custom**,
versionati e congelati con lo stesso meccanismo, ma non copiabili da altri e mai promossi a ruleset
di piattaforma. **Un evento con ruleset custom non si aggancia al circuito nazionale** (può stare
in una lega interna).

Il ruleset dichiara:

1. **Forma del risultato** — tre archetipi chiusi, non un DSL: `win_loss_draw` · `best_of_N`
   (conteggio game) · `punteggio_continuo` (soglie che derivano l'esito).
2. **Funzione risultato → punti** — default 3 vittoria / 1 patta / 0 sconfitta. **La patta esiste,
   ma non in tutti i ruleset.**
3. **Tie break** — una lista ordinata di funzioni nominate, coi propri parametri.
4. **Forma della lista/deck e sua validabilità** — validatore dichiarato, o testo libero.
5. **Default operativi** — durata round, best-of, tabella round per fascia di giocatori,
   regime di tempo, late entry, se e quando le liste si bloccano.

### Ranking policy

**Forma fissa parametrizzata**, non un'espressione configurabile: tabella dei punti base per
piazzamento × moltiplicatore di taglia × peso dell'evento. Nessun interprete da scrivere.

- La policy usa il **piazzamento**, non il percorso. È la scelta più semplice e la più criticata
  (due decimi prendono gli stessi punti anche con un numero di vittorie diverso); il moltiplicatore
  di taglia resta l'unico correttivo.
- **Best-N con quote per categoria**: contano i migliori N eventi, con un tetto per taglia
  («al massimo 4 eventi piccoli»). La classifica non è una somma, è una **selezione**.
- Fine stagione: la classifica **si congela** e determina l'ingresso al nazionale e il numero di bye.
- Sono supportati sia i circuiti **a punti** sia quelli **a qualificazione**.

---

## 4 · Architettura a fasi

Il torneo è una sequenza di fasi modulari e concatenabili. Il contratto è uno solo:

> Ogni fase prende **un elenco ordinato di partecipanti** e restituisce **un elenco ordinato di
> partecipanti**.

**L'ordine in ingresso è il seeding, l'ordine in uscita è la classifica.** È la stessa lista che
cambia significato attraversando la fase: è questo che rende possibile la concatenazione.

Davanti a ogni fase può esserci un **gate**, che taglia l'elenco in ingresso con tre criteri:
per posizione · per punti · tutti quelli a pari punteggio con l'n-esimo. **Il gate è separato dalla
fase**: «top 8» non è una proprietà dell'eliminazione diretta, ed è per questo che si può mettere
un taglio anche davanti a una seconda fase svizzera (il day 2).

Fasi disponibili: svizzera · round robin · gironi · eliminazione singola · eliminazione doppia ·
top cut.

Conseguenze:

- **Ogni fase deve saper linearizzare anche quando la sua logica non lo fa.** L'eliminazione produce
  un ordine parziale (i quattro perdenti dei quarti sono tutti «quinti»): ogni tipo di fase dichiara
  la propria regola — per l'eliminazione, prima il round di uscita, poi il seed d'ingresso, in ultima
  istanza il sorteggio registrato.
- **La classifica finale si compone a ritroso**, impilando chi è arrivato in fondo all'ultima fase,
  poi chi è stato tagliato dall'ultimo gate nel suo ordine, poi chi è stato tagliato prima.
  I tagliati non spariscono: si sedimentano.
- **Le impostazioni operative sono per fase, non per evento.** Un top cut in Bo3 dopo una svizzera
  in Bo1 è il caso normale.
- **I punti non si ereditano fra le fasi**, ma la fase può dichiarare di volerlo. Default: no.
- **Il no-rematch vale dentro la fase**, non sull'evento: in un top cut si rigioca contro chi si è
  già incontrato in svizzera.
- **Nelle fasi a eliminazione la patta è disabilitata**: non è un risultato inseribile, si gioca
  fino al vincitore.
- Un gate che non produce una potenza di due genera i **bye del bracket**, assegnati ai seed più alti.
- La classifica dell'evento è **l'output dell'ultima fase**, non lo snapshot dell'ultimo round.

---

## 5 · Creazione dell'evento

- **Template ed eventi ricorrenti** sono in v1: il caso normale non è «creo un evento», è
  *ricreo quello di ogni venerdì*.
- **Il circuito impone il template.** Non è solo un criterio di ammissione a posteriori: è un
  vincolo di configurazione a monte, e il numero di round è fissato dalle regole del circuito.
  I due meccanismi si compongono così: **il template vincola alla creazione, i criteri si verificano
  alla pubblicazione.**
- Fuori dal circuito il motore **deve permettere** di aggiungere o togliere round in corsa.
- **Un evento di circuito che non raggiunge il minimo di giocatori non parte**: la soglia è una
  condizione di avvio, non si gioca declassandolo.
- **Eventi a squadre sì**, con n membri per squadra (non solo due).
- **Tavoli numerati alla maniera tradizionale**: tavolo 1 = i più forti. L'assegnazione del tavolo è
  **output del motore di abbinamento**, non decorazione del display.
- Le date sono tre — apertura iscrizioni, deadline decklist, inizio evento — e negli eventi
  ricorrenti vanno generate come **offset**, non come date assolute.

---

## 6 · Ingresso

### Tre assi ortogonali

Lo stato di un iscritto non è un enum solo, sono tre:

| Asse | Valori |
|---|---|
| **Posto** | prenotato · in lista d'attesa · cancellato |
| **Presenza** | atteso · presente · no-show |
| **Gioco** | attivo · ritirato · squalificato |

Comprimerli è il modo classico per non saper più rispondere a «quanti ne ho in gioco al round 3».
Ne segue che **«numero di partecipanti» non è una domanda sola**: servono tre viste (iscritti ·
presenti · ancora in gioco) e la classifica deve dichiarare a quale si riferisce.

### Posti e coda

- Iscrizione **self-service** fino al massimo, poi **lista d'attesa ordinata**. L'organizzatore può
  iscrivere al banco **solo se ci sono posti liberi**: nessuna corsia che scavalchi la coda.
- **Promozione per offerta a scadenza.** Si libera un posto → il primo in coda riceve un link che
  vale **`min(24 h, apertura del check-in)`**; se non risponde perde il diritto e l'offerta slitta
  al successivo. Il posto resta **riservato** per tutta la durata dell'offerta.
- Il cap è **dell'evento**, non della fase: un evento ha più fasi ma una sola porta d'ingresso.

### Check-in: l'unico punto di congelamento

Il check-in **è separato dall'iscrizione e lo abilita esplicitamente l'organizzatore**, non una
finestra calcolata. Una volta aperto lo fa il giocatore o l'organizzatore per lui.

La sua apertura è **il momento in cui il sistema si congela**: da lì niente più cancellazioni,
niente più offerte automatiche (la scadenza è tagliata lì), e i posti liberi li assegna
l'organizzatore in sala. Un momento solo da implementare e da spiegare, invece di tre regole
scollegate.

All'inizio dell'evento **chi non ha fatto check-in viene droppato**: è un **no-show**, non una
cancellazione — il posto non torna in circolo e il fatto resta nello storico, perché serve alla
lega e alle policy del negozio.

### Liste e deck

- **Il deck è del singolo membro**, non della squadra, ed è un'entità con stati propri:
  `assente → bozza → inviata → bloccata → validata | invalida`. Deadline propria dell'evento,
  validatore dichiarato dal ruleset congelato; senza validatore, testo libero e controllo manuale.
- **Il blocco delle liste lo dichiara il ruleset.** Dove la lista si può cambiare durante l'evento,
  «la lista» non è un campo che si aggiorna: serve sapere **quale versione è stata giocata in quale
  round**, o si perde la tracciabilità per l'arbitraggio e le statistiche.
- **L'evento non parte finché mancano liste.** Nessun drop automatico alla generazione del round 1:
  la via d'uscita è **droppare** l'entrant, e possono farlo organizzatore e head judge. Droppare
  una squadra fa uscire anche i compagni — il che rende il blocco una pressione reale sul capitano.
- La squadra è «pronta» solo se lo sono tutti i membri: la sanzione parte da `EntrantMember`, e
  droppare l'intera squadra è **una scelta esplicita**, non una conseguenza automatica.

### Squadre, quote, qualifiche

- **Il roster si blocca alla chiusura delle iscrizioni** e **non esistono sostituti**: il roster ha
  esattamente la dimensione dei tavoli da schierare. Chi perde un componente all'ultimo gioca in
  inferiorità o si ritira, e a intervenire è l'organizzatore, non il sistema. È rigido di proposito.
- **Quota fuori piattaforma**: importo sull'evento, `stato_pagamento` sull'iscrizione marcato
  dall'organizzatore. Nessun payment processor, nessuna policy di rimborso nel prodotto.
- **La qualifica è un credito nell'account del giocatore**, non un diritto su un evento nominale:
  `{ giocatore, bye: n, scadenza }`, spendibile su qualunque evento del circuito che lo accetti.
  Si consuma **transazionalmente** con la prenotazione (riferimento sull'iscrizione + stato sulla
  qualifica); se l'iscrizione si cancella e la qualifica non è scaduta, torna disponibile.
  Il bye viaggia poi come `bye_rounds` sull'`Entrant` e lo applica il motore di abbinamento.
- **Late entry dichiarato dal ruleset**: `nessuno | con_sconfitte | con_bye`, con finestra fino
  al round N.

---

## 7 · Svolgimento

### Motore di abbinamento

**Matching a peso massimo (blossom pesato)**, non un algoritmo procedurale alla FIDE: tutte le
regole diventano pesi sugli archi e si risolve un massimo accoppiamento, una computazione per round.

- **Il no-rematch è assenza di arco, non un peso**: è l'unico vincolo assoluto, e toglie lavoro al
  solver.
- **Nessun altro vincolo.** Dove la posizione conta (lato, colore, primo turno) l'alternanza è
  **pesata**, mai imposta.
- Pesi tipici: base alta per ogni accoppiamento (la **massima cardinalità viene prima di ogni
  preferenza**) · differenza di punti **quadratica** (due abbinamenti a distanza 1 battono uno a 0
  e uno a 2) · penalità lieve per lato conteso · rompi-pareggi cosmetici.
- **Il bye è un nodo fittizio** collegato a tutti, con peso decrescente nella classifica e una
  penalità enorme (non un'esclusione) per chi ne ha già avuto uno: difficile ma non impossibile.
  Il bye strutturale va al più basso in classifica.
- **La massima cardinalità risolve gratis il problema più insidioso**: un greedy può bloccarsi
  lasciando appaiati due che si sono già incontrati; il blossom, se un abbinamento completo esiste,
  lo trova. Serve, perché **non esiste un pulsante «rigenera»**.
- **Determinismo**: ordinamento stabile degli entrant, a parità di peso vince l'indice più basso,
  `seed` e versione del motore registrati sul round. Il round 1 non usa i pesi: è un mescolamento
  con RNG seedato.

Il motore produce un abbinamento e basta. **L'organizzatore può modificarlo a mano**, e la modifica
**avvisa ma non impedisce mai** — nemmeno se produce una rivincita: in sala l'autorità è
l'organizzatore. L'override finisce nell'audit trail con la motivazione.

### Bye

Esistono **tre bye con origini diverse**: strutturale (numero dispari) · **premiale** (guadagnato in
classifica di stagione, da materializzare *prima* del pairing del round 1, anche per più round) ·
da abbandono. **Il bye è sempre una vittoria piena**, qualunque sia l'origine.

### Ciclo di vita del round

**Tre atti separati:** `genera` (calcolati ma invisibili) → `pubblica` (visibili ai giocatori,
notifica tavolo e posto) → `avvia` (parte il tempo). Il terzo esiste solo per i giochi a tempo.

Stati del round: `bozza | pubblicato | avviato | chiuso | annullato`.

- **Il round successivo non si genera finché mancano risultati.**
- Un round si può **riaprire**. Si annulla **solo il round corrente**; per risalire più indietro si
  annulla a ritroso, uno alla volta. È un'operazione economica solo perché la classifica è un read
  model: annullare è cancellare fatti e ricalcolare, non «disfare» una classifica materializzata.

### Risultati

- Li inserisce **lo staff o un giocatore**. **Un solo inserimento è già valido**; la conferma
  dell'avversario produce solo un **segno visivo**. Nelle squadre basta un membro qualunque.
  Judge e organizzatore possono sovrascrivere.
- **Refertazione contraddittoria → stato `contestato`**: il primo risultato resta valido ai fini
  della classifica, lo staff riceve una notifica e decide. Senza audit trail lo stato `contestato`
  non serve a niente: è esattamente il caso in cui bisogna vedere chi ha scritto cosa e quando.
- **Correzione dopo che il round successivo è già abbinato**: il sistema **propone** un
  ri-abbinamento col diff; se l'organizzatore rifiuta si prosegue con gli abbinamenti attuali ma col
  punteggio corretto. Ha senso solo se il round successivo è generato e **non ancora avviato**: se
  si sta già giocando si corregge solo il punteggio.
- **Il conteggio dei game va registrato anche quando non è stato giocato** (patta intenzionale,
  concessione dopo un game vinto): serve ai tiebreak.
- **Audit trail** su risultati e su modifiche agli abbinamenti.

### Squadre

Il match squadra-contro-squadra ha uno **stato intermedio che nel modello individuale non esiste**:
abbinato ma non ancora spaiato sui tavoli. Lo spaiamento è **manuale e simultaneo cieco** — ogni
capitano ordina i propri membri sui tavoli 1..n senza vedere l'altro; a conferma di entrambi il
sistema rivela e incrocia. Chi non schiera in tempo riceve un'assegnazione automatica casuale
(seedata e registrata).

### Tempo

**Tre regimi:** nessun tempo · **tempo globale di round** con estensione per tavolo · **tempo per
tavolo**. Col tempo globale il cronometro sta sul TV della sala *e* sul telefono di ogni giocatore,
ciascuno col proprio offset di estensione; col tempo per tavolo è sincronizzato fra i giocatori
di quel tavolo.

**Il cronometro è un fatto nel database, non un `setInterval` sul server.** Il server non manda mai
i secondi rimanenti: manda `{ fine_prevista, pausa_accumulata, stato }` più il proprio `now`; il
client calcola l'offset una volta e conta da solo — telefono in tasca, tab in background e
riconnessioni non producono deriva. SSE trasmette solo i cambi di stato, non un tick al secondo.
La pausa sposta `fine_prevista`. L'estensione per tavolo è una `fine_prevista` propria del match, ed
è anche ciò che sposta l'inizio della procedura di fine round. Stessa logica di `RoundTimer`, che
tiene `now = null` fino a `onMounted`.

Nelle fasi a eliminazione, dove la patta non è inseribile, **il cronometro è informativo**: la fine
del tempo non produce un esito. Il ruleset deve poter dichiarare che quella fase non ha esito a tempo.

### Ruoli, penalità, arbitraggio

- **Ruoli per singolo evento**, non per organizzazione: *organizzatore* (chi ha creato il torneo) ·
  *head judge* · *judge* · *scorekeeper*.
- **Un judge può giocare l'evento che arbitra**, ma non deve poter arbitrare, correggere o
  penalizzare il proprio match: è un **controllo di permesso a livello di match**, non di ruolo.
- **Penalità in v1, registrate e con effetto**, **senza upgrade automatico**:

  | Penalità | Effetto |
  |---|---|
  | *warning* | solo verbale, nessuna conseguenza |
  | *game loss* | perde una partita dove esiste un conteggio di partite (`best_of_N`); **vale come match loss dove le partite non esistono** |
  | *match loss* | perde il match |
  | *disqualification* | perde il match corrente, **lascia in piedi i risultati già inseriti**, droppa dall'evento |

  La penalità non ha un effetto proprio: ha una **traduzione** nella forma di risultato dichiarata
  dal ruleset congelato.
- **Chiamata arbitro dal telefono del giocatore**, agganciata al tavolo.

### Modello dati

`Stage` → `Round` → `Match` → `Board`/`Game`.

Il `Match` usa **slot numerati** (`entrant_id`, `result`, `rank`, `forfeit`, `score`) e un
`kind: duel | ffa | bye`, così il duello, il pod e il match di squadra sono lo stesso oggetto.
**In v1 un match mette insieme sempre due entità** (dove un'entità può contenere più giocatori):
i pod con più di due entità sono rimandati, ma **il modello a slot va tenuto lo stesso**, perché è
ciò che permetterà all'FFA di entrare senza riscrivere match, risultati e classifica.

Accanto: `Penalita`, `ChiamataArbitro`, `EstensioneTempo`, log di audit.

---

## 8 · Classifica e tie break

**Tutta la matematica della classifica vive nel ruleset.** Il motore non conosce né `OMW%` né VP:
applica una lista ordinata di funzioni nominate che il ruleset gli passa.

**Catalogo v1:** `OMW%` · `GW%` · `OGW%` · punteggio continuo totale (i VP) · Strength of
Schedule / Buchholz · scontro diretto · numero di vittorie.

**Pavimento e tetto sono parametri della funzione**, non costanti: 33% alla MTG, 25–75% alla
Pokémon, o nessuno.

### Il bye nei tiebreak

Il bye è trattato come **il miglior avversario possibile** — scelta di compensazione opposta a
quella di MTG (che lo esclude) e del Pokémon TCG (che lo ignora): qui il bye non deve penalizzare
nessuno, quindi paga il massimo.

- `MW%` = `punti match ottenuti / (punti per vittoria × round giocati)`; **il bye conta come
  vittoria** sia al numeratore sia al denominatore.
- `OMW%` = media delle `MW%` degli avversari; **ogni bye aggiunge un avversario virtuale con
  `MW% = 100%`**.
- `GW%` = `partite vinte / partite giocate`; il bye aggiunge **il punteggio pieno di partite**
  previsto dal ruleset (2-0 in un Bo3).
- `OGW%` = come `OMW%`, con l'avversario virtuale a `GW% = 100%`.
- Ogni percentuale passa per `max(pavimento, min(tetto, valore))`, **avversario virtuale compreso**:
  con un tetto al 75% il bye vale 75%, non 100%.

**Due effetti voluti da riconoscere quando si guarderà una classifica strana:** chi riceve bye
premiali ha un `OMW%` strutturalmente gonfiato, e il bye strutturale — che va al più basso in
classifica — dà proprio a quel giocatore la resistenza massima.

**Vittoria per forfait, per ritiro dell'avversario o per penalità non è un bye**: è un avversario
reale che ha perso, e conta come una vittoria normale con le percentuali vere di quell'avversario.

### Altre regole

- **Il ritirato resta in classifica alla sua posizione**, col suo record.
- Parità che sopravvive a tutti i tiebreak → **sorteggio**, con il seed **salvato come fatto**:
  un sorteggio non registrato renderebbe la classifica non riproducibile.
- **Squadre:** la classifica primaria sono i match point dell'incontro; **nessuna classifica
  individuale** dentro l'evento a squadre. I singoli tavoli restano comunque registrati, quindi
  win rate e matchup del giocatore sono calcolabili: è la *classifica* individuale a non esistere,
  non il dato.
- **Bracket:** il seeding si congela all'inizio del round; una correzione arrivata prima dell'inizio
  lo rifà. Un taglio che non è potenza di due assegna **bye ai seed più alti** fino a riempire il
  bracket — l'opposto della svizzera, ed è corretto: contesti diversi.

### Snapshot

- La classifica pubblicata è **congelata all'ultimo round chiuso**. Durante un round via SSE
  viaggiano abbinamenti, cronometro e stato dei tavoli, **mai la classifica**.
- **Uno snapshot per round**, calcolato alla chiusura: la storia («com'era dopo il round 3») è
  gratis, il seed del bracket è lo snapshot del round n, e annullare un round è cancellare uno
  snapshot. Riaprire un round invalida il suo snapshot e i successivi.
- **Il ricalcolo dal log resta l'autorità** e un comando di riparazione, non il percorso normale.

---

## 9 · Post-torneo, circuiti e leghe

- **La pubblicazione è un atto manuale dell'organizzatore**, con **scadenza a 7 giorni**; chi sfora
  prende un warning all'organizzazione — che è **un'entità** (chi, quando, perché, quale evento),
  non un contatore.
- **Le condizioni le conferma l'aggregatore**: zero match contestati · zero risultati mancanti ·
  minimo giocatori. Per il **circuito** si aggiunge il ruleset non custom; per la **lega interna**,
  che pubblica con lo stesso meccanismo, quella condizione **non si applica** — altrimenti i ruleset
  custom sarebbero inutilizzabili proprio nel loro caso d'uso.
- **Ammissione**: automatica per criteri al circuito nazionale; decisa dall'organizzatore per la
  lega del negozio.
- Un evento pubblicato si può **correggere e ritirare**. Ma correggerlo obbliga a rieseguirlo con
  la sua policy congelata, e se il suo punteggio cambia possono cambiare i **best-N di giocatori
  che a quell'evento non c'erano**: **il ricalcolo si propaga a tutta la stagione** e va progettato
  come job, non come effetto sincrono di una `PATCH`.
- **I bye si emettono da soli**: alla chiusura dell'evento per gli eventi che ne prevedono, alla
  chiusura della stagione se sono premio di classifica. Si registra quanti e a chi; finiscono
  nell'account del giocatore e scadono al circuito successivo (di norma un anno).
- **Quote di emissione in v1**: quante qualifiche può emettere un evento, quanti eventi può ospitare
  un'organizzazione.
- **Rating (Elo/Glicko) per i circuiti che lo supportano**, tenuto **separato dai punti di
  circuito**: i punti sono stagionali e si azzerano, il rating misura la forza corrente e non si
  azzera mai. Serve un rating, non i punti, il giorno in cui si volesse abbinare per forza.
- **Statistiche del giocatore: tutto tranne fazione e archetipo.** Sono un secondo read model sul
  log: si decide *cosa* esporre, non come calcolarlo.
- **Profilo pubblico:** un estraneo vede gli eventi a cui il giocatore ha partecipato e il
  piazzamento.

---

## 10 · Trappole tecniche da non dimenticare

- **La capienza ha tre stati, non due**: occupato · *riservato da un'offerta* · libero. Un controllo
  `iscritti < cap` è sbagliato per costruzione. È la sorgente di bug numero uno, va difesa con un
  **vincolo in database** — e **PGlite, connessione singola senza pool, non la farà emergere in
  sviluppo**.
- **L'offerta di posto è un'entità con storico**, non un campo: `{ posizione_in_coda, emessa_il,
  scade_il, token, esito }`. «A chi è stata offerta e chi non ha risposto» è esattamente la domanda
  che farà l'organizzatore quando qualcuno protesta.
- **La scadenza dell'offerta è un job** (pg-boss): alla scadenza non basta invalidare, bisogna
  **emettere l'offerta successiva** — è un effetto, non una vista calcolabile a lettura. La lettura
  resta comunque difensiva: un'offerta scaduta e non processata non è valida.
- **Il link dell'offerta funziona senza login** (token monouso) e **deve essere idempotente**: i
  client di posta fanno prefetch dei link, e un GET che accetta il posto lo accetterebbe da solo.
- **Il ricalcolo di stagione è un job**, non una richiesta HTTP.
- **L'RD di Glicko decade con l'inattività**: il rating cambia anche quando non succede niente.
  Serve un job periodico o un calcolo pigro con data dell'ultimo aggiornamento. È **l'unico numero
  del sistema che non è funzione pura del log**.
- **Il blossom non è deterministico se i pesi pareggiano**: serve un tie-break stabile, sempre.

---

## 11 · Fuori dalla v1

Pod e match a più di due entità (FFA) — ma il modello a slot resta · punteggi soft (pittura,
sportività) · merge di profili giocatore (mai) · pagamenti in piattaforma · sostituti nel roster ·
upgrade automatico delle penalità · classifica individuale negli eventi a squadre.
