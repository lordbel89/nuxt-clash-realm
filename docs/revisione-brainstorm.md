# Revisione del brainstorm

Documento di lavoro per togliere le contraddizioni da `brainstorm.md`. Un argomento alla volta,
con il metodo di sempre: **ricerca → domande → decisioni → conseguenze**. Solo quando un argomento
è deciso, `brainstorm.md` viene aggiornato e qui resta la traccia del perché.

## Argomenti, in ordine di dipendenza

| # | Argomento | Stato |
|---|---|---|
| 1 | Il log: che cos'è la fonte di verità | chiuso |
| 2 | Riproducibilità: cosa si riesegue e cosa si salva come fatto | chiuso |
| 3 | Confine fra configurazione e codice («aggiungere un gioco») | chiuso |
| 4 | Il bye nei tiebreak: scelta globale o parametro del ruleset | chiuso |
| 5 | No-rematch quando un abbinamento completo non esiste | chiuso |
| 6 | Continuità fra fasi: punti e no-rematch | chiuso |
| 7 | Proprietà dell'evento e ruoli: organizzazione o persona | chiuso |
| 8 | Dipendenze infrastrutturali: mailer, push, SSE, pg-boss, deploy | chiuso |
| 9 | Minori e profili non rivendicati | chiuso |
| 10 | Sala senza rete | chiuso |
| 11 | Date ricorrenti, fusi orari, ora legale | chiuso |
| 12 | Glossario e lingua dei nomi | chiuso |
| 13 | Perimetro della v1 e milestone | chiuso |
| 14 | Allineamento con il modello del frontend | chiuso |

---

## 1 · Il log

### Il problema nel testo attuale

Il documento usa «log» in punti che chiedono cose diverse:

- §0.1 — «il log dei match è la fonte di verità», ogni classifica è ricalcolabile da lì.
- §0.4 — rieseguire un round a mesi di distanza deve dare lo stesso risultato.
- §7 — annullare un round è «**cancellare fatti** e ricalcolare».
- §7 — audit trail su risultati e abbinamenti; lo stato `contestato` serve solo se si vede «chi ha
  scritto cosa e quando».
- §8 — uno snapshot per round; il ricalcolo dal log è l'autorità ma è un comando di riparazione.
- §9 — correggere un evento pubblicato si propaga a tutta la stagione.

Cancellare fatti e avere un audit trail non stanno insieme se il log è append-only; se invece il log
sono le righe correnti, «log» è la parola sbagliata e l'audit è un'altra cosa. Finché non si sceglie,
nessuna tabella del torneo è disegnabile.

### Ricerca

#### Tre famiglie di modello

**A · Event sourcing.** Lo stato è la sequenza di eventi, append-only; lo stato corrente è una
proiezione ricostruibile. Gli eventi non si modificano né si cancellano: una correzione è un **evento
compensativo** che si aggiunge. Una variante tiene l'evento e lo marca come annullato
(`undone`, `undoneAt`) e le letture lo ignorano; nasce dal fatto che la compensazione perde la
distinzione fra un fatto naturale e una correzione.

Costi documentati:
- è un pattern complesso, cambia come si interroga, si versiona e si gestisce la concorrenza, ed è
  **costoso migrarci dentro o fuori** (Microsoft);
- gli event store sono pessimi da interrogare: servono proiezioni per ogni lettura (Microsoft, Greg Young);
- Greg Young e Udi Dahan: **non come architettura di tutto il sistema**, ma dentro un singolo
  bounded context;
- lo schema degli eventi va versionato per sempre: un evento scritto oggi va capito fra tre anni.

**B · Stato corrente + storico.** Righe mutabili, più una tabella di storia scritta da trigger o
dall'applicazione. Un trigger generico è poco codice e copre tutte le tabelle, ma registra il *cosa*
e non il *perché* né l'utente applicativo (a meno di passarli come variabili di sessione), e chi ha i
permessi di superutente può disattivarlo (Cybertec). Postgres 18 ha introdotto i vincoli temporali
(`WITHOUT OVERLAPS`, `PERIOD`) ma solo per il tempo applicativo: **niente system versioning**, lo
storico automatico va costruito a mano.

**C · Ibrido.** Append-only solo nel contesto dove la storia *è* il dominio, stato mutabile altrove.
È la forma che Young e Dahan indicano come uso corretto.

#### Audit log ed event store non sono la stessa cosa

Oskar Dudycz: un event store registra gli *esiti*, un audit log deve registrare anche l'*intenzione*
(il comando), l'utente, i permessi, i tentativi falliti. Un event store rende l'audit più facile ma
non lo fornisce da solo, e lo stesso risultato si ottiene con un database tradizionale più un
outbox. Conclusione esplicita: **se l'audit è l'unico motivo, l'event sourcing non è giustificato.**
Motivi validi sono altri: interpretazioni multiple degli stessi fatti, nessuna perdita di informazione,
diagnostica.

#### Come il dominio tratta le correzioni

**Scacchi — FIDE C.04.2.**
- Art. 4.3: un errore di risultato segnalato *dopo l'abbinamento ma prima della fine del turno
  successivo* incide sull'abbinamento seguente; segnalato *dopo*, si corregge **solo a torneo finito
  e solo per il rating**.
- Art. 4.4: gli abbinamenti pubblicati non si modificano, salvo casi elencati (rivincita accidentale,
  regolamento che lo prevede, accordo fra i giocatori, iscrizioni tardive).
- Art. 1.4: arbitri diversi o programmi diversi approvati **devono arrivare agli stessi abbinamenti**.
  Il pairing checker legge il TRF e **ricostruisce il torneo turno per turno**, confrontando ogni
  abbinamento con quello che il motore avrebbe prodotto.

Da notare: il checker funziona solo perché la FIDE rinvia le correzioni tardive a torneo finito. Se un
risultato cambiasse dopo l'abbinamento del turno successivo, la ricostruzione produrrebbe abbinamenti
diversi da quelli giocati. La riproducibilità degli abbinamenti richiede di sapere **cosa si sapeva
nel momento in cui si è abbinato**, non cosa è vero oggi: sono due tempi diversi (bitemporalità).

**Magic — MTR e Melee.gg.**
- MTR 1.9 (annotato): l'autorità finale sulle correzioni di scorekeeping è l'head judge, che «può
  dettare la soluzione che ritiene opportuna». Nessuna procedura automatica.
- Melee.gg: prima del turno successivo il risultato si modifica e basta; ad abbinamento fatto si
  modifica, ma bisogna verificare a mano che gli abbinamenti restino accettabili; a turno iniziato si
  corregge il risultato e **gli abbinamenti con ogni probabilità restano**. Nessun undo automatico,
  nessuna storia generata dal sistema.

**Eliminazione — Challonge.** Riaprire o cambiare l'esito di un match concluso **azzera tutti i
match che ne dipendono** nel bracket.

**TopDeck.gg.** Un turno concluso si modifica in qualsiasi momento e la classifica si ricalcola
subito. Anche punteggi e tiebreak si cambiano in configurazione, e **tutte le classifiche vengono
rivalutate con le impostazioni nuove**: esattamente il comportamento che il §0.2 vieta.

#### Cosa emerge

- In tutti gli strumenti esaminati **gli abbinamenti sono salvati, mai ricalcolati**. Quello che si
  ricalcola è la classifica.
- La correzione tardiva è ovunque un **atto umano con autorità**, non un effetto a cascata.
- Nell'eliminazione diretta la dipendenza è strutturale (il vincitore avanza), nella svizzera no: una
  correzione in svizzera cambia la classifica, non il tabellone.
- Le operazioni del brainstorm che chiedono storia sono: più refertazioni dello stesso match
  (contestato), override degli abbinamenti con motivazione, annullamento e riapertura di un round,
  penalità, snapshot per round, correzione di un evento già pubblicato.

### Fonti

- Microsoft, [Event Sourcing pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- Greg Young, [CQRS and Event Sourcing, Code on the Beach 2014](https://www.kurrent.io/blog/transcript-of-greg-youngs-talk-at-code-on-the-beach-2014-cqrs-and-event-sourcing)
- Oskar Dudycz, [Is the audit log a proper architecture driver for Event Sourcing?](https://event-driven.io/en/audit_log_event_sourcing/)
- planetgeek, [Event Sourcing: undo set-remove-based bi-temporal events](https://www.planetgeek.ch/2026/07/14/event-sourcing-undo-set-remove-based-bi-temporal-events-because-we-must/)
- Cybertec, [Row change auditing options for PostgreSQL](https://www.cybertec-postgresql.com/en/row-change-auditing-options-for-postgresql/)
- Better Stack, [Temporal Constraints in PostgreSQL 18](https://betterstack.com/community/guides/databases/postgres-temporal-constraints/)
- FIDE, [C.04.2 General handling rules for Swiss Tournaments](https://handbook.fide.com/chapter/GeneralHandlingRulesForSwissTournaments202602)
- FIDE, [Verification Checklist per i programmi approvati](https://handbook.fide.com/files/handbook/C04Annex4_VCL19.pdf)
- Magic Judges, [MTR 1.9 Scorekeeper](https://blogs.magicjudges.org/rules/mtr1-9/)
- Melee.gg, [Fixing Incorrect Results](https://help.melee.gg/docs/fixing-incorrect-results/)
- Challonge, [How to Edit Match Results](https://kb.challonge.com/en/article/how-to-edit-match-results-1bf545k/)
- TopDeck.gg, [Running an event](https://topdeck.gg/help/running-a-tournament)

### Decisioni

1. **Niente event sourcing: stato corrente più storico** (famiglia B). La fonte di verità è lo stato
   attuale dei fatti del torneo; basta sapere com'è il torneo adesso e chi ha cambiato cosa. Non si
   chiede di ricostruire cosa sapeva il sistema al momento di un abbinamento.
2. **Annullare non cancella.** I fatti di un round annullato restano consultabili nello storico,
   marcati come annullati.
3. **Perimetro dei fatti con storico:** risultati, abbinamenti, override, penalità, drop, check-in,
   sorteggi.
4. **Una riga di risultato per match, più lo storico delle sue modifiche.** Le refertazioni non sono
   fatti distinti.
5. **Un evento pubblicato si corregge in loco**, e la stagione si ricalcola (come job, §9).
6. **L'audit riguarda solo il torneo**, e basta che l'applicazione non possa modificarlo: nessuna
   protezione contro chi accede direttamente al database.

### Conseguenze sul modello

- **§0.1 va riscritto.** Non c'è un «log dei match»: la fonte di verità sono i **risultati correnti**.
  Il principio che resta intatto è l'altra metà: la classifica è un read model ricalcolabile, nessun
  punteggio è un campo che si aggiorna.
- **§7, annullamento.** «Cancellare fatti» diventa **marcare come annullati**: abbinamenti e risultati
  del round restano, con chi l'ha annullato e quando, e le letture li escludono. Lo snapshot del round
  si scarta, come già previsto.
- **§8.** Il ricalcolo parte dai risultati correnti non annullati; lo snapshot per round resta com'è,
  una cache con una storia gratuita.
- **§10.** La frase sul rating Glicko («l'unico numero che non è funzione pura del log») diventa «dei
  risultati».
- **Refertazione contraddittoria (§7) con una riga sola.** Il primo risultato resta nella riga, come
  già deciso; la seconda refertazione, che non lo sostituisce, **finisce nello storico come tentativo
  respinto** che porta il match a `contestato`. Lo stesso vale per la conferma dell'avversario: è una
  voce di storico che accende il segno visivo, non un secondo risultato. È il caso previsto da Dudycz:
  un audit registra anche le intenzioni che non hanno cambiato lo stato.
- **Input per l'argomento 2.** La decisione 1 toglie la base al §0.4 («rieseguirlo a mesi di distanza
  deve dare lo stesso risultato»): gli abbinamenti sono fatti salvati, non qualcosa da rieseguire.
  Resta da decidere a cosa servono ancora seed e versione del motore.

### Proposte tecniche

- **Lo storico lo scrive l'applicazione, non un trigger.** Il trigger vede la riga ma non l'utente
  applicativo né la motivazione, e la motivazione è obbligatoria per gli override. Ogni comando del
  torneo passa da un solo helper del servizio che, **nella stessa transazione** della modifica,
  scrive la voce di storico: `{ evento, entità, id, azione, attore, motivazione, prima, dopo, quando }`,
  con `prima`/`dopo` in `jsonb`.
- **Una tabella di storico per tutto il torneo**, non una per entità: le domande che le si fanno sono
  «cos'è successo in questo evento» e «cos'è successo a questo match», entrambe filtri su una tabella
  sola.
- **L'applicazione non la può modificare, per costruzione:** in produzione il ruolo Postgres
  dell'applicazione ha solo `INSERT` e `SELECT` su quella tabella. Costa due righe di `GRANT` e rende
  la decisione 6 un vincolo invece di una convenzione. Con PGlite, utente unico, in sviluppo non vale.

### Decisioni sui punti aperti

7. **La correzione si applica anche a stagione chiusa.** Lo scopo è proprio sistemare gli errori,
   compreso chi ha ricevuto un invito che non gli spettava. «Si congela» (§3) diventa «si chiude»: non
   entrano nuovi eventi, ma la classifica resta correggibile.
8. **I crediti non più dovuti si revocano e si emettono al nuovo avente diritto.**
9. **Proposte tecniche approvate**: storico scritto dall'applicazione, una tabella sola, `INSERT` e
   `SELECT` soltanto.

### Applicato a `brainstorm.md`

§0.1 (risultati correnti come fonte di verità, storico) · §0.3 (il motore prende risultati, non un
log) · §3 (la stagione si chiude, non si congela) · §7 (override con motivazione obbligatoria,
annullamento che marca e non cancella, refertazione contraddittoria su una riga sola, nuova sottosezione
*Storico del torneo*, modello dati) · §8 (ricalcolo dai risultati correnti, snapshot come cache) ·
§9 (correzione in loco anche a stagione chiusa, crediti con origine e riallineamento) · §10 (il job di
stagione riallinea i crediti, Glicko non è funzione pura dei risultati).

**Non toccato di proposito:** §0.4, che dipende dall'argomento 2.

### Casi limite sui crediti

10. **Credito già speso: resta speso.** L'iscrizione resta, il risultato dell'evento resta valido.
    Principio generale: si corregge ciò che è ancora correggibile; ciò che è troppo tardi per
    correggere non si corregge.
11. **Credito arrivato tardi: si assegna comunque**, e il giocatore lo usa al prossimo evento utile.

Conseguenze dedotte, applicate al §9: la scadenza di un credito riassegnato parte dall'emissione
effettiva; un riallineamento può superare la quota di emissione dell'evento, e la quota non lo
blocca.

**Argomento chiuso.**

---

## 2 · Riproducibilità

### Il problema nel testo attuale

Il documento chiede riproducibilità in molti punti, sempre con la stessa formula:

- §0.2 — ricalcolare significa rieseguire ogni evento con la versione di ruleset e policy congelata.
- §0.4 — ogni casualità è seedata; seed e versione del motore stanno sul round; «rieseguirlo a mesi
  di distanza deve dare lo stesso risultato».
- §4 — l'ultima istanza per linearizzare un'eliminazione è il sorteggio registrato.
- §7 — determinismo del motore (ordinamento stabile, a parità di peso vince l'indice più basso); il
  round 1 è un mescolamento con RNG seedato; lo spaiamento automatico delle squadre è seedato.
- §7 — correzione dopo che il round successivo è abbinato: il sistema **propone un ri-abbinamento
  col diff**.
- §8 — parità residua risolta per sorteggio, con il seed salvato come fatto.
- §10 — il blossom non è deterministico se i pesi pareggiano.

Dopo l'argomento 1 gli abbinamenti e i sorteggi sono **fatti salvati** con il loro storico, e non si
chiede di ricostruire cosa sapeva il sistema al momento dell'abbinamento. La frase del §0.4 resta
senza oggetto: non c'è niente da rieseguire a mesi di distanza, perché l'esito è già registrato.
Resta da capire a cosa servono seed e versione, e dove la riproducibilità serve davvero.

### Ricerca

#### Tre calcoli diversi, tre esigenze diverse

Il brainstorm usa «riproducibile» per tre calcoli che dopo l'argomento 1 hanno uno statuto diverso:

| Calcolo | Esito | Si ricalcola? |
|---|---|---|
| Abbinamento di un round | salvato come fatto | no |
| Sorteggio (round 1, parità residua, spaiamento squadre, linearizzazione) | salvato come fatto | no |
| Classifica e tiebreak di un evento, classifica di stagione | read model | **sì, sempre**: a ogni correzione, a ogni ricalcolo di stagione, anche a un anno di distanza |

La riproducibilità nel tempo serve quindi soprattutto al terzo, che è proprio quello a cui il §0.4
non pensa.

#### Negli scacchi il determinismo è un requisito di fiducia

- FIDE C.04.2 art. 1.4: arbitri o programmi diversi devono arrivare agli **stessi abbinamenti**. È
  il motivo per cui esiste il pairing checker: chiunque abbia il file del torneo può verificare che
  nessuno abbia abbinato a mano.
- Il sistema olandese FIDE non usa casualità nel round 1: ordina per rating. Il determinismo è totale
  e non serve un seed.
- Le regole cambiano: il sistema olandese ha una versione in vigore fino al 31 gennaio 2026 e una
  dal 1° febbraio 2026. Ogni verifica deve sapere con quale versione è stato giocato il torneo.
- Lo studio di Führlich, Cseh e Lenzner implementa sistemi svizzeri diversi (Dutch, Burstein,
  Monrad) con un solo approccio: **tutte le regole diventano pesi di un unico matching a peso
  massimo**, un calcolo per round. È la stessa architettura del §7.

#### Fuori dagli scacchi il seed nasce per la verificabilità

EDH_matchmaker (motore per Commander) chiede un seed opzionale perché con lo stesso seed, gli stessi
giocatori e gli stessi risultati **chiunque abbia il log possa riprodurre il torneo**: pod, bye,
posti a sedere, tiebreak. Le domande aperte che la issue stessa elenca sono proprio le nostre: dove
si registra il seed quando gli abbinamenti vengono rifatti, e se ogni round deriva il proprio RNG dal
seed del torneo e dal numero del round.

#### Anche i tiebreak cambiano nel tempo

- Play! Pokémon, aggiornamento del 4 dicembre 2024: il ritardo **non è più il primo tiebreak**.
  L'ordine dei tiebreak è cambiato a metà stagione.
- RK9 documenta come si calcolano resistance, bye e ritirati nel Pokémon TCG, ma non dice se le
  classifiche degli eventi passati si ricalcolano quando la regola cambia.
- TopDeck.gg (argomento 1) **rivaluta tutte le classifiche con le impostazioni correnti**: è
  l'opposto del §0.2.

Un ricalcolo di stagione a un anno di distanza produce la stessa classifica solo se le funzioni di
tiebreak di allora esistono ancora e si comportano come allora.

#### Il numero stesso non è stabile nel tempo

In JavaScript somma, sottrazione, moltiplicazione e divisione sono esatte secondo IEEE 754 e danno
lo stesso risultato ovunque. Le funzioni di `Math` no: la specifica lascia margine ai motori, e
`Math.pow(1/3, 3)` è cambiata fra Node 10 e Node 12 (macwright). Un tiebreak che confronta
percentuali calcolate con `Math` può cambiare ordine dopo un aggiornamento di Node, senza che
nessuno tocchi il codice.

#### Dove il determinismo serve **adesso** e non fra un anno

La proposta di ri-abbinamento col diff (§7) ricalcola un round con il risultato corretto e mostra
cosa cambia. Il diff ha senso solo se il motore, a parità di input, dà lo stesso output: altrimenti
mostra differenze dovute al caso e non alla correzione. Qui serve il determinismo **nello stesso
momento e con la stessa versione**, non a mesi di distanza.

### Fonti

- FIDE, [C.04.2 General handling rules for Swiss Tournaments](https://handbook.fide.com/chapter/GeneralHandlingRulesForSwissTournaments202602)
- FIDE, [C.04.3 Dutch System, in vigore fino al 31 gennaio 2026](https://handbook.fide.com/chapter/C0403Till2025) e [dal 1° febbraio 2026](https://handbook.fide.com/chapter/C0403202602)
- Führlich, Cseh, Lenzner, [Improving Ranking Quality and Fairness in Swiss-System Chess Tournaments](https://arxiv.org/abs/2112.10522)
- EDH_matchmaker, [Optional random seed for reproducible tournaments](https://github.com/eVen-gits/EDH_matchmaker/issues/44)
- Pokémon, [Play! Pokémon Rules & Regulations Updated for Q4 2024](https://www.pokemon.com/us/news/play-pokemon-rules-regulations-updated-for-q4-2024)
- RK9, [All about tiebreakers in the Pokémon TCG](https://rk9.gg/article/20210525-all-about-tiebreakers-in-the-pokemon-tcg)
- Tom MacWright, [Math keeps changing](https://macwright.com/2020/02/14/math-keeps-changing.html)

### Decisioni

1. **A ogni round corrisponde un solo esito del motore.** Ogni cambiamento successivo è un override
   con motivazione, nello storico.
2. **Il seed si salva** insieme all'esito, e **lo verifica solo lo staff**.
3. **La proposta di ri-abbinamento col diff (§7) resta.**
4. **Il motore non si aggiorna durante un evento**, di norma. Se succede, l'evento passa alla versione
   nuova. Il round generato porta una **firma** che permette di ricostruirlo con la versione che l'ha
   creato.
5. **Il ricalcolo usa il codice di oggi**: un evento passato può cambiare classifica. Ricalcolare un
   evento terminato è però un atto eccezionale, riservato agli errori gravi e ai bug.

### Come le decisioni si incastrano

- **1 e 3 sembrano in conflitto** (un solo esito, ma un secondo calcolo dopo una correzione) e non lo
  sono, se il seed del round è fisso: **stesso input, stesso esito**. Rigenerare senza cambiare
  niente restituisce lo stesso abbinamento, quindi un pulsante «rigenera» è inutile per costruzione,
  non per divieto. Il ri-abbinamento dopo una correzione dà un esito diverso perché l'input è
  cambiato, e il diff mostra **solo** l'effetto della correzione.
- **4 e 5 sembrano in conflitto** (ricostruire con la versione di allora, ma ricalcolare con il codice
  di oggi) e non lo sono, perché riguardano calcoli diversi. La firma serve a **verificare un
  abbinamento**, che è un fatto e non si ricalcola. Il codice di oggi serve a **ricalcolare una
  classifica**, che è un read model.
- **La firma chiede l'input di allora.** Per rieseguire un abbinamento servono entrant, risultati e
  configurazione come erano al momento della generazione. L'argomento 1 ha escluso di ricostruire
  cosa sapeva il sistema in generale; qui basta molto meno, cioè salvare sul round **l'input che il
  motore ha ricevuto**. È un'istantanea locale di pochi KB, non bitemporalità.
- **Il §0.2 resta, ma parla di configurazione e non di codice.** Ruleset e ranking policy sono dati
  versionati e congelati all'uso; il codice che li applica è sempre quello corrente.

### Conseguenze sul modello

- **§0.4 va riscritto.** Seed e versione non servono a rieseguire (l'esito è un fatto) ma a
  **verificare**. «Rieseguirlo a mesi di distanza deve dare lo stesso risultato» diventa «deve
  poter essere verificato con la versione che l'ha prodotto».
- **§0.2** chiarisce che si congela la configurazione, non il codice.
- **§7, determinismo.** Resta com'è; aggiunge il seed fisso per round e la conseguenza «stesso input,
  stesso esito».
- **§8, snapshot.** Per un evento terminato la classifica mostrata è **l'ultimo snapshot**. Un deploy
  non ricalcola niente da solo: il ricalcolo di un evento terminato è un comando esplicito, e finisce
  nello storico di quell'evento.

### Proposte tecniche

1. **Firma di generazione sul round**: `{ versione_motore, seed, input }`, con `input` in `jsonb`: gli
   entrant nell'ordine in cui il motore li ha ricevuti, i punteggi considerati, le coppie vietate, la
   configurazione della fase. Verificare significa `motore(input, seed) == abbinamento salvato`.
2. **Il seed lo genera il server**, con un generatore crittografico, una volta sola alla creazione del
   round, e non cambia più. Nessuno lo sceglie, nemmeno lo staff. Il ri-abbinamento dopo una
   correzione riusa lo stesso seed.
3. **Il motore è un pacchetto con una versione propria**, puro come vuole il §0.3. Un round generato
   dalla versione corrente si verifica dall'applicazione. Uno generato da una versione precedente si
   verifica eseguendo quella versione fuori dall'applicazione, da riga di comando, come fa il pairing
   checker FIDE. L'applicazione non conserva il codice delle versioni vecchie.
4. **La matematica della classifica usa solo le quattro operazioni, `min` e `max`**: niente `Math.pow`
   o altre funzioni che cambiano fra versioni di Node. I valori di tiebreak si arrotondano a una
   precisione dichiarata prima del confronto, così due valori uguali in teoria sono uguali anche in
   pratica.
5. **Un solo sorteggio per entrant invece di un sorteggio a ogni parità.** All'avvio dell'evento ogni
   entrant riceve un numero casuale (dal seed dell'evento), che è l'ultimo tiebreak ovunque: parità
   residua in classifica (§8) e linearizzazione dell'eliminazione (§4). Il motivo è il ricalcolo:
   oggi una correzione può cambiare il gruppo dei pari merito, e il sorteggio salvato per il gruppo
   di prima non si applica più a quello nuovo. Con un numero per entrant il problema non esiste.

### Decisioni sui punti aperti

6. **Proposte tecniche approvate**, compreso il numero di sorteggio per entrant.
7. **Manipolare l'input non si impedisce**: basta che resti visibile nello storico.

### Applicato a `brainstorm.md`

§0.2 (si congela la configurazione, non il codice) · §0.4 (riscritto: ogni esito è un fatto, seed e
versione servono a verificare) · §1 (numero di sorteggio fra i dati dell'entrant) · §4 (ultima istanza
della linearizzazione) · §7 (un solo esito per round, firma di generazione, motore come pacchetto
versionato, manipolazione visibile, ri-abbinamento con lo stesso seed, spaiamento automatico delle
squadre) · §8 (numero di sorteggio al posto dei sorteggi a ogni parità, matematica con le sole quattro
operazioni, evento terminato servito dall'ultimo snapshot) · §10 (il tie-break stabile del blossom è
la condizione di «stesso input, stesso esito»).

**Argomento chiuso.**

---

## 3 · Confine fra configurazione e codice

### Il problema nel testo attuale

- §0.5 — «aggiungere un gioco è configurazione, non codice. Se una regola nuova richiede un deploy,
  è finita nel posto sbagliato».
- §3 — il ruleset dichiara la forma del risultato (tre archetipi chiusi: `win_loss_draw`,
  `best_of_N`, `punteggio_continuo`), la funzione risultato → punti (default 3/1/0), i tiebreak
  come lista ordinata di funzioni nominate, la forma della lista e il suo **validatore dichiarato**,
  i default operativi.
- §3 — la ranking policy è una forma fissa parametrizzata: «nessun interprete da scrivere».
- §8 — «tutta la matematica della classifica vive nel ruleset»; il motore applica un catalogo di
  funzioni nominate.

Due cose non tornano. Un validatore di liste per un gioco di carte ha bisogno del database delle
carte e delle regole di legalità di quel gioco: è codice e dati esterni, non configurazione. E un
tiebreak che non è nel catalogo, o una forma di risultato che non rientra nei tre archetipi, è a sua
volta codice. Il principio è vero solo per i giochi che rientrano in ciò che il motore sa già fare.

### Ricerca

#### Il limite della configurazione

Mike Hadlow, *The Configuration Complexity Clock*: un'applicazione parte con valori scritti nel
codice, li sposta in configurazione, poi in gerarchie di configurazione, poi in un motore di regole
con interfaccia, poi in un DSL; e alla fine torna a scrivere tutto nel codice, «in un linguaggio
molto peggiore». Due osservazioni utili qui:
- oltre una certa complessità **scrivere la regola nel codice è il male minore**;
- con il deploy continuo, cambiare codice è rapido quanto cambiare configurazione: il motivo
  originale per spostare tutto in configurazione non c'è più.

Il brainstorm si ferma già prima del motore di regole (tre archetipi chiusi, «non un DSL»,
«nessun interprete»): è la posizione che Hadlow difende. La domanda è dove passa il confine.

#### Cosa fanno le piattaforme multi-gioco

**TopDeck.gg** (oltre 20 giochi di carte): punti e tiebreak si configurano per evento; il circuito
combina «gruppi di punti» (piazzamento, metriche di classifica, record di partite) con somma, media o
best-N. La sua documentazione dice che **non esistono configurazioni specifiche per gioco**: il
punteggio funziona allo stesso modo per Magic, Pokémon, Yu-Gi-Oh. Ai publisher promette di andare
online «in giorni», senza team di sviluppo.

**Melee.gg**: validazione automatica delle liste **solo per Magic e Star Wars: Unlimited**. Per ogni
altro gioco la lista si invia come testo e l'organizzatore la controlla a mano. I giochi supportati
sono un elenco curato: per uno nuovo bisogna contattarli.

**Limitless TCG** (Pokémon e giochi Bandai): la lista si valida automaticamente contro i formati
ufficiali; in un formato custom controlla **solo che le carte esistano e che i conteggi siano giusti**.
Fasi: svizzera, eliminazione singola, round robin, bracket singolo e doppio; da Bo1 a Bo5; regole
aggiuntive per Pokémon (singleton, monotipo e simili).

**Best Coast Pairings** (wargame): la lista si carica come testo esportato dai builder dei giocatori
(per esempio Warscroll Builder per Age of Sigmar) e il controllo lo fa l'organizzatore.

Il quadro: **punteggi e tiebreak sono configurazione ovunque; la validazione delle liste è codice per
gioco ovunque**, e dove non c'è quel codice resta il testo con il controllo manuale — che è già il
ripiego previsto dal §3.

#### La validazione dipende da dati esterni che cambiano

- **Magic**: Scryfall pubblica ogni giorno i dati di tutte le carte in bulk (JSONL compresso), con la
  legalità di ogni carta per formato: `legal`, `not_legal`, `restricted`, `banned`. Le liste dei
  bandi cambiano più volte l'anno.
- **Pokémon**: la legalità in Standard dipende dal **regulation mark** stampato sulla carta; per la
  stagione 2026 sono legali H, I e J. La rotazione è annuale, con eccezioni per le ristampe
  equivalenti.
- **Wargame**: nessuna fonte ufficiale; i punti delle unità cambiano con aggiornamenti periodici, e le
  liste arrivano dai builder dei giocatori.

Un validatore è quindi tre cose: un parser del formato di esportazione, un database di carte o unità
da sincronizzare, le regole di legalità del formato alla data dell'evento.

#### I tre archetipi di risultato contro i giochi del mock

Il mock del frontend usa Magic, Warhammer 40.000, Blood Bowl e Catan.

- **Magic**: `best_of_N` con conteggio dei game. Rientra.
- **Blood Bowl** (NAF): il default è 2/1/0 per vittoria, patta, sconfitta, ma i **touchdown e le
  casualty di entrambi i giocatori** vanno sul referto e sono i tiebreak (differenza touchdown,
  differenza casualty). Sono **due contatori** per lato, mentre `punteggio_continuo` ne prevede uno.
- **Warhammer 40.000**, formato WTC: i 20 punti di torneo della partita **si dividono** in base alla
  differenza di punti vittoria, a scaglioni di 5 (0–5 di differenza è 10-10, 51 o più è 20-0). **Le
  vittorie non si contano**: cinque 11-9 valgono meno di tre 20-0 e due 0-20. Non è una funzione
  vittoria/patta/sconfitta → punti, ma una funzione punteggio → **ripartizione dei punti**. Il formato
  ITC invece somma i punti vittoria più 1000 per la vittoria e 500 per la patta.
- **Catan**: partita a più giocatori, rimandata con l'FFA (§11).

La forma del risultato dichiarata al §3 copre bene i giochi di carte e male i wargame, che sono metà
dei giochi del mock.

### Fonti

- Mike Hadlow, [The Configuration Complexity Clock](https://mikehadlow.blogspot.com/2012/05/configuration-complexity-clock.html)
- TopDeck.gg, [Circuits, scoring, and leaderboards](https://topdeck.gg/help/circuit-leaderboards-management), [Running an event](https://topdeck.gg/help/running-a-tournament), [Publishers](https://topdeck.gg/publishers)
- Melee.gg, [Decklists For Organizers](https://help.melee.gg/docs/decklists-for-organizers/)
- Limitless TCG, [Tournament Settings](https://docs.limitlesstcg.com/organizer/reference)
- AoS Shorts, [Best Coast Pairings review](https://aosshorts.com/best-coast-pairings-review-and-update/)
- Scryfall, [Bulk Data Files](https://scryfall.com/docs/api/bulk-data), [Card Objects](https://scryfall.com/docs/api/cards)
- Poké-Geek, [Regulation marks and card legality](https://www.poke-geek.fr/en-us/blogs/infos/marques-reglement-pokemon-verifier-legalite-standard)
- NAF, [Regulations for Tournaments 2026](https://www.thenaf.net/tournaments/nafdocs/naf-regulations-for-tournaments/)
- Down Under Pairings, [Battle Scorecards](http://www.downunderpairings.com/wiki/index.php/tournament-organisers/14-battle-scorecards)

### Decisioni

1. **Nella v1 le liste sono testo libero con controllo manuale.** La validazione automatica arriva
   dopo, gioco per gioco e formato per formato.
2. **Quando arriverà, la validazione dipende dalle fonti esterne ufficiali** di ogni gioco, e vale la
   **legalità alla data dell'evento**.
3. **La v1 si ferma ai tre archetipi di risultato attuali.** I wargame con più contatori per lato o
   con punti ripartiti in base allo scarto restano fuori.
4. **I ruleset di piattaforma sono file del repository**, e arrivano con il deploy.
5. **I ruleset custom delle organizzazioni cambiano solo i parametri del catalogo.**
6. **Esiste anche il torneo senza preset.** L'organizzatore non parte da nessun ruleset e sceglie
   tutto lui: tipo di abbinamento, punti, tiebreak, pavimenti, tempi, e così via, fra le varianti che
   il progetto implementa. **Ogni variante di regola è un modulo** che l'organizzatore sceglie.

### Come le decisioni si incastrano

Le decisioni 4, 5 e 6 descrivono due livelli, e il brainstorm finora li confondeva:

| Livello | Cos'è | Dove vive | Chi lo cambia |
|---|---|---|---|
| **Catalogo dei moduli** | le varianti di regola implementate: archetipi di risultato, funzioni punti, tiebreak, tipi di fase e di abbinamento, criteri di gate, regimi di tempo, late entry | codice del motore | sviluppo, con un deploy |
| **Composizione** | una scelta di moduli con i loro parametri | preset di piattaforma: file del repository · composizione dell'organizzatore: dato | gestore della piattaforma · organizzatore |

Un ruleset è quindi **una composizione**. Il preset di un gioco è una composizione scritta dal gestore
in un file; il torneo senza preset è una composizione scritta dall'organizzatore in un modulo di
creazione; il ruleset custom della decisione 5 è una composizione dell'organizzatore, salvata per
riusarla. Sono la stessa cosa con tre origini diverse.

Ne segue che il §0.5 va riscritto. Con la decisione 4 aggiungere un gioco richiede un deploy (un file
nuovo), quindi «se una regola richiede un deploy è nel posto sbagliato» non è più vero. Il confine
giusto è un altro: **aggiungere un gioco che rientra nel catalogo significa scrivere una composizione,
non toccare il motore**. Una regola che il catalogo non ha è un modulo nuovo, cioè codice, ed è
giusto che lo sia.

C'è una seconda conseguenza, meno visibile. Il §0.2 congela la versione del ruleset all'uso, ma un
preset che è un file del repository **cambia a ogni deploy** e le versioni vecchie non restano da
nessuna parte. Se l'evento conservasse solo un riferimento al preset, un ricalcolo userebbe il file
di oggi.

### Conseguenze sul modello

- **§0.5** riscritto come sopra.
- **§1 e §3.** Il circuito nasce con il **preset** del suo gioco, non con un ruleset qualsiasi.
- **§3, ruleset.** Diventa la descrizione dei due livelli. Le cinque cose che il ruleset «dichiara»
  sono le categorie del catalogo. La lista del deck, nella v1, è sempre testo libero con controllo
  manuale; i validatori sono moduli futuri, per gioco e per formato, alimentati dalle fonti ufficiali,
  con la legalità alla data dell'evento.
- **§3, circuito.** «Un evento con ruleset custom non si aggancia al circuito nazionale» vale per ogni
  composizione che non sia il preset del circuito, compreso il torneo senza preset.
- **§4.** Le impostazioni sono già per fase: la composizione è **una scelta di moduli per ogni fase**,
  più quelle che valgono per tutto l'evento (forma del risultato, punti, cap).
- **§6, liste e deck.** Nella v1 `validata` e `invalida` le decide lo staff.
- **§11, fuori dalla v1:** validazione automatica delle liste; forme di risultato con più contatori
  per lato o con punti ripartiti in base allo scarto (Blood Bowl, Warhammer 40.000 formato WTC).

### Proposte tecniche

1. **L'evento conserva la composizione risolta**, non un riferimento: alla creazione copia moduli e
   parametri effettivi in un `jsonb`, più l'origine (`preset:<gioco>@<versione>`, `custom:<id>`,
   `libera`). Il ricalcolo legge quella copia, quindi il §0.2 regge anche se il file del preset
   cambia. Il riferimento resta per sapere da dove viene, e per il circuito, che ammette solo il
   proprio preset.
2. **Un preset è un file TypeScript tipato**, non JSON: è il catalogo stesso a dare i tipi, quindi un
   preset che usa un modulo inesistente o un parametro sbagliato non compila. La composizione
   dell'organizzatore arriva invece dal client e passa per uno schema Valibot generato dallo stesso
   catalogo.
3. **Il catalogo dichiara ogni modulo con i suoi parametri e i loro limiti** (per esempio il pavimento
   di un tiebreak fra 0 e 1). Da quella dichiarazione nascono sia il modulo di creazione del torneo
   sia la validazione: un modulo nuovo compare nell'interfaccia senza scrivere interfaccia.

### Decisioni sui punti aperti

7. **Il gioco è testo libero**, anche per i tornei senza preset, e conta per le statistiche e per il
   profilo pubblico.
8. **Il ruleset custom non è un'entità a sé**: la composizione si salva nel template.
9. **Si può partire da un preset e modificarlo**; la composizione diventa custom ed esce dal circuito.
10. **Proposte tecniche approvate.**

Conseguenza dedotta, applicata al §3: la ranking policy è di piattaforma come il preset, quindi vive
allo stesso modo — file del repository, con l'evento di circuito che ne conserva la copia vigente.

### Applicato a `brainstorm.md`

§0.2 (l'evento conserva una copia di ruleset e policy) · §0.5 (riscritto: un gioco è una composizione,
una regola nuova è un modulo) · §1 (circuito e preset nascono insieme) · §3 (riscritto: due livelli,
tre origini della composizione, schema generato dal catalogo, copia sull'evento, liste in testo
libero nella v1, gioco in testo libero, ranking policy come file) · §5 (il template contiene la
composizione, il circuito impone il preset) · §6 (validata o invalida la decide lo staff) · §8 (la
matematica vive nei moduli) · §9 (circuito solo col preset non modificato) · §11 (validazione
automatica e forme di risultato dei wargame fuori dalla v1).

**Argomento chiuso.**

---

## 4 · Il bye nei tiebreak

### Il problema nel testo attuale

Il §8 dice «tutta la matematica della classifica vive nei moduli del catalogo» e poi, subito dopo,
fissa per tutti una scelta sul bye: **il bye vale come il miglior avversario possibile**, un
avversario virtuale al 100% (con il tetto della funzione, se c'è). Il testo stesso la presenta come
opposta a Magic e a Pokémon e ne ammette due effetti collaterali: chi riceve bye premiali ha un
`OMW%` gonfiato, e il bye strutturale dà la resistenza massima proprio al più basso in classifica.

Dopo l'argomento 3 la contraddizione è netta: i tiebreak sono moduli con parametri, l'organizzatore
compone il proprio torneo scegliendoli, e i preset di piattaforma devono poter riprodurre i
tiebreak ufficiali dei giochi. Una regola fissa sul bye impedisce tutte e tre le cose.

### Ricerca

#### Il bye ha due effetti distinti

In un tiebreak basato sugli avversari (`OMW%`, resistenza, Buchholz) il bye entra da due lati:

- **(a) nella mia lista di avversari**: il round di bye è un avversario che manca. Va escluso, o
  sostituito da un avversario virtuale, e con quale valore?
- **(b) nel mio record visto dai miei avversari**: quando un mio avversario calcola il proprio
  `OMW%`, usa il mio `MW%`. Il mio bye conta lì come una vittoria, o si toglie?

Il brainstorm risponde solo alla (a).

#### Magic — MTR, Appendice C

- Chi riceve un bye **ha vinto il match 2-0**: 3 punti match e 6 punti game, nel proprio `MW%` e
  `GW%`.
- **I bye si ignorano** nel calcolo di `OMW%` e `OGW%`: nell'esempio ufficiale un 6-2 con un bye al
  primo round fa la media su sette avversari invece che su otto.
- Pavimento dello 0,33 su `MW%` e `GW%` di ogni avversario.
- Il ritirato conta per i round che ha giocato.

Quindi: (a) **esclusione**; (b) il bye **conta come vittoria** nel record che vedono gli avversari.

#### Pokémon — RK9 sulle regole Play! Pokémon

- Resistenza: vittoria 1, patta 0,5, sconfitta 0, media sugli avversari, **pavimento 25%** per ogni
  avversario.
- **Il bye si esclude** dalla propria resistenza: contano solo gli avversari reali.
- **Il bye di un avversario non conta nel suo contributo**: il suo record, visto da me, è senza bye.
- Il ritirato contribuisce con il record al momento del ritiro (1-2 → 33,3%).

Quindi: (a) **esclusione**; (b) il bye **si toglie** anche dal record visto dagli avversari. È la
differenza con Magic, e il brainstorm la descriveva come «lo ignora».

#### Scacchi — FIDE C.07, in vigore dal 1° marzo 2026

Il regolamento distingue cinque categorie di round non giocati (art. 16.2): bye assegnato
dall'abbinamento, vittoria a forfait, bye richiesto seguito da round giocati, sconfitta a forfait,
bye richiesto non seguito da altri round.

- (b) Per i tiebreak degli avversari (art. 16.3) le prime quattro categorie valgono **per il
  risultato assegnato**: un bye da un punto vale come vittoria. L'ultima vale come patta.
- (a) Per i propri tiebreak (art. 16.4) ogni round non giocato è una partita contro un **avversario
  fittizio con il punteggio del giocatore stesso**, con un tetto: per i forfait, il punteggio
  dell'avversario previsto; per gli altri casi, i punti di una patta moltiplicati per il numero di
  round, cioè il 50%.

Il tetto è la correzione dell'aggiornamento 2026: prima l'avversario fittizio prendeva il punteggio
pieno del giocatore, e un giocatore forte con un bye si trovava un Buchholz gonfiato. È lo stesso
effetto che il brainstorm ammette per i bye premiali, e la FIDE l'ha trattato come un difetto.

#### Quattro trattamenti per il lato (a)

| Trattamento | Chi lo usa | Effetto del bye sul tiebreak |
|---|---|---|
| **Esclusione** | Magic, Pokémon | neutro: la media si fa sugli avversari reali |
| **Avversario fittizio al proprio punteggio, con tetto** | FIDE (2026) | neutro rispetto alla propria prestazione, limitato al 50% |
| **Avversario fittizio al punteggio pieno** | FIDE (2023–2026) | favorevole ai giocatori forti; corretto dal tetto |
| **Avversario virtuale al 100%** | brainstorm, §8 | massimo per chiunque, anche per l'ultimo in classifica |

Nessuna delle fonti usa il quarto.

#### Vittoria a forfait e per ritiro

Il brainstorm dice che non è un bye: l'avversario reale ha perso e conta con le sue percentuali
vere. Magic e Pokémon fanno lo stesso. La FIDE invece tratta anche la vittoria a forfait come un
round non giocato, con l'avversario fittizio al punteggio dell'avversario previsto.

### Fonti

- Magic Judges, [MTR Appendix C — Tiebreaker Explanation](https://blogs.magicjudges.org/rules/mtr-appendix-c/)
- RK9, [All about tiebreakers in the Pokémon TCG](https://rk9.gg/article/20210525-all-about-tiebreakers-in-the-pokemon-tcg)
- FIDE, [C.07 Play-Off and Tie-Break Regulations, dal 1° marzo 2026](https://handbook.fide.com/chapter/TieBreakRegulations032026)
- PlayVibeChess, [Buchholz score: FIDE 2026 rules](https://playvibechess.com/buchholz-score-chess)

### Decisioni

1. **Il trattamento del bye è un parametro** dei moduli di tiebreak: ogni gioco e ogni organizzatore
   lo usa in base alle proprie esigenze.
2. **Default del torneo libero: esclusione, come Pokémon.**
3. **Il preset riproduce le regole ufficiali del proprio gioco.**
4. **Anche il lato (b) è un parametro**: il bye nel record visto dagli avversari conta come vittoria o
   si toglie.
5. **Le origini del bye si trattano allo stesso modo.**
6. **La vittoria a forfait resta un avversario reale che ha perso.** Non presentarsi equivale ad aver
   giocato e perso; dopo la sconfitta chi non si è presentato viene droppato.

### Conseguenze sul modello

- **§8, «Il bye nei tiebreak», riscritto**: due parametri indipendenti, le varianti trovate, la
  tabella dei default (torneo libero, Magic, Pokémon). Il 100% resta come una delle varianti
  (`avversario_fittizio_fisso`), non come la regola; i suoi due effetti collaterali restano
  documentati, riferiti a quella variante.
- **§7, «Bye»: le origini diventano due.** Il «bye da abbandono» del brainstorm originale era il caso
  in cui l'avversario droppa ad abbinamenti fatti. Con la decisione 6, e con quanto il §8 già diceva,
  quello è un avversario reale che ha perso, non un bye.
- **§7, «Risultati»**: non presentarsi è perdere, poi il drop.
- **§8**: la vittoria a forfait si separa di proposito dalla FIDE, che la tratta come round non
  giocato.

### Applicato a `brainstorm.md`

§7 (due origini del bye, l'abbandono non è un bye, non presentarsi è perdere e poi il drop) · §8 (bye
nei tiebreak come due parametri, default per origine della composizione, forfait come avversario
reale).

### Decisioni sul punto aperto e aggiunte

7. **Il drop per mancato arrivo si annulla solo finché gli abbinamenti del round successivo non sono
   stati generati.** Dopo è definitivo.
8. **I bye premiali possono essere più di uno nello stesso evento**: con tre bye un giocatore salta i
   primi tre turni. Se i crediti si sommano è una regola del circuito; quanti bye premiali si possono
   usare in un evento lo decide il circuito, o l'organizzatore nel torneo libero.

Applicato al §7 (annullamento del drop, bye premiali multipli e limite per evento).

### Decisioni sui bye premiali

9. **Nel torneo libero i bye premiali li assegna l'organizzatore a mano**, all'iscrizione o
   dall'elenco dei partecipanti, prima del primo abbinamento. Non si spendono crediti.
10. **Oltre il limite**: il giocatore ne usa fino al limite, gli altri restano sull'account.
11. **Cumulativi** significa che i bye vinti in eventi diversi si sommano.

Applicato al §7.

### Conseguenza sul modello, da confermare

Il §6 descrive la qualifica come un credito unico `{ giocatore, bye: n, scadenza }` che si consuma
con la prenotazione. Con le decisioni 8, 10 e 11 non regge più: un credito da tre bye su un evento
che ne ammette due andrebbe spezzato, e bye di origini diverse devono sommarsi. Invito al nazionale e
bye sono due cose che si spendono in modo diverso.

**Proposta:** separare i due crediti.
- `Qualifica { giocatore, circuito, origine, scadenza }` — il diritto di iscriversi, si consuma per
  intero.
- `CreditoBye { giocatore, circuito, origine, scadenza }` — **un bye per riga**. Un piazzamento che
  vale tre bye emette tre righe. Spendere due bye è consumare due righe, e il resto resta
  disponibile senza spezzare niente; sommare bye di eventi diversi è contare righe.

Due regole che ne discendono e che vanno confermate:
- **Quali bye si consumano per primi**: quelli che scadono prima.
- **Circuito non cumulativo**: in un evento si usano solo bye della stessa origine, e il sistema
  sceglie l'origine che ne ha di più.

**Confermata**, con le due regole. Applicata al §6 (due crediti distinti, consumo, ordine di spesa,
circuito non cumulativo) e al §9 (emissione di un `CreditoBye` per bye).

**Argomento chiuso.**

---

## 5 · No-rematch quando un abbinamento completo non esiste

### Il problema nel testo attuale

- §7 — «il no-rematch è assenza di arco, non un peso: è l'unico vincolo assoluto».
- §7 — «il blossom, **se un abbinamento completo esiste**, lo trova».
- §5 — fuori dal circuito il motore deve permettere di **aggiungere round in corsa**.
- §7 — l'organizzatore può modificare a mano, la modifica avvisa ma non impedisce mai, «nemmeno se
  produce una rivincita».

Il documento dice cosa succede quando l'abbinamento esiste, non quando manca. E il §5 garantisce che
prima o poi mancherà: un organizzatore che aggiunge round a un torneo piccolo esaurisce gli
avversari mai incontrati.

### Ricerca

#### Il limite matematico

Wikipedia, *Swiss-system tournament*: il numero di round consigliato è il logaritmo in base 2 dei
giocatori, arrotondato per eccesso (3 round fino a 8 giocatori, 4 fino a 16). Esiste poi un **limite
naturale pari alla metà dei giocatori, arrotondata per eccesso**: oltre, il torneo può trovarsi
senza un round possibile, o con giocatori costretti a rigiocare.

Il limite si spiega con un risultato classico di teoria dei grafi. Dopo `r − 1` round senza
rivincite ogni giocatore ha incontrato `r − 1` avversari, quindi nel grafo delle coppie ancora
possibili ciascuno ha `n − r` vicini. Se `r ≤ n / 2` quel grafo ha grado almeno `n / 2`, e per il
teorema di Dirac contiene un ciclo hamiltoniano, quindi un abbinamento completo (con `n` pari; con
`n` dispari il nodo del bye rende pari il conteggio). In pratica: **fino a metà dei giocatori come
numero di round, un abbinamento senza rivincite esiste sempre**, qualunque cosa sia successa nei round
precedenti. Oltre, può mancare.

Due conseguenze che il brainstorm non considera:
- **i drop abbassano il limite a torneo in corso.** Otto iscritti e quattro round sono dentro il
  limite; se due giocatori si ritirano dopo il round 2, restano sei giocatori e il limite scende a
  tre. Il round 4 può non avere un abbinamento, anche senza che nessuno abbia aggiunto round;
- **le fasi a round robin non hanno il problema**: il calendario è fissato all'inizio.

#### FIDE — sistema olandese, dal 1° febbraio 2026

- [C1] Due giocatori non si incontrano più di una volta. [C2] Chi ha già avuto un bye assegnato
  dall'abbinamento, o una vittoria senza giocare, non ne riceve un altro. Entrambi sono **criteri
  assoluti**.
- [C4] Criterio di completamento: l'abbinamento parziale deve sempre lasciare un abbinamento valido
  per i giocatori rimasti. Serve agli algoritmi procedurali, che abbinano gruppo per gruppo; il
  matching a peso massimo lo soddisfa per costruzione, perché risolve il round tutto insieme.
- Art. 1.9.3: **se completare l'abbinamento di un round è impossibile, decide l'arbitro capo.** La
  FIDE non prevede un ripiego automatico: il sistema si ferma e passa la mano a una persona.

#### Nelle altre fonti

- Le guide concordano che la rivincita è forzata solo quando si superano i round possibili, e che il
  software la evita finché può.
- Sul forum di Board Game Arena un utente descrive il comportamento del loro svizzero con il vincolo
  di no-rematch, in un torneo di partite a sei giocatori con 24 iscritti: già al secondo round i
  vincitori finiscono contro gli ultimi, perché tutti gli altri violano il vincolo. Il caso è
  multigiocatore, dove il limite arriva molto prima, ma il meccanismo è lo stesso. È l'effetto che il peso quadratico sulla differenza di
  punti del §7 produce quando gli archi «giusti» mancano: niente rivincite, ma abbinamenti sempre
  più sbilanciati.
- Play! Pokémon: un torneo valido richiede almeno quattro giocatori, tre round completi, e un
  avversario valido — mai incontrato — per ognuno fino al terzo round; se i ritiri lo rendono
  impossibile, **il torneo non è valido**.

#### Il bye come secondo vincolo

Con `n` dispari il problema raddoppia: il nodo del bye è collegato a tutti con una penalità enorme
per chi l'ha già avuto (§7). Quando mancano abbinamenti, il solver può dover scegliere fra una
rivincita e un secondo bye. La FIDE rende assoluti entrambi; il brainstorm rende assoluto il primo e
pesato il secondo, quindi preferirà sempre un secondo bye a una rivincita. Nessuna delle due scelte è
dichiarata come tale.

### Fonti

- Wikipedia, [Swiss-system tournament](https://en.wikipedia.org/wiki/Swiss-system_tournament)
- FIDE, [C.04.3 FIDE (Dutch) System, dal 1° febbraio 2026](https://handbook.fide.com/chapter/C0403202602)
- FIDE, [C.04.1 Basic rules for Swiss Systems](https://doc.fide.com/docs/DOC/2025_3FC/CM3-202517.pdf)
- Board Game Arena, [Swiss system: match distribution problem](https://forum.boardgamearena.com/viewtopic.php?t=28338&start=20)
- Chess Tournament Guide, [How Swiss pairings work](https://chesstournamentguide.com/tournament-guide/how-swiss-pairings-work/)
- Pokémon, [Play! Pokémon Tournament Rules Handbook, 2025](https://media.pocketmonsters.net/pdf/play-pokemon-tournament-rules-handbook-en-2025-01-01.pdf)

### Decisioni

1. **Quando un abbinamento completo senza rivincite non esiste, il motore ammette rivincite** con una
   penalità enorme, e produce comunque un abbinamento.
2. **Il sistema avvisa, non impedisce**, quando i round superano il limite.
3. **Un secondo bye è peggio di una rivincita.**
4. **Il comportamento vale per tutti**: non è un parametro del modulo di abbinamento.

Sulla domanda 3 («cosa dice il blossom?»): il blossom non ha preferenze, massimizza la somma dei
pesi. Quale male scegliere lo decidono i pesi che gli diamo. Nel brainstorm la rivincita era
un'assenza di arco e il secondo bye un peso, quindi il motore avrebbe sempre scelto il secondo bye
senza che nessuno l'avesse deciso. Ora è una scelta dichiarata.

### Conseguenze sul modello

- **§7, motore.** Non ci sono più vincoli assoluti, solo sei livelli di priorità **lessicografici**:
  cardinalità, secondo bye, rivincita, differenza di punti, lato, rompi-pareggi. Ogni livello pesa
  più della somma massima di quelli sotto, così una preferenza minore non può mai comprare una
  violazione maggiore, e le rivincite, quando servono, sono il minimo possibile. Con pesi interi
  (argomento 2) e sei livelli, i numeri vanno calcolati in `BigInt` o dimensionati sotto 2⁵³.
- **Il secondo bye conta i bye di ogni origine**, premiali compresi: è la decisione 5 dell'argomento 4
  (le origini si trattano allo stesso modo) applicata all'abbinamento.
- **§7.** Un round in `bozza` con rivincite o secondi bye mostra un avviso prima della pubblicazione.
- **§5.** Avviso quando i round superano metà dei giocatori, anche a torneo in corso.
- **§10.** I drop abbassano il limite: l'avviso si ricalcola a ogni drop.
- **§7, firma di generazione.** L'input non contiene più «coppie vietate» ma coppie già incontrate e
  bye già ricevuti: sono pesi, non divieti.

### Applicato a `brainstorm.md`

§5 (avviso sul numero di round) · §7 (priorità lessicografiche, secondo bye peggio della rivincita,
avviso in bozza, input della firma) · §10 (i drop abbassano il limite).

**Argomento chiuso.**

---

## 6 · Continuità fra fasi

### Il problema nel testo attuale

- §4 — il contratto di una fase è «un elenco ordinato in ingresso, un elenco ordinato in uscita».
- §4 — il gate è separato dalla fase, ed è per questo che «si può mettere un taglio anche davanti a
  una seconda fase svizzera (il day 2)».
- §4 — «i punti non si ereditano fra le fasi, ma la fase può dichiarare di volerlo. **Default: no**».
- §4 — «il no-rematch vale dentro la fase, non sull'evento».

L'esempio che il documento usa per giustificare il gate separato, il day 2, è proprio il caso in cui
i due default sono sbagliati. E un elenco ordinato non basta a una fase che deve continuare la
precedente: per non ripetere le coppie e per calcolare `OMW%` servono gli avversari e i risultati,
non solo la posizione.

### Ricerca

#### Magic — il day 2 è la stessa svizzera

- Regional Championship: nove round di svizzera il primo giorno, servono **18 punti match** per
  passare; il secondo giorno **sei round di svizzera in più**, poi top 8 a eliminazione singola.
- Mondiale XXVII: «tutti i giocatori passano al day 2: **classifiche e tiebreak si portano dietro**».
- Nello stesso Mondiale, **i vincoli di abbinamento si azzerano dopo il round 7**: nella porzione
  Standard due giocatori possono incontrarsi una volta nei round 4-7 e di nuovo nei round 8-10, anche
  in round consecutivi. Chi arriva a sette vittorie prima del round 10 passa subito al top 4 e riceve
  bye nei round svizzeri che restano.
- Forum dei judge Magic: i giocatori non si incontrano quasi mai due volte in svizzera, **tranne negli
  eventi multi-formato**. Un Pro Tour con draft nei round 1-3 e constructed nei round 4-8 applica il
  no-rematch **per porzione di formato**, e le coppie del draft possono ripetersi in constructed. Le
  regole esatte dell'algoritmo non sono in nessun documento ufficiale.

Quindi in Magic il day 2 **non è una fase nuova**: è la stessa svizzera con un taglio a punti fra un
round e l'altro. Punti, tiebreak e storia degli avversari continuano. E l'ambito del no-rematch non
coincide con la fase: può essere più stretto (una porzione di formato) o azzerarsi dopo un certo round.

#### Pokémon — stesso schema

Regional e International: passano al **day 2 delle svizzere** tutti quelli con almeno 19 punti match,
oppure i primi 32 se sono di più; dopo il day 2, il top 8 va a eliminazione singola. Anche qui il day
2 è la continuazione della svizzera, non un torneo nuovo.

#### Calcio — gironi e poi eliminazione

Mondiale 2026: nel primo turno a eliminazione le prime dei gironi incontrano seconde o terze, e **le
squadre dello stesso girone sono tenute separate**. Il tabellone non si sorteggia: la posizione nel
girone decide lo slot, secondo uno schema fissato in anticipo. I punti del girone non passano al
tabellone, ma la storia sì, sotto forma di **vincolo sul tabellone**: evitare di rigiocare subito una
partita già giocata nella fase precedente.

#### Cosa emerge

- La continuità fra due fasi ha **tre componenti indipendenti**: i punti, la storia degli avversari
  (per il no-rematch), i dati per i tiebreak (per `OMW%` e simili). Nel day 2 si ereditano tutte e
  tre; fra girone e tabellone nessuna delle tre, ma la storia serve a comporre il tabellone.
- **L'ambito del no-rematch è indipendente dalla fase**: nel top cut non vale (il brainstorm lo dice
  già), in una svizzera multi-formato vale per porzione, al Mondiale si azzera dopo un round dato.
- Il contratto «elenco ordinato in ingresso» regge fra fasi **di tipo diverso** (svizzera → top cut,
  gironi → tabellone), dove serve un seeding e basta. Non regge quando una fase **continua** la
  precedente.

### Fonti

- Star City Games, [Regional Championship Milwaukee Viewer's Guide](https://articles.starcitygames.com/magic-the-gathering/regional-championship-milwaukee-viewers-guide/)
- Magic.gg, [Magic World Championship XXVII — Information for Invitees](https://magic.gg/events/magic-world-championship-xxvii-information-for-invitees)
- Magic Judges Forum, [Pairing Algorithm](https://apps.magicjudges.org/forum/topic/8245/)
- Pokémon, [Internationals 2022 — FAQ](https://www.pokemon.com/us/play-pokemon/internationals/2022/north-america/frequently-asked-questions)
- Sportico, [World Cup Knockout Seeding Rules](https://www.sportico.com/leagues/soccer/2026/world-cup-seeding-rules-tiebreakers-us-bosnia-herzegovina-1234937062/)
- Wikipedia, [2026 FIFA World Cup knockout stage](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage)

### Decisioni

1. **Il day 2 è una seconda fase svizzera**, che eredita dalla prima.
2. **Punti, storia degli avversari e dati di tiebreak sono tre parametri di eredità separati.**
3. **Nel top cut le rivincite sono ammesse senza penalità**, come già nel brainstorm.

Domande 3 e 4, riformulate con esempi:

4. **I casi del no-rematch più stretto si modellano come fasi consecutive senza gate**, che ereditano
   punti e tiebreak ma non la storia degli avversari: evento multi-formato (draft poi constructed) e
   azzeramento dopo un round dato (Mondiale Magic XXVII).
5. **L'evento multi-formato è in v1**: ogni fase può avere il proprio formato di gioco e la propria
   lista.
6. **Dai gironi al tabellone la composizione è un parametro**: classifica complessiva (**default**,
   1° contro 8° a prescindere dal girone) oppure incrocio fisso.

### Deduzioni, confermate e corrette

- **Default di eredità per coppia di fasi: confermati.** Svizzera → svizzera eredita tutto;
  qualunque fase → eliminazione non eredita niente.
- **«Incrociato per classifica complessiva» era una lettura sbagliata**: il default è la classifica
  complessiva pura, 1° contro 8° a prescindere dal girone. La terza opzione con separazione dei
  gironi è tolta. Di conseguenza anche gironi → tabellone **non eredita niente**: la storia degli
  avversari serviva solo alla separazione, e l'incrocio fisso usa girone e posizione nel girone, che
  la fase a gironi espone da sé.

**Argomento chiuso.**

### Applicato a `brainstorm.md`

§3 (moduli operativi: eredità, tabellone, formato e lista per fase) · §4 (l'elenco ordinato non basta
sempre, tre eredità separate, day 2 come seconda svizzera che eredita, default per coppia di fasi,
ambito del no-rematch come catena di fasi, fasi consecutive senza gate, composizione del tabellone)
· §6 (lista per fase nell'evento multi-formato).

---

## 7 · Proprietà dell'evento e ruoli

### Il problema nel testo attuale

- §1 — l'organizzazione è «proprietaria degli eventi e dello staff».
- §7 — «ruoli per singolo evento, **non per organizzazione**: *organizzatore* (**chi ha creato il
  torneo**) · head judge · judge · scorekeeper».
- §3, §5, §9 — template, leghe interne, quote di eventi e warning per pubblicazione tardiva sono
  tutti **dell'organizzazione**.
- Roadmap dell'autenticazione (decisa il 2026-09-06): con il plugin `organization` di Better Auth il
  torneo passerà da `organizerId: UserId` a `organizationId`.

Il §1 e il §7 danno due proprietari diversi allo stesso evento. Se l'organizzatore è chi ha creato il
torneo, un evento resta senza responsabile quando quella persona lascia l'organizzazione. Se invece
il proprietario è l'organizzazione, «ruoli per singolo evento, non per organizzazione» non dice chi,
dentro l'organizzazione, può creare eventi e gestirne lo staff.

### Ricerca

#### Better Auth, plugin `organization`

- Ruoli predefiniti: **owner** (controllo completo), **admin** (tutto tranne cancellare
  l'organizzazione e cederne la proprietà), **member** (sola lettura sulle risorse
  dell'organizzazione).
- Ruoli custom con `createAccessControl()`: si dichiarano risorse e azioni, e ogni ruolo è un
  sottoinsieme. Con `dynamicAccessControl` un'organizzazione può creare ruoli propri a runtime.
- Un utente può stare in **più organizzazioni**; quella attiva sta nella sessione.
- **Gli inviti richiedono l'invio di un'email** (`sendInvitationEmail`), e il progetto non ha ancora
  un mailer.
- **I permessi valgono su tutta l'organizzazione**, non su una singola risorsa: non esiste un ruolo
  «judge di questo evento». I team raggruppano membri ma seguono gli stessi permessi.

#### Come fanno le piattaforme

| Piattaforma | Proprietario | Livelli di staff | Ruoli |
|---|---|---|---|
| **Wizards EventLink** | il negozio | solo negozio | Store Owner (accetta i termini WPN), Store Admin (crea ed esegue eventi, aggiunge staff), Scorekeeper (esegue eventi, non li crea, non cambia impostazioni) |
| **Melee.gg** | l'organizzazione | **due**: organizzazione (accesso a tutti i suoi tornei) e torneo (accesso a uno solo) | Staff Admin, Scorekeeper (crea e abbina i round), Judge (deck check, penalità, risultati), Coverage (nomi dei mazzi) |
| **start.gg** | il torneo | per torneo | Administrator (tutto, pagamenti ed export), Manager (iscritti, bracket, risultati), Bracket Manager, Reporter (solo risultati) |
| **Challonge** | l'evento | per evento | Admin, Event Manager, Tournament Manager, Event Assistant (check-in e risultati) |

Melee è l'unico con due livelli, ed è il caso che il brainstorm descrive senza dirlo: l'organizzazione
ha il suo staff fisso, e un judge esterno si aggiunge a un torneo solo.

#### MTR 1.3 — ruoli del torneo

Sei ruoli: **Tournament Organizer**, **Head Judge**, **Floor Judge**, **Scorekeeper**, Player,
Spectator; i primi quattro sono ufficiali di gara. Una persona può ricoprire **qualunque combinazione**
di ruoli ufficiali, cosa normale negli eventi piccoli. Può fare l'ufficiale chiunque **tranne chi
gioca il torneo, a meno che il torneo non lo permetta esplicitamente**. Il brainstorm ammette il judge
che gioca come regola generale; per l'MTR è un'eccezione che l'evento deve dichiarare.

#### Cosa emerge

- **Proprietario e responsabile sono due cose.** Tutte le piattaforme legano l'evento a un contenitore
  che sopravvive alle persone (negozio, organizzazione, torneo stesso); nessuna lo lega a chi l'ha
  creato.
- **I ruoli stanno su due livelli**: chi può creare eventi, gestire staff e template (livello
  organizzazione, dove Better Auth arriva), e chi fa cosa in un evento (livello evento, dove Better
  Auth non arriva e serve una tabella nostra).
- **Lo staff esterno** (il judge che arbitra in negozi diversi) esiste ovunque, ed è la ragione del
  secondo livello.

### Fonti

- Better Auth, [Organization plugin](https://www.better-auth.com/docs/plugins/organization)
- Wizards Play Network, [The Definitive Guide to Wizards EventLink](https://wpn.wizards.com/en/news/definitive-guide-wizards-eventlink)
- Melee.gg, [Staffing Organizations and Tournaments](https://help.melee.gg/docs/staffing/)
- start.gg, [Admin permissions](https://help.start.gg/article/admin-permissions)
- Challonge, [How to Manage Permissions for your Event](https://kb.challonge.com/en/article/how-to-manage-permissions-for-your-event-16p59qu/), [Community Roles / Permissions Overview](https://kb.challonge.com/en/article/community-roles-permissions-overview-g56p1n/)
- Magic Judges, [MTR 1.3 Tournament Roles](https://blogs.magicjudges.org/rules/mtr1-3/)
- MTG Wiki, [Magic tournament rules](https://mtg.wiki/page/Magic_tournament/Rules)

### Decisioni

Una prima tornata di risposte ammetteva eventi personali accanto a quelli di organizzazione; le
regole che ne discendevano (template, leghe, circuito, warning, titolarità dei profili, passaggi di
proprietà) erano troppe. Decisione finale:

1. **Gli eventi li crea solo un'organizzazione: niente eventi personali.** Chi ha creato l'evento
   resta come dato registrato, non come proprietario. Chi vuole un torneo fra amici crea
   un'organizzazione.
2. **Un'organizzazione ha il suo owner e i suoi admin**, come le community di Challonge.
3. **Si può aggiungere a un singolo evento staff esterno** all'organizzazione.
4. **Il judge che gioca è un'opzione dell'evento.**
5. **Il ruolo «organizzatore» sparisce dall'evento**: la responsabilità sta nei ruoli
   dell'organizzazione.

### Scelte di default, da confermare

- **Solo owner e admin creano eventi**: nessun ruolo intermedio come i collaborator di Challonge o lo
  scorekeeper di EventLink. Chi deve solo gestire un evento ha un ruolo di evento.
- **Il judge che gioca parte spento**, come nell'MTR.

### Conseguenze sul modello

- **§1.** Ogni evento appartiene a un'organizzazione.
- **§7, ruoli.** Due livelli: organizzazione (owner, admin — i ruoli predefiniti di Better Auth) ed
  evento (head judge, judge, scorekeeper — una tabella nostra, perché Better Auth non ha permessi per
  singola risorsa). Staff e admin si aggiungono cercandoli fra gli utenti registrati, senza inviti
  via email finché non esiste un mailer.
- La roadmap dell'autenticazione resta valida: il torneo avrà `organizationId`, non `organizerId`.

### Applicato a `brainstorm.md`

§1 (ogni evento appartiene a un'organizzazione) · §7 (ruoli su due livelli, staff esterno, niente
inviti, judge che gioca come opzione spenta).

**Argomento chiuso**, salvo obiezioni sulle due scelte di default.

---

## 8 · Dipendenze infrastrutturali

### Il problema nel testo attuale

Lo stack del §0 dichiara: pg-boss per code e job schedulati · SSE per il live in sala · PWA
installabile per le push · **nessun Redis, nessun servizio esterno obbligatorio**. Diverse funzioni
del brainstorm però presuppongono canali che non ci sono o che il documento non nomina:

| Funzione | Dove | Cosa richiede |
|---|---|---|
| Offerta di posto dalla lista d'attesa, con link valido `min(24 h, check-in)` | §6, §10 | un canale che raggiunga il giocatore **fuori dall'app**: email o push |
| Scadenza dell'offerta ed emissione della successiva | §10 | un job ritardato per ogni offerta |
| Token di rivendicazione del profilo | §2 | un modo di consegnare il token (non detto) |
| «Pubblica»: notifica di tavolo e posto | §7 | push, o l'app aperta |
| Risultato contestato: notifica allo staff | §7 | push, o l'app aperta |
| Chiamata arbitro dal telefono | §7 | tempo reale verso lo staff |
| Cronometro, abbinamenti, stato dei tavoli in sala | §7, §8 | SSE |
| Ricalcolo di stagione e riallineamento dei crediti | §9, §10 | job su richiesta, pesante |
| Decadimento dell'RD di Glicko | §10 | job periodico, o calcolo pigro |
| Verifica email, reset password, inviti | roadmap auth | mailer |

Il mailer, a oggi, **non è pianificato**.

### Ricerca

#### pg-boss

- Richiede **Node 22.12+** e **Postgres 13+**. Usa `SELECT … FOR UPDATE SKIP LOCKED` per far
  prendere i job a più worker senza bloccarsi, e opzionalmente `LISTEN/NOTIFY` per la bassa latenza.
  Supporta cron, RRULE e **job differiti**: esattamente la scadenza di un'offerta.
- **Supporta PGlite** con l'adattatore `fromPglite`, senza flag di compatibilità. PGlite però è a
  connessione singola: i worker non girano in parallelo, e la documentazione dice che molti worker
  o batch grandi non servono a niente. Lo raccomanda per sviluppo, test e uso embedded.
  L'istanza PGlite la costruisce l'applicazione e la passa a pg-boss: in sviluppo condividerebbero
  la stessa istanza che usa Drizzle.

#### Task schedulati di Nitro

- Sono sperimentali (`experimental: { tasks: true }`) e usano espressioni cron in `scheduledTasks`.
- In `node-server` e negli altri preset a processo lungo girano con Croner; su Cloudflare e Vercel si
  appoggiano ai cron della piattaforma.
- **Ogni task ha al più un'esecuzione in corso per istanza del server**. La documentazione non parla
  di persistenza: un task non eseguito perché il server era spento non viene recuperato.

Sono un'alternativa per ciò che è periodico (Glicko, pulizia delle offerte scadute con la lettura
difensiva del §10), non per un job differito e persistente per ogni singola offerta.

#### SSE

- h3 ha `createEventStream()` per aprire un flusso SSE da un handler Nitro.
- Sulle piattaforme serverless la connessione viene chiusa al limite della piattaforma: su Vercel
  ogni SSE termina con un timeout dopo 300 secondi. Dietro un proxy servono `X-Accel-Buffering: no`
  e un keepalive, e va controllato l'idle timeout del load balancer.
- Con **più istanze del server**, un evento nato su un'istanza deve raggiungere i client collegati
  alle altre. Con Postgres il meccanismo è `LISTEN/NOTIFY`:
  - una **connessione dedicata per processo** che ascolta, e smista in memoria ai sottoscrittori
    (il «notifier pattern» di brandur);
  - payload massimo **8000 byte**: si mandano identificativi, il resto si legge dopo;
  - **non è durevole**: una notifica arrivata mentre la connessione è caduta è persa;
  - **PgBouncer in modalità transaction lo rompe in silenzio**: il `LISTEN` va su una connessione
    che bypassa il pooler o usa la modalità session.
- PGlite supporta `LISTEN/NOTIFY` in-process (`.listen()`), quindi in sviluppo funziona.

#### Push web

- Web Push con chiavi VAPID: **nessun account** presso Apple o Google, ma la consegna passa comunque
  per i servizi push dei browser, che sono esterni per costruzione.
- **iOS e iPadOS 16.4+: le push funzionano solo se l'app è installata nella schermata Home** da
  Safari. Un tab aperto non basta. Nell'UE Apple aveva tolto le web app dalla Home con iOS 17.4 beta
  e ha fatto marcia indietro il 1° marzo 2024: funzionano anche in Italia.
- Servono HTTPS e un service worker.

Per un giocatore iPhone che non ha installato l'app, la push non esiste: un'offerta di posto
consegnata solo via push non gli arriva.

#### Email

- Gmail e Yahoo, dal febbraio 2024: **SPF o DKIM obbligatori per tutti i mittenti**; sopra i 5000
  messaggi al giorno anche DMARC, disiscrizione con un clic (RFC 8058) e reclami sotto lo 0,3%.
  Google è passata dai rinvii temporanei al **rifiuto permanente** a novembre 2025.
- In pratica, per mandare email che arrivino serve un dominio con SPF, DKIM e DMARC configurati e un
  server o fornitore SMTP. SMTP è uno standard: il fornitore resta sostituibile, ma **c'è**.

#### Link monouso e scanner

Microsoft Safe Links e gli altri scanner di posta aprono ogni link con una GET prima del destinatario:
un token consumato sulla GET risulta già usato quando la persona clicca. Lo schema standard è **GET
che mostra una pagina di conferma senza consumare nulla, POST dal pulsante che consuma il token**;
gli scanner non inviano form. Conferma e precisa il §10 («il link dell'offerta deve essere
idempotente»).

#### Deploy

Per SSE e worker di pg-boss serve un **processo Node che resta acceso** (`node-server` in container o
VPS), non una piattaforma serverless. Il Postgres di produzione è gestito fuori dal repository: se
davanti ha un pooler in modalità transaction, il `LISTEN` deve usare una connessione a parte.

### Fonti

- pg-boss, [README](https://github.com/timgit/pg-boss) e [Database backends](https://pgboss.io/database-backends)
- PGlite, [API](https://pglite.dev/docs/api)
- Nitro, [Tasks](https://nitro.build/docs/tasks)
- H3, [WebSockets e SSE](https://h3.dev/guide/advanced/websocket)
- Vercel Community, [SSE Time Limits](https://community.vercel.com/t/sse-time-limits/5954)
- Brandur, [The Notifier Pattern for Applications That Use Postgres](https://brandur.org/notifier)
- PgBouncer, [Features](https://www.pgbouncer.org/features.html) e [issue #655](https://github.com/pgbouncer/pgbouncer/issues/655)
- MagicBell, [PWA iOS Limitations and Safari Support](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- TechCrunch, [Apple reverses decision about blocking web apps on iPhones in the EU](https://techcrunch.com/2024/03/01/apple-reverses-decision-about-blocking-web-apps-on-iphones-in-the-eu/)
- DMARCwise, [The new Gmail and Yahoo requirements for email delivery](https://dmarcwise.io/blog/gmail-yahoo-new-requirements-2024)
- Security Boulevard, [Google and Yahoo updated email authentication requirements for 2025](https://securityboulevard.com/2025/11/google-and-yahoo-updated-email-authentication-requirements-for-2025/)
- SGAOperations/auth, [Scanner-safe email links](https://github.com/SGAOperations/auth/issues/114)
- pg-boss, [ORM Transaction Adapters](https://pgboss.io/api/adapters)
- CapRover, [NGINX Customization](https://caprover.com/docs/nginx-customization.html) e [App Scaling & Cluster](https://caprover.com/docs/app-scaling-and-cluster.html)
- OneUptime, [How to Configure Server-Sent Events Through Nginx](https://oneuptime.com/blog/post/2025-12-16-server-sent-events-nginx/view)

### Decisioni

1. **Il mailer è nella v1.**
2. **Un fornitore SMTP configurabile è accettabile**: «nessun servizio esterno obbligatorio» si legge
   come «nessun fornitore insostituibile».
3. **Le push sono nella v1**, per: abbinamenti pubblicati, chiamata arbitro, risultato contestato,
   **messaggio dall'organizzatore** (funzione nuova).
4. **Deploy su CapRover**: un server Node dockerizzato, sempre acceso.
5. **Il Postgres di produzione è anch'esso su CapRover**: nessun pooler davanti, quindi `LISTEN`
   funziona su una connessione normale.

Sulla domanda 5 (pg-boss o task di Nitro) l'utente chiede un suggerimento: vedi sotto.

### Ricerca aggiuntiva

- **pg-boss nella stessa transazione.** `send()` accetta un'opzione `db` per scrivere il job dentro
  una transazione esistente: se la transazione fallisce, il job non esiste. Per Drizzle c'è
  l'adattatore `fromDrizzle(tx, sql)`, documentato per i driver `node-postgres`, `postgres-js` e
  `bun-sql`. **PGlite non è nell'elenco**, e in sviluppo il progetto usa proprio PGlite.
- **CapRover** scala un'app a più istanze da interfaccia, su Docker Swarm, e distribuisce le
  richieste fra i container. Le app con dati persistenti restano su un solo nodo. La configurazione
  nginx si personalizza per app da un template; il `proxy_read_timeout` di nginx è di 60 secondi per
  default, e chiude un flusso SSE che resta muto più a lungo.

### Proposte tecniche

1. **Solo pg-boss, niente task di Nitro.** Un solo strumento per tutto ciò che non si fa dentro la
   richiesta:
   - scadenza delle offerte (job differito per ogni offerta);
   - invio di email e push (con ritentativi se il fornitore non risponde);
   - ricalcolo di stagione e riallineamento dei crediti;
   - decadimento di Glicko, con il cron di pg-boss, che è persistente e gira una volta sola anche con
     più istanze.
   I task di Nitro sono sperimentali, non recuperano un'esecuzione persa e girano una volta **per
   istanza**: con due container, due esecuzioni.
2. **Job accodati nella stessa transazione della modifica** (`fromDrizzle(tx, sql)`): l'email
   dell'offerta non parte se l'offerta non è stata salvata, e non si perde se l'SMTP è giù. Siccome
   l'adattatore non documenta PGlite, **va verificato con una prova** prima di contarci; se non
   funziona, in sviluppo si accoda fuori dalla transazione e basta.
3. **Mailer via SMTP**, con il fornitore in variabili d'ambiente (`NUXT_MAIL_*`, come
   `NUXT_DATABASE_*`), dominio con SPF, DKIM e DMARC. Le email le manda **solo un job**, mai la
   richiesta HTTP. Ogni link monouso segue lo schema GET → pagina di conferma → POST.
4. **Push con Web Push e chiavi VAPID**, una sottoscrizione per dispositivo; anche l'invio è un job.
   Su iPhone le push arrivano solo con l'app installata nella schermata Home, quindi l'app lo chiede
   al primo accesso. L'offerta di posto va **per email**, perché deve arrivare anche a chi non ha
   installato niente; la push, se c'è, si aggiunge.
5. **SSE con un keepalive ogni 30 secondi** (sotto i 60 di nginx) e `X-Accel-Buffering: no`. Gli
   eventi fra istanze passano per `LISTEN/NOTIFY` con **una connessione dedicata per processo** e
   payload di soli identificativi. Una notifica persa non è un problema: il client, quando si
   ricollega, rilegge lo stato dal database, che è la fonte di verità.
6. **Si parte con un'istanza, progettando per più istanze.** Il fan-out via `LISTEN/NOTIFY` costa poco
   ed evita di riscrivere il live il giorno in cui si alza l'instance count su CapRover. Il container
   dell'app non ha dati persistenti: PGlite è solo per lo sviluppo, il Postgres è un'app CapRover a
   parte.

### Conseguenze sul modello

- **§0, stack**: pg-boss per tutti i job, SMTP con fornitore configurabile, Web Push con VAPID, SSE con
  fan-out via `LISTEN/NOTIFY`, deploy su CapRover in un container Node sempre acceso.
- **§7**: nuova funzione, **messaggio dall'organizzatore** ai partecipanti dell'evento, via push e in
  app.
- **§7, ruoli (argomento 7)**: con il mailer in v1 gli inviti di Better Auth tornano possibili; la
  ricerca fra gli utenti registrati resta come seconda via.
- **§10**: link monouso secondo lo schema GET → conferma → POST.
- **Roadmap dell'autenticazione**: verifica email e reset password non sono più bloccati.

### Proposte approvate

Tutte e sei.

### Applicato a `brainstorm.md`

§0 (stack e scelte infrastrutturali) · §7 (inviti via email, nuova sottosezione *Notifiche* con il
messaggio dall'organizzatore) · §10 (schema GET → conferma → POST per ogni link monouso).

**Argomento chiuso.**

---

## 9 · Minori e profili non rivendicati

> Questa sezione raccoglie fonti normative e prassi, ma **non è un parere legale**. I punti che
> dipendono dall'interpretazione del GDPR vanno verificati con un consulente prima di andare in
> produzione.

### Il problema nel testo attuale

Il §2 descrive il profilo creato al volo: nasce `unclaimed`, è **cercabile da tutte le
organizzazioni**, ha un **profilo pubblico** con eventi e piazzamenti, e il suo titolare è
l'organizzazione che l'ha creato. Chiede un'informativa e una procedura di rimozione, ma non le
definisce. Tre cose non sono dette:

- **i minori**: nel gioco organizzato sono tanti (Pokémon ha una divisione Junior per i nati dal 2014
  in poi), e il documento non li nomina;
- **chi è titolare di cosa**: dopo l'argomento 7 ogni evento appartiene a un'organizzazione, ma la
  ricerca fra organizzazioni, il profilo pubblico aggregato e il circuito nazionale sono funzioni
  della **piattaforma**, non di un'organizzazione;
- **cosa significa rimuovere** un giocatore i cui risultati sono dentro classifiche già pubblicate e
  crediti già emessi, quando l'argomento 1 ha deciso che i fatti del torneo non si cancellano.

### Ricerca

#### Età del consenso digitale in Italia

Art. 8 GDPR: per i servizi della società dell'informazione offerti direttamente a un minore, il
consenso del minore vale dai 16 anni, e gli Stati possono abbassare la soglia fino a 13. L'Italia, con
l'**art. 2-quinquies del Codice privacy** (D.Lgs. 101/2018), l'ha fissata a **14 anni**: sotto, il
consenso lo dà chi esercita la responsabilità genitoriale. La norma riguarda il trattamento fondato
sul **consenso**: è rilevante per la registrazione di un account da parte del minore, non
necessariamente per il profilo che un'organizzazione crea al banco.

#### Il bilanciamento con i minori — EDPB, Linee guida 1/2024

Se la base giuridica è l'interesse legittimo (art. 6.1.f), il test di bilanciamento **va
ricalibrato quando gli interessati sono minori**: in caso di conflitto fra l'interesse del titolare
e quello del minore, **prevale di regola il secondo**, e il titolare deve poter dimostrare di aver
considerato l'interesse del minore come preminente. La valutazione cambia molto fra fasce d'età.

#### Garante privacy, 2026 — ripubblicazione di dati sportivi di minori

Secondo la sintesi di Altalex (29 luglio 2026), il Garante ha affermato che il fatto che i risultati
sportivi di un minore siano pubblici su un sito **non autorizza** ulteriori operazioni di raccolta,
**aggregazione, indicizzazione**, diffusione o riuso per finalità diverse da quella originaria. È
esattamente ciò che fa un profilo pubblico che raccoglie i piazzamenti di un giocatore da eventi di
organizzazioni diverse.

#### Pokémon — come lo fa un programma con molti minori

- Divisioni per anno di nascita (stagione 2026: Junior dal 2014, Senior 2010–2013, Masters fino al
  2009). **L'anno di nascita è un dato che raccolgono**, perché serve a dividere i tornei.
- Per partecipare a ranking e classifiche serve un account Pokémon Trainer Club; **sotto i 13 anni lo
  attiva un genitore**, che dà il consenso.
- Nelle classifiche pubblicate: dai 13 anni il giocatore sceglie fra nome completo, nome e iniziale
  del cognome, nome utente, ID giocatore o nome anonimo; **sotto i 13 anni sceglie il genitore** fra
  nome utente, nome completo, nome e iniziale, o nome anonimo.

#### Chi è titolare — EDPB, Linee guida 07/2020

- Titolare è chi determina finalità e mezzi. **Contitolari** (art. 26) sono due soggetti che li
  determinano insieme, e devono stabilire in modo trasparente chi risponde agli interessati.
- **Responsabile** (art. 28) è chi tratta per conto del titolare, con un contratto scritto, e non
  decide finalità proprie.

Nel nostro caso l'organizzazione decide di iscrivere un giocatore al proprio evento e ne registra i
risultati; la piattaforma decide che quel profilo sia cercabile da tutte le organizzazioni, che abbia
una pagina pubblica aggregata, e che i risultati entrino in un circuito nazionale che è suo. Sono
finalità della piattaforma, non dell'organizzazione: il «titolare è l'organizzazione» del §2 copre
solo una parte del trattamento.

#### Rimozione e fatti del torneo

L'argomento 1 ha deciso che i fatti del torneo non si cancellano e che lo storico è a sola aggiunta;
l'argomento 2 che le classifiche degli eventi terminati sono snapshot. Una richiesta di
cancellazione (art. 17) non può quindi togliere un giocatore da una classifica senza cambiare i
piazzamenti di tutti gli altri. La strada che resta compatibile con entrambe le decisioni è
**anonimizzare** l'identità e lasciare il fatto: l'`Entrant` resta, il `Player` diventa «giocatore
rimosso». Se l'anonimizzazione basti a soddisfare l'art. 17 in questo contesto è una delle domande
per il consulente.

### Fonti

- Codice privacy, [art. 2-quinquies](https://www.cyberlaws.it/en/2018/art-2-quinquies-d-lgs-196-2003/); Agenda Digitale, [Il consenso digitale del minore dopo il D.Lgs. 101/2018](https://www.agendadigitale.eu/sicurezza/il-consenso-digitale-del-minore-dopo-il-decreto-gdpr-101-2018/)
- EDPB, [Guidelines 1/2024 on legitimate interest](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202401_legitimateinterest_en.pdf)
- EDPB, [Guidelines 07/2020 on the concepts of controller and processor](https://www.edpb.europa.eu/system/files_en?file=2023-10%2FEDPB_guidelines_202007_controllerprocessor_final_en.pdf)
- Altalex, [La ripubblicazione di dati sportivi di minori](https://www.altalex.com/documents/2026/07/29/ripubblicazione-dati-sportivi-minori-garante-privacy-fissa-confini-divulgazione-amatoriale-conformita-gdpr)
- Pokémon, [Privacy Notice](https://www.pokemon.com/us/legal/privacy-notice) e [Age Divisions in 2025 Official Competitions](https://www.pokemon.com/uk/news/age-divisions-in-2025-official-competitions)
- Victory Road, [Structure of the 2026 Season](https://victoryroad.pro/2026-season-structure/)
- Pokémon, [Play! Pokémon Tournament Rules Handbook](https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-tournament-rules-handbook-en.pdf)

### Decisioni

1. **Anno di nascita sul profilo**, con la possibilità di categorie d'età come Pokémon.
2. **Nome visualizzato: nickname se c'è, altrimenti nome e iniziale del cognome.** Sempre così, non
   sceglie nessuno; un account rivendicato con nickname mostra quello.
3. **Il profilo non rivendicato di un minore resta cercabile da tutte le organizzazioni e ha un
   profilo pubblico.**
4. **Gli account sotto i 14 anni si ammettono come quelli degli altri utenti.**
5. **Nessun consulente privacy per ora**: la piattaforma sarà usata su invito da poche persone.
6. **La rimozione anonimizza l'identità e lascia i risultati.**

### Rischi accettati

Le decisioni 3 e 4 vanno in direzione diversa dalle fonti raccolte (art. 2-quinquies del Codice
privacy; Garante 2026 sull'aggregazione di risultati di minori; EDPB 1/2024 sul bilanciamento con i
minori). La decisione 5 lascia non verificate titolarità e sufficienza dell'anonimizzazione. Sono
scritte nel §2 come **rischi accettati, da rivedere prima dell'apertura al pubblico**, così che non
si perdano. La decisione 1 è ciò che rende possibile rivederle per i soli minori.

La decisione 2 va nella direzione opposta, e riduce il rischio per tutti: il nome completo non compare
mai.

### Applicato a `brainstorm.md`

§2 (nome visualizzato, anno di nascita, minori con le stesse regole, titolarità come ipotesi di
lavoro, rimozione come anonimizzazione, nuova sottosezione *Rischi accettati*).

### Decisioni sui punti aperti

7. **Categorie d'età in v1.** Ogni circuito o evento può avere categorie per età che giocano in
   parallelo, con classifiche separate, se la categoria raggiunge un numero minimo di giocatori.
8. **Entrambe le attenuazioni**: `noindex` sul profilo pubblico dei minori, avviso all'organizzazione
   quando crea il profilo di un minore.

Applicato al §2 (anno di nascita obbligatorio con le categorie, attenuazioni) e al §5 (categorie
d'età). La categoria fissata a inizio stagione è la regola di Pokémon, applicata per coerenza.

### Ricerca aggiuntiva

Play! Pokémon Tournament Rules Handbook: con **meno di 4 giocatori** una divisione si combina con
un'altra (funzione *Age Combined*), preferendo quella con la minore differenza d'età (Junior con
Senior, Senior con Masters, mai Junior con Masters). **Le divisioni combinate condividono solo gli
abbinamenti della svizzera**: ognuna mantiene la propria classifica e, se c'è, il proprio top cut.

### Decisione sul punto aperto

9. **Sotto il minimo la categoria si combina come in Pokémon**: con quella d'età più vicina,
   abbinamenti della svizzera condivisi, classifiche e top cut separati.

Applicato al §5. Conseguenza sul modello a fasi: la categoria è un attributo dell'`Entrant`, e una
fase svizzera con categorie combinate restituisce un elenco ordinato per categoria invece di uno solo.

**Argomento chiuso.**

---

## 10 · Sala senza rete

### Il problema nel testo attuale

Tutto il brainstorm presuppone la rete in sala: abbinamenti pubblicati via SSE e push, risultati
inseriti dal telefono del giocatore, cronometro sul telefono, chiamata arbitro, check-in. Il wifi di
un negozio che ospita quaranta persone è il punto più fragile della serata, e il documento non dice
cosa succede quando cade. L'unico accenno è «PWA installabile».

### Ricerca

#### Wizards: dall'offline all'online

- **Wizards Event Reporter** (WER), il vecchio software dei negozi Magic, era un'applicazione
  desktop con **modalità offline** e **abbinamenti manuali**.
- Wizards, spiegando perché EventLink non ha gli abbinamenti manuali: offline e abbinamenti manuali
  erano responsabili del **90% dei costi di manutenzione** di WER. E i dati mostravano che gli
  abbinamenti manuali venivano usati **in larga maggioranza per frodi**, che il software non sapeva
  distinguere dagli usi legittimi.
- **EventLink** è interamente web e **non ha una modalità offline**. Al posto degli abbinamenti
  manuali offre assegnazione dei posti per separare giocatori incompatibili, iscrizioni tardive con
  sconfitta automatica, **rollback del round** per correggere i risultati, e i risultati inseriti dai
  giocatori con l'app Companion. Contro le interruzioni: monitoraggio, allarmi, e un indirizzo email
  per le emergenze.

#### Pokémon: offline per costruzione, poi connesso

- **TOM** (Tournament Operations Manager) è un'applicazione desktop per Windows e macOS: il torneo
  gira in locale su un file, si stampano abbinamenti, **match slip** e classifiche, e a evento finito
  si carica il file su Play! Tools.
- Il suo successore **PEM** (Pokémon Event Manager) aggiunge la verifica online dell'ID giocatore
  **quando c'è connessione**: funziona anche senza.

#### Cosa permette il browser

- Un service worker può mettere in cache le pagine e i dati già letti: **la lettura offline** di ciò
  che si è già visto (abbinamenti del round, classifica) è semplice.
- **Background Sync non esiste su iOS**, né in Safari né negli altri browser su iPhone, che usano
  tutti WebKit, e non è previsto a breve. Una scrittura fatta offline su un iPhone si può spedire
  solo quando l'app torna in primo piano con la rete. Su Chrome desktop e Android il supporto c'è.

#### Le scritture offline si scontrano con le decisioni prese

Un'applicazione che **scrive** offline e sincronizza dopo deve risolvere i conflitti. Con le
decisioni già prese:
- il seed del round **lo genera il server**, e ogni round ha **un solo esito del motore**
  (argomento 2): generare un round offline, sul portatile dello staff, lo contraddice;
- lo storico è scritto dall'applicazione **nella stessa transazione** della modifica (argomento 1):
  una scrittura offline arriva dopo, fuori da quella transazione;
- due refertazioni dello stesso match arrivate dopo, in ordine incerto, rendono ambigua la regola
  «il primo risultato resta» (§7).

Il motore è TypeScript puro (§0.3) e girerebbe anche nel browser, e lo stack di sviluppo (Nuxt più
PGlite, tutto in un processo) girerebbe su un portatile in sala. La parte difficile non è eseguire
il torneo in locale, ma **riconciliarlo** dopo con il server: è quella che ha pesato su WER.

#### Il ripiego che tutti hanno

Carta. In Magic e in Pokémon il match slip, il foglio su cui i giocatori scrivono il risultato e
firmano, è la prassi normale, non un'emergenza; abbinamenti e classifiche si stampano e si appendono.
Se la rete cade a metà round, i risultati sulla carta si inseriscono quando torna, o da un telefono
con dati mobili.

### Fonti

- Wizards Play Network, [Why EventLink Doesn't Have Manual Pairing](https://wpn.wizards.com/en/news/why-eventlink-doesnt-have-manual-pairing)
- Wizards Play Network, [Introducing Wizards EventLink](https://wpn.wizards.com/en/news/introducing-wizards-eventlink)
- Pokémon, [Tournament Operations Manager guide](https://assets.pokemon.com/tournament_software/tom_guide.pdf)
- PocketMonsters.net, [New Pokémon Event Manager (PEM)](https://pocketmonsters.net/news/4458)
- Can I use, [Background Sync API](https://caniuse.com/background-sync)
- MagicBell, [PWA iOS Limitations and Safari Support](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)

### Decisioni

1. **Solo online, con la carta come ripiego** (livello A, il modello di EventLink).
2. **Stampa in v1**: abbinamenti per nome e per tavolo, match slip, classifiche. La risposta era «sì a
   tutte e due»; la carta è l'intero ripiego del livello A, quindi le includo tutte.
3. **Gli override manuali restano**: la motivazione nello storico è sufficiente, nonostante il
   precedente di WER.

### Applicato a `brainstorm.md`

§7 (nuova sottosezione *Sala senza rete*, nota sugli override e sul precedente di WER) · §11
(modalità offline fuori dalla v1).

**Argomento chiuso.**

---

## 11 · Date ricorrenti, fusi orari, ora legale

### Il problema nel testo attuale

- §5 — template ed eventi ricorrenti in v1: «ricreo quello di ogni venerdì». Le tre date (apertura
  iscrizioni, deadline delle liste, inizio) si generano come **offset**, non come date assolute.
- §6 — l'offerta di posto vale `min(24 h, apertura del check-in)`.
- §9 — pubblicazione entro **7 giorni**; i crediti scadono «al circuito successivo, di norma un anno».
- §5 — la categoria d'età si fissa **all'inizio della stagione**.
- §3 — legalità delle liste e policy «alla data dell'evento».

Il documento non dice in quale fuso si leggono queste date, né cosa sia un «offset»: una durata
(168 ore) o un intervallo di calendario (7 giorni alla stessa ora). Con l'ora legale le due cose
differiscono di un'ora due volte l'anno.

### Ricerca

#### L'ora legale in Italia non sparisce

La proposta di abolire il cambio d'ora nell'UE (Commissione 2018, Parlamento 2019) è **ferma in
Consiglio**, senza calendario. Nel 2026 l'Europa passa all'ora legale il **29 marzo** e torna a quella
solare il **25 ottobre**, e il sistema resta in vigore finché non si decide altrimenti.

Ogni anno quindi, alle 2 di notte dell'ultima domenica di marzo, l'ora fra le 2:00 e le 3:00 **non
esiste**; e l'ultima domenica di ottobre l'ora fra le 2:00 e le 3:00 **esiste due volte**.

#### Ricorrenze: ora locale, non UTC

In iCalendar (RFC 5545) una ricorrenza legata a un fuso (`TZID`) **resta alla stessa ora locale** e
fa muovere l'istante UTC: una riunione settimanale alle 9:00 resta alle 9:00. Una ricorrenza in UTC
fa il contrario: l'istante resta fisso e l'ora locale si sposta di un'ora al cambio. Per «ogni venerdì
alle 20» serve la prima: sommare 7 × 24 ore a un istante UTC porta il torneo alle 19 o alle 21 dopo il
cambio d'ora.

Per gli orari che non esistono o esistono due volte serve una regola dichiarata; le implementazioni
più comuni scelgono l'offset precedente alla transizione.

#### Postgres

`timestamptz` memorizza un **istante** (in UTC) e non conserva il fuso con cui è stato scritto. Per
ricostruire «le 20 di venerdì a Roma» bisogna tenere **il nome del fuso** IANA (`Europe/Rome`) in una
colonna a parte. Il CLAUDE.md del progetto usa già `timestamptz` ovunque.

#### JavaScript: Temporal

- **Temporal** (`Temporal.ZonedDateTime`, fusi IANA, aritmetica di calendario consapevole dell'ora
  legale) è arrivato allo Stage 4 nel marzo 2026 ed è in ES2026.
- **Node.js 26** (maggio 2026) lo abilita di default; Node 26 diventa LTS a ottobre 2026. Il progetto
  oggi usa **Node 24.15**, dove Temporal non è abilitato di default.
- Nei browser: Chrome ed Edge dalla 144, Firefox dalla 139. **Safari non l'ha ancora**: il frontend
  pubblico ha bisogno del polyfill `@js-temporal/polyfill`.

#### Durata o calendario

| Scadenza | Come durata | Come calendario |
|---|---|---|
| «7 giorni prima, alle 10» per l'apertura iscrizioni | 168 ore: dopo il cambio d'ora apre alle 9 o alle 11 | sempre alle 10 locali |
| Offerta di posto, 24 ore | 24 ore esatte | «domani alla stessa ora», 23 o 25 ore attorno al cambio |
| Pubblicazione entro 7 giorni | 168 ore dalla fine dell'evento | fino alla fine del settimo giorno, in un fuso da dichiarare |

### Fonti

- Consiglio dell'UE, [Seasonal clock changes in the EU](https://www.consilium.europa.eu/en/policies/seasonal-time-changes/)
- Parlamento europeo, [Directive discontinuing seasonal changes of time](https://www.europarl.europa.eu/legislative-train/theme-union-of-democratic-change/file-discontinuing-seasonal-changes-of-time)
- timeanddate, [Daylight Saving Time in Europe 2026](https://www.timeanddate.com/news/time/europe-starts-dst-2026.html)
- Kanzaki, [iCalendar spec: 4.8.5.4 Recurrence Rule](https://www.kanzaki.com/docs/ical/rrule.html)
- grantlucas/inkwell, [Pin DST behaviour for recurring events](https://github.com/grantlucas/inkwell/pull/103)
- lilting.ch, [Node.js 26 ships unflagged Temporal](https://lilting.ch/en/articles/nodejs-26-current-temporal-undici)
- Bryntum, [JavaScript Temporal in 2026](https://bryntum.com/blog/javascript-temporal-is-it-finally-here/)

### Decisioni

1. **Ogni evento ha il proprio fuso orario.**
2. **Gli offset delle date ricorrenti sono di calendario locale.**
3. **Le scadenze in giorni valgono fino a fine giornata nel fuso dell'evento.**
4. **L'offerta di posto vale fino a «domani alla stessa ora».**
5. **Si passa a Node 26**, che diventa LTS il 28 ottobre 2026. Il `.nvmrc` contiene la major `26`:
   il numero della release LTS non esiste ancora, e nvm risolve `26` all'ultima 26.x, che dal 28
   ottobre è la linea LTS.

Scelta aggiunta per completezza, da confermare se serve: per gli orari che non esistono o esistono
due volte vale la disambiguazione `compatible` di Temporal (avanti nel buco, prima occorrenza nel
doppione).

### Applicato a `brainstorm.md`

§0 (Node 26 nello stack) · §5 (nuova sottosezione *Date e fusi orari*) · §6 (offerta fino a «domani
alla stessa ora» o al check-in).

**Argomento chiuso.**

---

## 12 · Glossario e lingua dei nomi

### Il problema nel testo attuale

Il brainstorm scrive la prosa in italiano e i nomi tecnici in due lingue e due convenzioni:

- **inglese**: `Entrant`, `EntrantMember`, `Player`, `Stage`, `Round`, `Match`, `Board`, `Game`,
  `bye_rounds`, `win_loss_draw`, `best_of_N`, `unclaimed`;
- **italiano**: `Penalita`, `ChiamataArbitro`, `EstensioneTempo`, `CreditoBye`, `Qualifica`,
  `stato_pagamento`, `fine_prevista`, `punteggio_continuo`, i valori `bozza`, `contestato`,
  `esclusione`, `vittoria`, `avversario_fittizio_fisso`, `classifica_complessiva`, `incrocio_fisso`,
  `libera`;
- **snake_case** (`stato_pagamento`, `bye_rounds`) accanto a **PascalCase** (`CreditoBye`).

E usa due parole per la stessa cosa: **«evento»** 82 volte e **«torneo»** 19, in modo intercambiabile;
**«fase»** nel §4 e **`Stage`** nel modello dati del §7.

### Ricerca

#### Il codice ha già una convenzione

- CLAUDE.md: **testo dell'interfaccia e commenti in italiano**. Gli identificatori esistenti sono
  tutti in inglese: `User`, `UserSummary`, `UserId`, `Paginated`, `ApiErrorData`, tabelle `users`,
  `sessions`, `accounts`, mapper `toUser`.
- Le proprietà TypeScript dello schema Drizzle sono camelCase (`userId`, `expiresAt`), e per le
  tabelle di Better Auth **sono il contratto con la libreria** (CLAUDE.md, *Authentication*).
- Il tipo del frontend, scritto dal collega, è **`Tournament`**, con `Round`, `Match`,
  **`Participant`**, `Standing`, `TournamentConfig`; le rotte sono `/tournaments/...`.

#### Come chiama le cose una piattaforma che ha lo stesso problema — start.gg

Glossario della API di start.gg:

| Termine | Definizione |
|---|---|
| **Tournament** | la pagina che contiene uno o più Event |
| **Event** | una competizione, con una o più Phase |
| **Phase** | un insieme di Phase Group |
| **Phase Group** (pool) | un insieme di Set |
| **Set** | un insieme di Game (il nostro match) |
| **Game** | l'atomo della competizione |
| **Entrant** | la rappresentazione di chi si iscrive a un Event: una squadra o un giocatore |
| **Participant** | la rappresentazione di una persona in un Tournament, **spettatori compresi** |
| **Player** | un giocatore, non necessariamente legato a un utente |
| **Standing** | il piazzamento di un Entrant in un Phase Group o in un Event |
| **Seed** | la posizione iniziale di un Entrant in una Phase |

Due cose tornano utili. start.gg distingue **Tournament** (il contenitore, per esempio il weekend in
fiera) da **Event** (la singola competizione, per esempio «Magic Standard» o «Pokémon Junior»): è la
distinzione che al brainstorm serve adesso che esistono le **categorie d'età** che giocano in
parallelo. E per start.gg **`Participant` non è `Entrant`**: il primo è una persona nel torneo, il
secondo è l'iscritto in una competizione, che può essere una squadra. Il frontend usa `Participant`
nel senso del nostro `Entrant`.

#### La gerarchia del brainstorm, oggi

Evento → categoria d'età → fase (`Stage`) → girone → `Round` → `Match` → `Board` (solo squadre) →
`Game` (solo best-of). Più `Player` (identità globale), `Entrant` (l'iscritto: 1..n membri),
`EntrantMember`, e lo `User` di Better Auth (l'account), che si lega al `Player` quando il profilo
viene rivendicato.

### Fonti

- start.gg, [Glossary](https://developer.start.gg/docs/glossary)
- `CLAUDE.md` del progetto, sezioni *Conventions* e *Authentication*
- `shared/types/tournament.ts`, `shared/types/user.ts`, `server/database/schema/`

### Decisioni

1. **Tutti gli identificatori in inglese**, come il codice esistente. Italiano solo per prosa,
   interfaccia e commenti.
2. **«Torneo»**, mai «evento». Nel codice `Tournament`.
3. **Nessun livello sopra il torneo**: le categorie d'età bastano dentro il singolo torneo.
4. **`Phase`**, non `Stage`.
5. **`Participant` ovunque**: è il nome del frontend, e sostituisce `Entrant` nel brainstorm e nel
   glossario (`EntrantMember` → `ParticipantMember`). Nella prosa, «partecipante».
6. **Il glossario è un file a sé**, `docs/glossario.md`.

### Scelte aggiunte nel glossario

Le convenzioni di scrittura (PascalCase per i tipi, camelCase per proprietà e colonne TypeScript,
snake_case plurale per le tabelle, snake_case per i valori enum) e i nomi dei concetti che il
brainstorm descriveva solo a parole (`Division`, `PhaseInheritance`, `MatchSlot`, `HistoryEntry`,
`GenerationSignature`, `StandingsSnapshot`, `SeatOffer`, `OrganizerMessage`, `drawNumber`,
`displayName`) li ho scelti io seguendo quelle convenzioni. Il glossario è il posto dove cambiarli.

### Applicato a `brainstorm.md`

Tutto il documento: «evento» → «torneo» (con articoli e preposizioni), identificatori tradotti
(`Stage` → `Phase`, `Penalita` → `Penalty`, `ChiamataArbitro` → `JudgeCall`, `EstensioneTempo` →
`TimeExtension`, `CreditoBye` → `ByeCredit`, `Qualifica` → `Qualification`, `contestato` →
`disputed`, stati del round, delle liste e dell'iscrizione, parametri dei moduli, campi dello
storico, dell'offerta e del cronometro), link al glossario in apertura.

**Argomento chiuso.**

---

## 13 · Perimetro della v1 e milestone

### Il problema nel testo attuale

Il brainstorm dice «in v1» per molte cose, e la revisione ne ha aggiunte altre. Oggi la v1 contiene:
organizzazioni e ruoli su due livelli; profili giocatore con rivendicazione, profilo pubblico e
ricerca fra organizzazioni; catalogo dei moduli, preset per gioco, tornei liberi e template
ricorrenti; svizzera, round robin, gironi, eliminazione singola e doppia, top cut, gate ed eredità
fra fasi; tornei multi-formato; tornei a squadre con spaiamento cieco; categorie d'età combinabili;
liste per fase; lista d'attesa con offerte a scadenza; check-in; penalità; chiamata arbitro;
cronometro con tre regimi; storico; snapshot; stampa; push; mailer; messaggio dell'organizzatore;
circuiti nazionali, leghe interne, ranking policy, pubblicazione con scadenza e warning, qualifiche e
crediti bye con riallineamento, quote di emissione; rating Glicko; statistiche del giocatore.

Il §11 «Fuori dalla v1» elenca poco: FFA, punteggi soft, pagamenti, sostituti, upgrade automatico
delle penalità, classifica individuale a squadre, validazione automatica delle liste, risultati dei
wargame, modalità offline. **Non c'è un ordine**: nessuna indicazione di cosa serve per giocare il
primo torneo vero e cosa può arrivare dopo.

### Ricerca

#### Walking skeleton

Alistair Cockburn: il *walking skeleton* è un'implementazione minima del sistema che esegue **una
piccola funzione da un capo all'altro**, collegando fra loro i componenti principali
dell'architettura; architettura e funzionalità poi crescono in parallelo. Il valore è scoprire presto
i problemi di integrazione, quando si è investito poco. Si porta in produzione subito.

Qui i componenti da collegare sono molti e alcuni non sono ancora mai stati messi insieme: Better
Auth con il plugin `organization`, Drizzle su PGlite e su Postgres, pg-boss con l'adattatore Drizzle
(non documentato per PGlite, argomento 8), SSE con `LISTEN/NOTIFY` dietro l'nginx di CapRover, Web
Push, SMTP, Temporal su Node 26, il motore puro con il blossom pesato.

#### Come è partito EventLink

EventLink è uscito nell'agosto 2020 come **alpha**, in anticipo sul previsto, per i tornei a
distanza: **abbinamenti e risultati** con un codice condiviso, i formati classici più «Altro», un
massimo di 250 partecipanti. **I template e i template ricorrenti erano annunciati per dopo**, così
come le integrazioni con Arena e le opzioni sui pod di draft. È partito dal ciclo del torneo e ha
aggiunto l'ecosistema intorno.

#### Le dipendenze fra i blocchi della v1

| Blocco | Richiede |
|---|---|
| Qualunque torneo | organizzazioni (plugin `organization`), profili giocatore, composizione dal catalogo |
| Ciclo del torneo: iscrizione, check-in, round, risultati, classifica | motore (svizzera, blossom, tiebreak), storico, snapshot |
| Live in sala | SSE con fan-out, cronometro |
| Notifiche: abbinamenti, chiamata arbitro, contestazioni, messaggi | Web Push, pg-boss |
| Lista d'attesa con offerte | mailer, pg-boss, link monouso |
| Inviti, verifica email, reset password | mailer |
| Top cut, day 2, gironi → tabellone | eredità fra fasi, linearizzazione, eliminazione |
| Squadre | `ParticipantMember`, `Board`, spaiamento cieco |
| Categorie d'età | anno di nascita, fase che restituisce un elenco per categoria |
| Circuito | preset per gioco, ranking policy, pubblicazione, aggregatori |
| Qualifiche e bye premiali | circuito chiuso, crediti, riallineamento, job di stagione |
| Glicko, statistiche | risultati di più tornei |

Il circuito e tutto ciò che ne discende (crediti, bye premiali, riallineamento, quote, Glicko) ha
senso solo **dopo** che esistono tornei conclusi da aggregare.

### Fonti

- O'Reilly, *97 Things Every Software Architect Should Know*, [Start with a Walking Skeleton](https://www.oreilly.com/library/view/97-things-every/9780596800611/ch60.html)
- Henrico Dolfing, [Start Your Project With a Walking Skeleton](https://www.henricodolfing.ch/en/start-your-project-with-a-walking-skeleton/)
- Wizards Play Network, [Introducing Wizards EventLink](https://wpn.wizards.com/en/news/introducing-wizards-eventlink)
- MTG Wiki, [EventLink](https://mtg.wiki/page/EventLink)

### Decisioni

1. **Il primo torneo vero**: gioco non definito (torneo **libero**, senza preset), **svizzera con top
   cut**, individuale, **nel negozio dell'utente**.
2. **v1 è la prima release su invito**, non l'apertura al pubblico.
3. **Tutto ciò che era candidato ad aspettare, aspetta**: circuiti, crediti e Glicko; leghe interne;
   categorie d'età; tornei multi-formato; squadre; gironi ed eliminazione doppia; lista d'attesa con
   offerte; template ricorrenti; penalità e chiamata arbitro; push; stampa.
4. **Il frontend non è un vincolo**: il collega ha il tempo che serve.
5. **Scadenza: domenica 29 novembre 2026**, l'ultima domenica di novembre. Da oggi (30 settembre) sono
   60 giorni, poco più di otto settimane.

### Cosa resta nella v1

Il ciclo di un torneo libero, svizzera più top cut, in una sala, dall'iscrizione alla classifica
finale:

- **Fondamenta**: deploy su CapRover (Node 26, Postgres), plugin `organization` con owner e admin,
  profili giocatore creati al volo al banco (ricerca con fuzzy match, nome visualizzato, anno di
  nascita), storico del torneo, fuso orario del torneo.
- **Composizione**: solo torneo libero. Moduli: svizzera, gate per posizione, top cut a eliminazione
  singola; forme di risultato `win_loss_draw` e `best_of_n`; punti 3/1/0; tiebreak `OMW%`, `GW%`,
  `OGW%` con pavimento; bye con i default del torneo libero (`exclude`, `excluded`).
- **Torneo**: iscrizione e check-in fatti dall'organizzatore; round `generate → publish → start`;
  motore con blossom pesato, seed del server e firma di generazione; risultati con stato `disputed`;
  drop e mancato arrivo; override con motivazione; cronometro globale; classifica e snapshot;
  linearizzazione del top cut e classifica finale composta a ritroso.
- **Live**: SSE con fan-out per display in sala (la pagina `/tournaments/[id]/display` esiste già) e
  per i telefoni dei giocatori.

### Proposta: milestone

| Milestone | Entro | Contenuto |
|---|---|---|
| **M0 · Walking skeleton** | domenica 11 ottobre | App e Postgres su CapRover, Node 26, plugin `organization`, un torneo libero creato da un admin e mostrato in una pagina che si aggiorna via SSE. In più due prove tecniche: pg-boss e `fromDrizzle` su PGlite, `LISTEN/NOTIFY` dietro l'nginx di CapRover. |
| **M1 · Svizzera completa** | domenica 1 novembre | Profili al volo, iscrizione e check-in, motore svizzero con tiebreak, ciclo del round, risultati e contestazioni, storico, classifica e snapshot, cronometro, display. Node 26 diventa LTS il 28 ottobre. |
| **M2 · Top cut** | domenica 15 novembre | Gate, eliminazione singola senza patta, linearizzazione, classifica finale. |
| **M3 · Prova generale** | domenica 22 novembre | Un torneo di prova vero nel negozio, con persone vere, e una settimana per correggere. |
| **Primo torneo** | domenica 29 novembre | — |

Dopo la v1, nell'ordine in cui si sbloccano a vicenda: stampa e push → lista d'attesa con offerte →
template ricorrenti → penalità e chiamata arbitro → gironi, eliminazione doppia, day 2 →
multi-formato → squadre → categorie d'età → circuito, pubblicazione, ranking policy → qualifiche,
crediti, riallineamento → leghe interne → Glicko e statistiche.

### Decisioni sui punti aperti

6. **Stampa dopo la v1**, nemmeno quella minima. La v1 accetta che un wifi caduto si tamponi solo con
   i dati mobili: scritto nel §11.
7. **Mailer rinviato**: in v1 gli account si creano a mano. Cambia la decisione 1 dell'argomento 8,
   che lo metteva in v1; tutto il resto dell'argomento 8 resta.
8. **Risultati inseriti solo dallo staff** in v1.
9. **Milestone approvate.**

### Applicato a `brainstorm.md`

§11 riscritto come *Perimetro e milestone*: cosa c'è nella v1, le quattro milestone con le date,
l'ordine dopo la v1, la revisione dei rischi prima dell'apertura al pubblico, e il vecchio elenco
«fuori dalla v1» come *Non pianificato*. Tolti gli «in v1» sparsi nel documento che non valgono più
(template ricorrenti, categorie d'età, multi-formato, penalità, stampa, quote), e segnato che in v1 i
risultati li inserisce solo lo staff (§7).

**Argomento chiuso.**

---

## 14 · Allineamento con il modello del frontend

### Il problema

Il frontend del collega è stato scritto prima di questa revisione, su un modello provvisorio
(`shared/types/tournament.ts`) che lui stesso segna con `ponytail:` come in attesa del backend. Ora
il modello è deciso. Questa sezione confronta i due, **limitandosi alla v1** (§11 del brainstorm): il
resto verrà quando servirà.

### Analisi

#### Tipi — `shared/types/tournament.ts`

| Oggi nel frontend | Nel modello deciso | Cosa cambia |
|---|---|---|
| `Tournament` piatto: `participants[]`, `rounds[]`, `currentRound` | `Tournament` → `Phase` (svizzera, poi top cut con gate) → `Round` → `Match` | le fasi sono un livello in più; `currentRound` diventa il round corrente **della fase corrente** |
| `TournamentStatus`: `draft`, `ready`, `running`, `paused`, `finished` | il brainstorm definisce gli stati del **round** (`draft`, `published`, `started`, `closed`, `cancelled`), **non quelli del torneo** | **lacuna del brainstorm**: il ciclo di vita del torneo (iscrizioni, check-in, in corso, concluso) non è deciso |
| `Participant { id, name, seed?, avatar? }` | `Participant` con membri (`ParticipantMember` → `Player`), `seat`, `attendance`, `play`, `drawNumber` | in v1 è sempre individuale, ma il nome da mostrare è il `displayName` del `Player`, e servono gli stati di presenza e di gioco (drop) |
| `Match { home?, away?, homeScore?, awayScore? }` | `Match` a slot (`participantId`, `result`, `rank`, `forfeit`, `score`), `kind`: `duel`, `bye` | `home`/`away` diventano due slot; il bye è un `kind`, non un avversario mancante |
| `Match.table?: string` («Tavolo 1» nel mock) | numero di tavolo assegnato dal motore | un numero, non un'etichetta |
| `MatchStatus`: `pending`, `running`, `finished` | manca `disputed` | serve per le contestazioni |
| `Match.endsAt?` (ISO) | cronometro `{ endsAt, pausedMs, status }` più il `now` del server | la pausa e lo scostamento dell'orologio non ci sono |
| `Round { number, label?, durationMinutes?, matches }` | `Round` con stato e firma di generazione | lo stato del round manca |
| `Standing { participant, played, wins, draws, losses, points }` | classifica con posizione, tiebreak (`OMW%`, `GW%`, `OGW%`), stato di gioco (ritirato) | mancano posizione e tiebreak; in una svizzera sono ciò che si guarda |
| `TournamentConfig = Omit<Tournament, …> & {…}` | input di creazione **contract-first**, con schema Valibot (CLAUDE.md) | l'`Omit` è il pattern che il CLAUDE.md vieta |
| `startDate?: Date` | stringa ISO e **fuso orario del torneo** | `Date` contraddice il CLAUDE.md; il fuso non c'è |
| `game: string` da una select (BeyBlade X, Cyberpunk TCG, Altro) | **testo libero** | la select diventa un campo di testo, eventualmente con suggerimenti |
| `leagueId?`, select «Lega» | leghe **dopo la v1** | da nascondere in v1 |
| `isTeam`, switch «A squadre» (non collegato al modello) | squadre **dopo la v1** | da nascondere in v1 |
| `location { name?, position? }` | non discusso nel brainstorm | resta com'è, fuori dalle decisioni |
| `format` (usato da `Card.vue` e `settings.vue`, assente dal tipo) | la composizione: fasi e moduli | è il motivo dei due errori del typecheck |
| nessun campo | `organizationId`, fuso orario, composizione (round della svizzera, taglio del top cut, forma del risultato, tiebreak) | da aggiungere al form di creazione |

#### Pagine

| Pagina | Oggi | Nella v1 |
|---|---|---|
| `/tournaments` | legge `Paginated<Tournament>` dal mock | legge i tornei **dell'organizzazione attiva** |
| `/tournaments/new` | form con `TournamentConfig` | serve la scelta dell'organizzazione e la composizione (svizzera + top cut) |
| `/tournaments/[id]` | `ref` vuoti; pulsanti «Avvia round», «Pausa», «Round successivo», «Registra risultato» | i pulsanti diventano gli atti `generate`, `publish`, `start` e la pausa del cronometro; «Registra risultato» apre l'inserimento dello staff, con i game per il best-of |
| `/tournaments/[id]/settings` | form più un riquadro «Partecipanti» vuoto | il riquadro diventa l'**iscrizione al banco**: ricerca del giocatore con fuzzy match, creazione al volo, check-in, drop |
| `/tournaments/[id]/display` | `ref` vuoti; «In corso» e «Prossimi» | dati via SSE; il cronometro usa `endsAt`, `pausedMs` e il `now` del server |
| `/hello` | legge `email`, `createdAt`, `isActive` da `/api/users` | dati che l'elenco non espone più: 4 errori di typecheck |

#### Cosa manca del tutto, per la v1

- gestione dell'organizzazione: crearne una, owner e admin, organizzazione attiva;
- ricerca e creazione dei profili giocatore al banco;
- check-in e drop;
- contestazioni: vedere un match `disputed` con le due refertazioni e decidere;
- override di un abbinamento con la motivazione;
- storico del torneo;
- passaggio dalla svizzera al top cut e classifica finale.

#### Cosa è già giusto

- `RoundTimer` tiene `now` a `null` fino a `onMounted`: è lo schema che il brainstorm chiede per il
  cronometro, manca solo la correzione dell'orologio e la pausa.
- La pagina `/tournaments` legge già `Paginated` e `items`, come vuole il contratto.
- Il layout `projector` e la scala tipografica `text-screen` sono proprio il display in sala.
- `MatchCard` è già pensata per due lati e un tavolo.
- I seam `ponytail:` indicano esattamente dove arriveranno i dati.

### Decisioni

1. **Ciclo di vita del torneo**: bozza → **pubblicato** (il torneo c'è, ma le iscrizioni non sono
   aperte) → iscrizioni aperte → check-in aperto → in corso → concluso. La pausa è del cronometro del
   round, non del torneo.
2. **Nessun documento per il collega**: legge brainstorm e glossario, il resto glielo dice l'utente a
   voce.
3. **`shared/types/tournament.ts` lo riscrive l'utente**, man mano che nascono gli endpoint; il
   collega adatta le pagine.

### Conseguenze

- **Tre significati di «pubblicare»** convivevano nel brainstorm: il round pubblicato (abbinamenti
  visibili), il torneo pubblicato (annunciato) e la pubblicazione del §9 (risultati verso circuito o
  lega). Il §9 ora dice sempre **pubblicazione dei risultati** (`ResultsPublication` nel glossario),
  così lo stato `published` del torneo non si confonde con lei.
- **Aggiunto `cancelled`** per il torneo che non parte, che il §5 già prevedeva («un torneo di circuito
  che non raggiunge il minimo non parte») senza uno stato in cui finire.

### Applicato

`brainstorm.md` §5 (nuova sottosezione *Ciclo di vita del torneo*), §7 e §9 («pubblicazione dei
risultati»), §11 · `glossario.md` (stato del torneo, pubblicazione dei risultati).

**Argomento chiuso.**
