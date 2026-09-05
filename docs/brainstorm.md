# Brainstorm — ecosistema tornei

Analisi del ciclo di vita del sistema, blocco per blocco. Ogni blocco: ricerca su come lavorano i software esistenti → decisioni prese → conseguenze sul modello.

Stato: **tutti i blocchi chiusi.** A–F più la sezione trasversale sull'architettura a fasi; nessuna decisione in sospeso.

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
- **La qualifica ha un payload, non è booleana**: `{ giocatore, bye: n, scadenza }`. È emessa da un aggregatore e **consumata** da una prenotazione → collega A a C. *(Precisato da F8: nessun evento di destinazione — è un credito nell'account del giocatore, spendibile su qualunque evento del circuito che lo accetti fino alla scadenza.)*
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

| B8 | **Un evento di circuito che non raggiunge il minimo di giocatori non parte.** Non si gioca declassandolo: la soglia è una condizione di avvio. |

| B9 | **Il ruleset custom appartiene all'organizzazione ed è versionato**, e l'evento ne congela una versione — lo stesso meccanismo dei ruleset di piattaforma, solo con un proprietario diverso. Un meccanismo invece di due. **Non è copiabile da altre organizzazioni e nessuno può promuoverlo a ruleset di piattaforma**: i ruleset di piattaforma li scrive il gestore (B1), punto. |

---

## C · Ingresso

### Ricerca

- **Battlefy — waitlist e check-in.** La lista d'attesa scatta da sola al raggiungimento del cap e il giocatore vede la propria posizione in coda. Il punto non ovvio: **anche chi è in lista d'attesa fa check-in**. Alla chiusura della finestra il seeding prende prima i registrati che hanno fatto check-in, poi tappa i buchi pescando dalla waitlist in ordine. La promozione non è agganciata alla cancellazione ma al **no-show**. Finestra di check-in a 15/30/60 minuti dall'inizio.
- **EventLink / Companion — ingresso in due tempi.** Il giocatore scansiona un QR (o digita l'event code) ed entra in una *lobby pending*; l'organizzatore conferma nome per nome. Intento del giocatore e ammissione dell'organizzatore sono **due atti distinti**, ed è questo che rende il flusso reggibile al banco.
- **Melee — decklist.** Deadline propria, indipendente dall'inizio del torneo: superata, non si invia e non si modifica più *anche se il torneo non è ancora partito*. Validazione automatica solo per i giochi che il sistema conosce (MTG, Star Wars Unlimited), altrimenti testo incollato con validazione manuale dell'organizzatore. Il flag "richiedi decklist" ha una conseguenza dura: chi non ha una lista valida viene **droppato automaticamente alla generazione del round 1**.
- **MTR 2.7 — deck registration.** Costruito: lista prima del round 1 *anche se il giocatore ha un bye*. Limited: prima del primo round che gioca. Accettata = immutabile. Le penalità per ritardo **scalano nel tempo** (upgrade ogni 4 ore, drop automatico dopo 24). Il rientro dopo un drop è a discrezione del capo-arbitro e **mai dopo il taglio**.
- **start.gg — identità.** Distinzione esplicita fra entità globali (`User`, `Player`, `GlobalTeam`) ed entità *point-in-time* create dall'iscrizione (`Participant`, `Entrant`, `Team`). Chi non ha un account entra come placeholder. Squadre: solo il creatore invita e rimuove, e può **bloccare** il roster; l'iscrizione si finalizza solo a registrazione completata. Esistono cap per evento ed *event group* che impediscono l'iscrizione a due eventi in conflitto orario.
- **Toornament — quote.** La piattaforma non intermedia: il denaro va dal giocatore all'organizzatore (PayPal business), nessuna percentuale, nessuna responsabilità sui rimborsi — che restano policy dell'organizzatore. È il comportamento comune di tutte le piattaforme non enterprise.

### Decisioni

| # | Decisione |
|---|---|
| C1 | **Il soggetto dell'iscrizione è l'`Entrant`, non il giocatore.** Un `Entrant` ha 1..n membri che puntano a `Player`; un evento individuale è semplicemente `team_size = 1`. Pairing, risultati, classifica e display in sala conoscono **solo** `Entrant`. B6 si paga una volta sola, qui. |
| C2 | **Tre assi ortogonali, non uno stato solo**: *posto* (prenotato · in lista d'attesa · cancellato) · *presenza* (atteso · presente · no-show) · *gioco* (attivo · ritirato · squalificato). Comprimerli in un enum unico è il modo classico per non saper più rispondere a "quanti ne ho in gioco al round 3". |
| C3 | **Iscrizione self-service fino al numero massimo**, poi le nuove iscrizioni finiscono in **lista d'attesa ordinata**. L'organizzatore può iscrivere al banco **solo se ci sono posti liberi**: nessuna corsia preferenziale che scavalchi la coda. |
| C4 | **Promozione per offerta a scadenza.** Si libera un posto → il primo in coda riceve una notifica con un link che vale **24 ore**; se non risponde perde il diritto e l'offerta slitta al successivo. Il posto resta **riservato** per tutta la durata dell'offerta. La scadenza effettiva è **`min(24 h, apertura del check-in)`**: da lì in poi il posto lo assegna l'organizzatore a chi è in sala. |
| C5 | **Il check-in è separato dall'iscrizione ed è abilitato esplicitamente dall'organizzatore**, non da una finestra calcolata. Una volta aperto lo può fare il giocatore da sé, oppure l'organizzatore per lui. |
| C6 | **All'inizio dell'evento chi non ha fatto check-in viene droppato.** |
| C7 | **Il profilo al volo non nasce mai da un campo libero.** Il flusso è cerca → risultati con fuzzy match → "nessuno di questi" → crea. Nasce `unclaimed`, **cercabile da tutte le organizzazioni** ma modificabile solo da quella che l'ha creato, con un token di rivendicazione. È l'unica difesa contro A7. |
| C8 | **Il deck è del singolo membro**, non della squadra, ed è un'entità con stati propri (`assente → bozza → inviata → bloccata → validata \| invalida`), deadline propria dell'evento e validatore dichiarato dal **ruleset congelato** (B1 prevede già "forma della lista e sua validabilità"). Niente validatore per quel gioco → testo libero e validazione manuale. |
| C9 | **La qualifica si consuma con la prenotazione** — un credito speso, non un diritto su un evento nominale (F8) — transazionalmente: riferimento sull'iscrizione + stato sulla qualifica; se l'iscrizione viene cancellata e la qualifica non è scaduta, torna disponibile. Il bye viaggia come `bye_rounds` sull'`Entrant` e lo applica il motore di pairing (blocco D). |
| C10 | **Late entry dichiarato dal ruleset**: `nessuno \| con_sconfitte \| con_bye`, con finestra fino al round N. Ricalca l'MTR senza inventare una regola nuova. |
| C11 | **Quota fuori piattaforma**: importo sull'evento + `stato_pagamento` sull'iscrizione marcato dall'organizzatore. Nessun payment processor, nessuna policy di rimborso dentro al prodotto. |
| C12 | **Il roster della squadra si blocca alla chiusura delle iscrizioni.** |
| C13 | **Non esistono sostituti**: il roster ha esattamente la dimensione dei tavoli da schierare. |
| C14 | **Il blocco delle liste lo dichiara il ruleset**: in alcuni giochi la lista si congela alla deadline, in altri si può cambiare durante l'evento. |
| C15 | **L'evento non parte finché mancano liste.** Non c'è drop automatico alla generazione del round 1: la lista mancante è un blocco all'avvio. La via d'uscita è **droppare la squadra** (o il singolo, in un evento individuale), e possono farlo **organizzatore e head judge**. |
| C16 | **La cancellazione dell'iscrizione è possibile fino all'apertura del check-in**, che congela le prenotazioni. |

### Conseguenze sul modello

- **La capienza ha tre stati, non due**: occupato · *riservato da un'offerta* · libero. Un controllo `iscritti < cap` è sbagliato per costruzione: durante un'offerta il posto non è né libero né occupato. È la sorgente di bug numero uno di C4 (doppia assegnazione), e va difeso con un vincolo in database, non solo in codice — cosa che PGlite, connessione singola senza pool, **non farà emergere in sviluppo** (avvertenza già in `CLAUDE.md`).
- **L'offerta è un'entità con storico, non un campo**: `{ posizione_in_coda, emessa_il, scade_il, token, esito }`. Serve conservarne la traccia: "a chi è stata offerta e chi non ha risposto" è esattamente la domanda che farà l'organizzatore quando qualcuno protesta.
- **Serve un job schedulato** (pg-boss, già nello stack) per la scadenza: alla scadenza non basta invalidare, bisogna **emettere l'offerta successiva** — è un effetto, non una vista calcolabile a lettura. La lettura resta comunque difensiva: un'offerta scaduta e non ancora processata non è valida.
- **Il link dell'offerta deve funzionare senza login** (token monouso) e deve essere **idempotente**: i client di posta fanno prefetch dei link, e un GET che accetta il posto lo accetterebbe da solo.
- **La finestra di 24 ore va tagliata all'evento**: una disdetta alle 18:00 per un torneo del venerdì sera non può tenere il posto bloccato fino a sabato. Scadenza effettiva = `min(24 h, apertura del check-in)`; da lì in poi la coda la gestisce l'organizzatore in sala. *(→ Aperto)*
- **Il drop per mancato check-in (C6) è un no-show, non una cancellazione**: il posto non torna in circolo — l'evento sta iniziando — e il fatto resta nello storico, perché serve alla lega (presenza, A) e alle policy del negozio.
- **Il deck per membro (C8) rende la squadra "pronta" solo se lo sono tutti** e sposta la sanzione da `Entrant` a `EntrantMember`: droppare l'intera squadra per una lista illegale è una scelta, non una conseguenza. *(→ Aperto)*
- `Entrant` ed `EntrantMember` sono **entità con dati propri** (seed, bye residui, stato pagamento, qualifica consumata, posizione in coda), non array nel DTO. Stessa trappola già segnalata in A e in `CLAUDE.md`.
- `Player` (globale) e `Entrant` (dell'evento) sono **due DTO diversi**: `Player` non contiene le proprie iscrizioni, altrimenti il grafo esplode.
- Il cap è **dell'evento**, non dello stage: con B3 un evento ha più fasi ma una sola porta d'ingresso.
- C2 implica che "numero di partecipanti" non è una domanda sola: servono tre viste (iscritti · presenti · ancora in gioco) e la classifica del blocco E deve dichiarare a quale si riferisce.
- La deadline decklist è **una terza data** accanto ad apertura iscrizioni e inizio evento: lo scheduling degli eventi ricorrenti (B5) deve saperla generare come offset, non come data assoluta.
- **C14 trasforma la lista in una storia di versioni.** Dove il ruleset permette di cambiarla durante l'evento, "la lista" non è un campo che si aggiorna: serve sapere **quale versione è stata giocata in quale round**, altrimenti si perde la tracciabilità per l'arbitraggio (D) e per le statistiche (F12). Dove invece si congela, la versione è una sola e il problema non esiste.
- **C16 fa dell'apertura del check-in l'unico punto di congelamento del sistema.** Da quel momento: niente più cancellazioni, niente più offerte automatiche di posto (la scadenza di C4 è tagliata lì), e l'assegnazione dei posti liberi passa in mano all'organizzatore in sala. Chi non si presenta non è più un cancellato ma un **no-show** (C6). Un momento solo da implementare e da spiegare, invece di tre regole scollegate.
- **C15 si risolve droppando**, non forzando: la squadra senza lista esce, e con lei escono i compagni — il che rende il blocco all'avvio una pressione reale sul capitano, non un fastidio aggirabile. La decisione resta un atto esplicito di organizzatore o head judge, registrato nell'audit trail (D12).
- **C12 + C13 insieme sono rigidi, ed è voluto**: roster bloccato alla chiusura delle iscrizioni e nessun sostituto significa che una squadra che perde un componente all'ultimo momento gioca in inferiorità o si ritira. È l'organizzatore a dover intervenire a mano, non il sistema.
- C7 rende cercabile su tutta la piattaforma il nome di una persona reale che non ha mai aperto un account: esporre **solo nome visualizzato e organizzazione d'origine**, mai contatti, e considerare titolare del dato l'organizzazione che l'ha creato fino alla rivendicazione. Scelta esplicita, non effetto collaterale.

---

## D · Svolgimento

### Ricerca

#### Il motore di abbinamento — due famiglie

- **FIDE Dutch (procedurale).** Gruppi di punteggio, ciascuno diviso in metà: il primo della metà alta contro il primo della metà bassa, e così via. Gruppo dispari → un giocatore *scende* nel gruppo sotto come **downfloater** e viene abbinato a un *upfloater*. Sopra a tutto una gerarchia di **21 criteri ordinati C1–C21**: C1 niente rivincite, C2 un solo bye a testa, C3 preferenze di colore assolute, **C4 l'abbinamento deve lasciare il round completabile**, C5 bye ai punteggi più bassi, C6–C8 minimizzare i downfloater, C9–C13 colori, C14–C21 rifiniture. Si sacrifica un criterio solo per soddisfarne uno più alto. Deterministico per costruzione: stesso input, stesso output.
- **Matching a peso massimo (dichiarativo).** Tutte le regole diventano **pesi sugli archi** di un grafo e si risolve un massimo accoppiamento (Edmonds/blossom): una sola computazione per round. Approccio di Ólafsson (1990), oggi lo standard nella letteratura.
- **Riferimento pratico:** `tournament-pairings` / `tournament-organizer` (slashinfty, TypeScript) usa blossom pesato a massima cardinalità: preferenza per punteggio uguale, bye al punteggio più basso fra chi non l'ha ancora avuto, rating simile se il torneo è ratato, alternanza del lato/posto. Supporta svizzera, girone, girone doppio, eliminazione singola e doppia, più playoff a seguire.
- **Vincoli assoluti vs preferenze**: niente rivincita e un solo bye sono **assoluti**; colore/lato/tavolo sono preferenze sacrificabili. Il criterio C4 dice la cosa importante: un abbinamento localmente ottimo che rende il round non completabile è illegale — un greedy non basta.
- **Determinismo**: il Dutch lo è per costruzione, il blossom **no** se i pesi pareggiano. Serve un tie-break stabile e, dove la casualità è voluta (round 1), un **seed registrato** insieme al round.

#### Bye

- MTR: round 1 casuale; nei round successivi il bye va a **un giocatore scelto a caso fra quelli col punteggio più basso che non l'hanno ancora ricevuto**. Vale come vittoria senza partita.
- FIDE: stessa sostanza (C2/C5/C9), più un dettaglio che pesa su E — **i round non giocati non entrano nella storia dei colori né nei tiebreak**.
- Esistono **tre bye diversi**, con origini diverse: strutturale (numero dispari), **premiale** (A6: i bye guadagnati in classifica di stagione, da materializzare *prima* del pairing del round 1), e da abbandono (l'avversario droppa a abbinamenti già fatti).

#### Drop

- MTR 2.10: il ritiro va comunicato **prima che vengano generati gli abbinamenti** del round successivo. Dopo, il giocatore viene comunque abbinato e **l'avversario prende un bye**. Chi non si presenta viene droppato d'ufficio.
- Rientro dopo un ritiro a discrezione del capo-arbitro, e **mai dopo il taglio**.

#### Ciclo di vita del round (TopDeck.gg, il più esplicito)

1. Pre-pairing: check-in chiuso, roster attivo confermato, impostazioni del round verificate (durata, best-of, modalità punti, tiebreak). Il round 1 segnala gli irrisolti (iscritti non registrati, roster di squadra incompleti).
2. Generazione: svizzera · *power pairing* (dall'alto della classifica, senza gruppi) · casuale · girone. Oppure **import di abbinamenti da un altro sistema** via CSV, riconciliati contro il roster.
3. **`publish` ≠ `start`, e la separazione è voluta**: publish rende visibili gli abbinamenti e **notifica tavolo e posto**; start fa partire il cronometro quando la sala è davvero pronta.
4. Round attivo: cronometro con pausa/ripresa, filtro dei tavoli con **estensione di tempo**, notifiche, feature match, deck check dal menu del tavolo.
5. Risultati: pulsanti rapidi coerenti col best-of, inserimento custom, flusso da sola tastiera (si digita il numero del tavolo). Con l'auto-refertazione attiva il giocatore propone e lo staff **conferma o contesta**.
6. Aggiustamenti a round aperto: trascinare giocatori fra tavoli, creare tavoli, spostare a bye o fra i non abbinati. **I tavoli con un risultato inserito si bloccano** finché non li resetti.
7. Chiusura: si lavora il filtro "manca il risultato" finché è vuoto, poi si guardano le classifiche con le colonne dei tiebreak.
8. Taglio: anteprima di chi resta fuori (per punti o per rango), poi bracket a potenza di due con bye automatici.
9. `End tournament` compare **solo quando ogni tavolo è certificato**.
10. Resilienza: se cade la rete le azioni vanno in coda e vengono **rigiocate in ordine** alla riconnessione.

#### Modello del match (Toornament, il più formalizzato)

- Tre tipi: **duel** (2 partecipanti, win/draw/loss) · **FFA** (n partecipanti, risultato per **rango**) · **bye** (1 partecipante). Il match a n non è un caso limite, è un tipo.
- Gli avversari sono **slot numerati**, non riferimenti diretti al partecipante: chi ci finisce dentro lo decide una procedura di piazzamento separata. Dopo il completamento gli slot si riordinano per rango.
- Esito **per slot**: `result` (duel/bye) · `rank` (FFA) · **`forfeit`** (booleano, ortogonale all'esito).
- Punteggio opzionale con **tipo** (punti o durata) e **intento** (vince il più alto o il più basso).
- **Match games**: sottodivisione numerata con avversari e punteggi propri, che condivide la numerazione degli slot del match. È il best-of.
- Stati: `pending` → `running` (appena entra un dato) → `completed` (esito completo e valido).

#### Multiplayer / pod (TopDeck, Commander)

- Pod da **4 di default**. Campi non divisibili: *bye mode* dichiarata **prima** dell'evento e pubblicata — o solo pod pieni con bye per gli avanzi, o pod da 3/5 pescando dall'alto o dal basso della classifica.
- Metodi: swiss pods · power pods · random · bubble.
- Risultato: un pulsante "vincitore" per posto, oppure punti; modalità di patta configurata a livello di evento; auto-refertazione opzionale.
- Come si punteggia un pod da 3 o 5 è **"una decisione di regolamento, non di software"**.
- Il taglio finale **resta a pod**, non diventa un bracket.

#### Squadre (ETC / WTC)

- Il match squadra-contro-squadra si **decompone** in n partite individuali, e chi gioca contro chi è deciso da un **sotto-processo negoziato fra i capitani** (uno schiera un difensore, l'altro propone due attaccanti…), non da un algoritmo. Le liste avversarie sono consultabili prima.
- Il punteggio della squadra è la somma dei differenziali dei singoli tavoli.
- Conseguenza: un match di squadra ha uno **stato intermedio** — abbinato ma non ancora spaiato sui tavoli — che nel modello individuale non esiste.

#### Tempo

- MTG: scaduto il tempo, chi ha il turno lo finisce e si giocano **cinque turni addizionali**; se la partita non finisce è **patta**. L'estensione dell'arbitro (ruling lungo, deck check) **sposta l'inizio** della procedura di fine round, e una pausa superiore al minuto va compensata.
- Wargame: round da **2,5–3 ore**. Gli orologi da scacchi sono stati introdotti dall'ITC nel 2018 e poi **vietati** nel nuovo regolamento GW dei World Championships, sostituiti da *milestone* temporali con penalità.
- Quindi il tempo non è un cronometro solo: c'è **il cronometro del round**, **l'estensione per singolo tavolo**, e in certi giochi **un orologio per giocatore**.

#### Chi inserisce il risultato

- Melee: il vincitore inserisce, l'avversario **conferma**; l'arbitro può correggere.
- Melee distingue due correzioni diverse: cambiare il **conteggio dei game** (2-0 → 2-1) si può sempre e non tocca gli abbinamenti; cambiare **l'esito** (vittoria → sconfitta) muove la classifica e forse abbinamenti già generati — in quel caso si corregge il risultato ma **gli abbinamenti restano quelli**. Nessun audit trail documentato: è una lacuna delle piattaforme esistenti, non un modello da copiare.
- Modifica abbinamenti: sparigliare un giocatore, riassegnarlo (di default al **tavolo libero più basso**), o assegnargli bye / sconfitta / drop. Avvertenza esplicita: se crei match in round già chiusi, devi anche inserirne il risultato.

#### Concessioni e patte concordate

- Si può concedere o **pattare intenzionalmente**. La patta senza partite giocate si registra `0-0-3`; la concessione dopo aver vinto un game si registra `2-1`. Cioè **il conteggio dei game va registrato anche quando non è stato giocato**, perché serve ai tiebreak (→ E).
- Vietato lo scambio con incentivi esterni, vietata la deliberazione di gruppo ("mettiamoci d'accordo per entrare tutti in top 8").
- Chi si rifiuta di giocare ha concesso.

#### Arbitraggio, ruoli, penalità

- **Quattro ruoli** (Melee): *Staff Admin* (tutto, anche a livello di organizzazione) · *Scorekeeper* (crea, modifica, abbina i round) · *Judge* (deck check, penalità, modifica ed inserimento risultati, servizi al giocatore) · *Coverage* (sola visibilità, nomi delle liste). Lo staff si assegna **a livello di organizzazione** e vale su tutti i suoi tornei; lo scorekeeper può aggiungere judge al singolo torneo.
- **Quattro penalità** (IPG): Warning · Game Loss · Match Loss · Disqualification. Il Game Loss si applica alla partita in corso o alla **successiva** se quella è finita; il Match Loss idem sul match. Più Game Loss simultanei → **uno solo**. La DQ fa perdere il match corrente e **droppa** dal torneo; i premi già consegnati restano.
- Il Warning esiste **per il registro**, non per la sanzione: lo scorekeeper lo inserisce e **avvisa l'arbitro quando un giocatore si avvicina all'upgrade**.
- **L'escalation è per evento**: le penalità di eventi passati non fanno scattare l'upgrade in quello corrente. Lo storico però esiste e serve alle indagini.
- Chiamata arbitro dal telefono del giocatore, agganciata al tavolo (Limitless).

#### Live in sala

- `publish` notifica **tavolo e posto** al giocatore. Il display da proiettore è configurabile (griglia, densità, cosa mostrare) e il **timer sta su uno schermo separato**.
- B7 (tavolo 1 = i più forti) rende l'assegnazione del tavolo un **output del motore**, non una decorazione del display.

### Decisioni

| # | Decisione |
|---|---|
| D1 | **Motore a matching di peso massimo (blossom pesato)**, non FIDE procedurale. Tutte le regole sono pesi; il no-rematch è l'unico vincolo assoluto. |
| D2 | Il motore **produce un abbinamento e basta: niente "rigenera"**. L'organizzatore può però **modificare a mano** gli abbinamenti prodotti. |
| D3 | **Nessun vincolo oltre no-rematch e bye.** Nei giochi in cui la posizione conta (lato, colore, primo turno), alternanza **pesata**, non imposta. |
| D4 | **Round 1 sempre casuale.** Alcuni eventi possono assegnare **bye premiali** a giocatori scelti, anche **per più round** e non solo il primo. |
| D5 | **Il bye è sempre una vittoria piena**, qualunque sia la sua origine. |
| D6 | Chi ha già ricevuto un bye non dovrebbe riceverne un altro, ma **non è impossibile**: peso altissimo nel blossom, non esclusione. Il bye strutturale va al più basso in classifica. |
| D7 | **Tre atti separati**: `genera` (abbinamenti calcolati ma invisibili) → `pubblica` (visibili ai giocatori) → `avvia` (parte il tempo). Il terzo esiste **solo per i giochi a tempo**. |
| D8 | Un round si può **riaprire** per correggere i risultati. Si **annulla solo il round corrente**, fino alla sua chiusura inclusa; per risalire a un round precedente si annulla a ritroso, uno alla volta. |
| D9 | Il round successivo **non si genera** finché mancano risultati. |
| D10 | Il risultato lo inserisce **lo staff o un giocatore**. **Un solo inserimento è già valido**; la conferma dell'avversario è gradita e produce solo un **segno visivo** di risultato confermato. Judge e organizzatore possono sovrascrivere. Nelle squadre basta **un membro qualunque**. |
| D11 | Correzione di un risultato dopo che il round successivo è già abbinato: il sistema **propone un ri-abbinamento**; se l'organizzatore rifiuta, si prosegue con gli abbinamenti attuali ma **col punteggio corretto**. |
| D12 | **Audit trail sì**, su risultati e su modifiche agli abbinamenti. |
| D13 | **Ruoli per singolo evento**, non per organizzazione: *organizzatore* (chi ha creato il torneo) · *head judge* · *judge* · *scorekeeper*. |
| D14 | **Penalità in v1, registrate e con effetto**: *game loss* fa perdere **una partita** nei giochi che hanno un conteggio di partite (`best_of_N`), e **vale come match loss dove le partite non esistono** · *match loss* fa perdere il match · *disqualification* fa perdere il match corrente, **lascia in piedi i risultati già inseriti** e droppa dall'evento · *warning* è **solo verbale, nessuna conseguenza**. **Nessun upgrade automatico.** |
| D15 | **Chiamata arbitro dal telefono del giocatore in v1.** |
| D16 | Nel match di squadra lo spaiamento sui tavoli è **manuale e simultaneo cieco**: ciascun capitano ordina i propri membri sui tavoli 1..n senza vedere l'altro, e quando entrambi hanno confermato il sistema rivela e incrocia tavolo per tavolo. Il capitano che non schiera in tempo riceve un'**assegnazione automatica in ordine casuale**. |
| D17 | **In v1 un match mette insieme sempre due entità**, dove un'entità può contenere più giocatori: i tornei **a squadre** sono fra le prime cose da fare, i **pod con più di due entità** sono rimandati a versioni successive. Il modello a slot resta comunque quello di Toornament, così l'FFA potrà entrare senza rifarlo. |
| D18 | **Tre regimi di tempo**: nessun tempo · **tempo globale di round** con estensione per tavolo · **tempo per tavolo**. Col tempo globale il cronometro sta sul TV della sala *e* sul telefono di ogni giocatore, ciascuno col proprio offset di estensione. Col tempo per tavolo il cronometro è **sincronizzato fra i giocatori di quel tavolo**. |
| D19 | **Refertazione contraddittoria** → il match passa in **`contestato`**: il primo risultato inserito resta valido ai fini della classifica, lo staff riceve una notifica e decide. |
| D20 | La **modifica manuale degli abbinamenti avvisa ma non impedisce mai**, nemmeno se produce una rivincita: in sala l'autorità è l'organizzatore. L'override finisce nell'audit trail con la motivazione. |
| D21 | **Un judge può giocare l'evento che arbitra.** |

### Proposte tecniche

**Il grafo del blossom.** Un nodo per `Entrant` attivo. Arco fra `a` e `b` **solo se non si sono già incontrati**: il no-rematch è *assenza di arco*, non un peso — è assoluto e toglie lavoro al solver. Peso dell'arco come somma di termini:

| Termine | Peso | Perché |
|---|---|---|
| base | `+1000` | ogni accoppiamento vale tanto: la **massima cardinalità** viene prima di ogni preferenza |
| differenza di punti | `− (Δpunti)² · 10` | quadratico, così due abbinamenti a distanza 1 battono uno a distanza 0 e uno a 2 |
| stesso lato/posto conteso | `− 5`, oppure `− 15` se per entrambi la preferenza è "assoluta" | D3: preferenza, mai vincolo |
| stesso tavolo del round precedente | `− 1` | solo estetica, e rompe i pareggi in modo stabile |

**Il bye come nodo fittizio.** Campo dispari → si aggiunge un nodo `BYE` collegato a tutti, con peso `+1000 − posizione_in_classifica · 2 − (ha_già_avuto_un_bye ? 10000 : 0)`. Il bye finisce così al più basso in classifica (D6) e chi l'ha già avuto lo riprende solo se non esiste alternativa — che è esattamente "difficile ma non impossibile".

**Perché il blossom risolve gratis il criterio FIDE C4.** Un abbinamento greedy può bloccarsi lasciando due giocatori che si sono già incontrati; il matching a massima cardinalità garantisce per costruzione che, se un abbinamento completo esiste, lo trova. Data D2 (niente "rigenera"), è proprio la proprietà che serve: il motore deve azzeccarlo al primo colpo.

**Determinismo.** Ordinamento stabile degli entrant, `seed` esplicito **registrato sul round** insieme alla versione del motore. A parità di peso vince l'indice più basso. Il round 1 non usa i pesi: è un mescolamento con RNG seedato. Rieseguire il seed dà lo stesso abbinamento a distanza di mesi — è la stessa semantica di congelamento di A4/B.

**Protocollo del cronometro.** Il server **non manda mai i secondi rimanenti**: manda `{ fine_prevista, pausa_accumulata, stato }` più il proprio `now`. Il client calcola l'offset una volta e poi conta da solo — telefono in tasca, tab in background e riconnessioni non producono deriva. La pausa registra `pausa_iniziata_a` e alla ripresa sposta `fine_prevista`: **il cronometro è un fatto nel database, non un `setInterval` sul server**. SSE trasmette solo i cambi di stato (avvio, pausa, ripresa, estensione), non un tick al secondo. L'estensione per tavolo è una `fine_prevista` propria del match, ed è anche ciò che sposta l'inizio della procedura di fine round. Il regime "tempo per tavolo" usa la stessa struttura senza la `fine_prevista` di round. Coerente con `RoundTimer`, che tiene `now = null` fino a `onMounted`.

**Modello dati.** `Stage` (le fasi di B3) → `Round` → `Match` → `Board`/`Game`. Il `Match` prende la forma di Toornament: `kind: duel | ffa | bye` e **slot numerati** con `entrant_id`, `result`, `rank`, `forfeit`, `score` — così il duello 1v1, il pod da 4 e il match di squadra sono lo stesso oggetto. Il `Round` porta `stato: bozza | pubblicato | avviato | chiuso | annullato`, `seed`, `versione_motore`. Accanto: `Penalita`, `ChiamataArbitro`, `EstensioneTempo` e il log di audit.

**Il motore resta TypeScript puro**, senza Nuxt e senza database: prende entrant, storico e configurazione, restituisce abbinamenti. Fixture e test come da fondamenta.

### Conseguenze sul modello

- **D17 riduce lo scopo del motore a uno solo.** Il blossom accoppia due nodi; partizionare in pod da quattro è un problema diverso e in generale NP-difficile, che avrebbe richiesto una seconda euristica accanto alla prima. Rimandando i pod, in v1 c'è **un motore solo**. Il modello a slot va tenuto lo stesso, perché è ciò che permetterà all'FFA di entrare senza riscrivere match, risultati e classifica.
- **D14 si aggancia a B2 invece di contraddirlo**: l'effetto del *game loss* dipende dall'archetipo di risultato del ruleset congelato — toglie una partita in `best_of_N`, vale come match loss altrove. La penalità non ha quindi un effetto proprio: ha una **traduzione** nella forma di risultato di quel gioco.
- **D2 + D11 vanno letti insieme**: non esiste "rigenera" come pulsante libero, esiste **una proposta di ri-abbinamento nata da una correzione**, col diff rispetto agli abbinamenti attuali. Ha senso solo se il round successivo è generato ma **non ancora avviato**: se si sta già giocando si corregge solo il punteggio.
- **D8 è economico solo perché la classifica è un read model** sul log dei match (fondamenta): annullare un round è cancellare i suoi fatti e ricalcolare, non "disfare" una classifica materializzata.
- **D19 + D12**: uno stato `contestato` senza audit trail non serve a niente — è proprio il caso in cui l'organizzatore deve poter vedere chi ha scritto cosa e quando.
- **D21 apre un conflitto d'interessi da chiudere in codice**: un judge che gioca non deve poter arbitrare, correggere o penalizzare il proprio match. È un controllo di permesso a livello di match, non di ruolo.

---

## E · Classifica e tie break

### Ricerca

#### Il punteggio del match non è la classifica

- **MTG / Melee**: match points **3 vittoria · 1 patta · 0 sconfitta**, poi quattro livelli — *match points → OMW% → GW% → OGW%*.
- **Warhammer: The Old World**: i punti sono **derivati da una soglia** sulla differenza di VP — 6 Crushing Victory · 5 Resounding · 4 Marginal · **3 Draw** (differenza 0–100) · 2 · 1 · 0. Le soglie **dipendono dalla dimensione dell'esercito**. Tiebreak: VP totali → VP da obiettivi secondari → generali nemici uccisi → **discrezione dell'organizzatore, annunciata in anticipo**.
- **40k**: i *battle points* come tiebreak hanno una critica nota e documentata — premiare il margine **incentiva a tenere basso il punteggio** per non incontrare i più forti al round successivo. Molti eventi sono passati allo *Strength of Schedule*.
- Conferma diretta di B2: la funzione risultato → punti appartiene al **ruleset**, non al motore.

#### La percentuale con il pavimento

- **MTG**: `OMW% = media delle MW% degli avversari`, con **pavimento al 33%**; `GW% = game vinti / game giocati`; `OGW%` = media delle GW% avversarie, stesso pavimento. **I bye non entrano nel calcolo dell'OMW%.**
- **Pokémon**: stesso schema ma **pavimento 25% e tetto 75%**, e i round di bye **non contano affatto** nel calcolo. Poi si passa a *Opponent's Opponent's Resistance*.
- Quindi il pavimento è un **parametro della funzione**, non una costante: 33 per MTG, 25/75 per Pokémon.

#### FIDE: il catalogo formale e l'avversario virtuale

- Il punto tecnicamente più difficile di tutto E è **come contano i round non giocati**. FIDE lo risolve con **l'avversario virtuale**: per i tiebreak *del giocatore stesso*, un round non giocato vale come una partita contro un fantoccio che **chiude il torneo con lo stesso punteggio del giocatore**. Per i tiebreak *degli avversari*, il round non giocato prende il risultato corrispondente ai punti assegnati; i bye a zero punti di fine torneo valgono come patta.
- Cinque categorie di round non giocato, trattate diversamente: bye a punto pieno · vittoria a forfait · bye richiesto con round successivi giocati · sconfitta a forfait · bye richiesto senza round successivi.
- **Catalogo dei tiebreak per tipo**: *DE* scontro diretto · *WIN / WON / PS / GE* record proprio (vittorie, partite vinte sul tavolo, punteggi progressivi, partite che si è scelto di giocare) · *BH / AOB / FB* Buchholz, Buchholz medio degli avversari, **Fore Buchholz** (come se tutte le partite dell'ultimo round finissero patte) · *SB* Sonneborn-Berger (somma dei punteggi finali degli avversari moltiplicati per i punti fatti contro di loro) · *ARO / TPR* basati sul rating.
- Modificatore **Cut-1**: si esclude il contributo peggiore, e se il giocatore ha round non giocati volontari **si taglia prima quello**.
- Altri classici fuori FIDE: **Median/Harkness** (esclude il più alto e il più basso) · **Solkoff** (nessuna esclusione) · **cumulativo/progressivo** (somma del punteggio alla fine di ogni round: premia chi parte forte; si sottrae 1 per ogni vittoria non giocata).
- Chiusura onesta del regolamento: esaurita la lista dei tiebreak, **si sorteggia**.

#### Squadre: due punteggi paralleli

- Ogni squadra ha **Match Points** (esito dell'incontro squadra-contro-squadra) e **Game/Board Points** (somma dei singoli tavoli). **Quale dei due è la classifica primaria e quale il tiebreak dipende dal regolamento**, non dal software. Olimpiadi: SB → game points totali → somma dei match point degli avversari **escluso il peggiore**.

#### Taglio e bracket

- Il taglio è tipicamente a potenza di due (4/8/16/32) proprio per avere un bracket pulito; il seed viene dalla classifica svizzera finale, mappatura 1v8, 2v7, …
- Eliminazione doppia: il perdente della finale del *loser bracket* è **terzo senza spareggio** — è il vantaggio strutturale del formato. La grand final può avere il *bracket reset*, e il secondo posto può arrivare da entrambi i rami.

#### Giocatori ritirati

- Restano in classifica **con il loro record e i loro tiebreak**. Alcune piattaforme (Limitless) offrono l'opzione di **spostarli in fondo senza piazzamento**: è una scelta di prodotto, non una regola.

#### Ricalcolo

- Le piattaforme ricalcolano i tiebreak a **ogni inserimento di risultato**. Con la classifica come read model sul log dei match (fondamenta) la scelta è fra ricalcolo a lettura e materializzazione con invalidazione.

### Decisioni

| # | Decisione |
|---|---|
| E1 | **Catalogo dei tiebreak in v1**: `OMW%` · `GW%` · `OGW%` · **punteggio continuo totale** (i VP) · **Strength of Schedule / Buchholz** · **scontro diretto** · **numero di vittorie**. Il ruleset ne dichiara una **lista ordinata di funzioni nominate**. |
| E2 | **Pavimento e tetto sono parametri della funzione**, dichiarati dal ruleset: 33% alla MTG, 25–75% alla Pokémon, o nessuno. |
| E3 | **I punti per esito stanno nel ruleset**; 3-1-0 è il default. **La patta esiste, ma non in tutti i ruleset.** |
| E4 | **Il bye è una vittoria piena contro un avversario virtuale al 100%.** Il round entra nel proprio record come vittoria, e l'avversario fittizio entra nell'`OMW%` e nell'`OGW%` valendo 100% — **ma rispetta il tetto** dichiarato dal ruleset, quindi con un tetto al 75% vale 75%. Il bye quindi **alza** i tiebreak invece di abbassarli. |
| E5 | **Vittoria per forfait, per ritiro dell'avversario o per penalità non è un bye**: è una sconfitta di un avversario reale e conta come una vittoria normale in tutti i calcoli, con le percentuali vere di quell'avversario. |
| E6 | Il bye vale **vittoria piena anche in partite**: contribuisce al `GW%` il punteggio pieno previsto dal ruleset (2-0 in un Bo3), e il suo avversario virtuale ha `GW% = 100%`. |
| E7 | **Il ritirato resta in classifica alla sua posizione**, con il suo record. |
| E8 | Parità che sopravvive a tutti i tiebreak → **sorteggio**, con il seed registrato e quindi verificabile. |
| E9 | Taglio che non è potenza di due (criterio B3 "tutti a pari punteggio con l'n-esimo") → **bye ai seed più alti fino a riempire il bracket**. |
| E10 | Il **seeding del bracket si congela all'inizio del round**; una correzione arrivata *prima* dell'inizio lo rifà. |
| E11 | **In eliminazione diretta e doppia la patta è disabilitata**: non è un risultato inseribile. Si continua a giocare finché non c'è un vincitore. |
| E12 | Squadre: la classifica primaria sono i **match point** dell'incontro. **Nessuna classifica individuale** dentro l'evento a squadre. |
| E13 | La classifica pubblicata è **congelata all'ultimo round chiuso**. |
| E14 | **Uno snapshot di classifica per round**, calcolato alla chiusura. Il ricalcolo dal log resta l'autorità e un comando di riparazione, non il percorso normale. |

### Proposte tecniche

**La formula, scritta per intero** (E4 + E6), perché il bye tocca sia il proprio record sia la lista degli avversari:

- `MW%` di un giocatore = `punti match ottenuti / (punti per vittoria × round giocati)`, dove **il round di bye conta come vittoria** sia al numeratore sia al denominatore.
- `OMW%` = media delle `MW%` degli avversari, dove **ogni bye aggiunge alla lista un avversario virtuale con `MW% = 100%`**.
- `GW%` = `partite vinte / partite giocate`, dove il bye aggiunge **il punteggio pieno di partite** previsto dal ruleset (2-0 in un Bo3).
- `OGW%` = come `OMW%`, con l'avversario virtuale del bye a `GW% = 100%`.
- Ogni percentuale passa poi per `max(pavimento, min(tetto, valore))` con i parametri del ruleset (E2), **l'avversario virtuale del bye compreso**: con un tetto al 75% il bye vale 75%, non 100%.

**Lo snapshot per round.** Alla chiusura del round si calcola la classifica una volta e la si salva come riga di storia: è la classifica *dopo il round n*. Vantaggi diretti: la storia ("com'era dopo il round 3") è gratis, E10 diventa "il seed del bracket è lo snapshot del round n", e annullare un round (D8) è cancellare uno snapshot. Riaprire un round invalida il suo snapshot e quelli successivi.

**Il calcolo è una funzione pura**, nello stesso modulo TypeScript del motore di abbinamento: prende il log dei match e la configurazione del ruleset, restituisce la classifica. Niente Nuxt, niente database, fixture e test come per il pairing.

### Conseguenze sul modello

- **E4 + E6 fanno del bye il miglior avversario possibile**, ed è una scelta di compensazione opposta a quella di MTG (che lo esclude) e del Pokémon TCG (che lo ignora): qui il bye non deve penalizzare nessuno, quindi paga il massimo. Due conseguenze da tenere a mente: chi riceve **bye premiali** (A6/F8) si ritrova un `OMW%` strutturalmente gonfiato — due bye premiali valgono due avversari imbattuti — e il **bye strutturale**, che D6 manda al più basso in classifica, dà proprio a quel giocatore la resistenza massima. Nessuna delle due cosa è un errore, ma sono effetti voluti da riconoscere quando si guarderà una classifica strana.
- **E13 semplifica il live in sala**: durante un round via SSE viaggiano abbinamenti, cronometro e stato dei tavoli — **mai la classifica**. Una preoccupazione in meno e un'informazione in meno data ai giocatori mentre giocano.
- **E12 non impedisce le statistiche di F**: i singoli tavoli restano registrati (D16), quindi il win rate e i matchup del singolo giocatore sono comunque calcolabili. È la *classifica* individuale a non esistere, non il dato.
- **E8 obbliga a salvare il sorteggio come fatto** (seed ed esito): un sorteggio non registrato renderebbe la classifica non riproducibile, in contraddizione con le fondamenta.
- **E11 disinnesca il cronometro nelle fasi a eliminazione.** Se la patta non è un risultato inseribile, la fine del tempo non può chiudere la partita: nelle fasi a eliminazione la procedura di fine round non produce un esito, si continua a giocare. Il cronometro di D18 lì è informativo (serve a capire quanto si sta sforando), non decisivo. Il ruleset deve poter dichiarare che quella fase **non ha un esito a tempo**.
- **E1 + E3 rendono il ruleset l'unico posto dove vive la matematica della classifica.** Il motore non conosce né OMW% né VP: applica una lista di funzioni nominate che il ruleset gli passa. Aggiungere un gioco resta configurazione.

---

## F · Post-torneo

### Ricerca

#### Come i circuiti calcolano i punti

- **FIDE Circuit** — la formula pubblicata più pulita che esista: **`P = B × k × w`**, dove `B` sono i punti base per piazzamento (2–11), `k` è la **forza del torneo** = `(TAR − 2500) / 100` con TAR media rating dei migliori, e `w` il peso del formato (0,4–2,0). Ammissibilità dell'evento: almeno 8 giocatori, 7 round, media rating dei primi 8 ≥ 2550, almeno 3 federazioni rappresentate. Conta la somma dei **migliori 7 tornei**, con **quote per categoria** (max 4–5 eventi sotto i 50 giocatori, max 2 rapid/blitz). Il vincitore entra nel Candidates.
- **ITC / BCP** — i punti dipendono da **piazzamento + numero di vittorie + presenze**, e il *bonus presenze* è il moltiplicatore chiave. Nel 2025 la distanza fra eventi grandi e piccoli è stata **ridotta**, con la crescita per singolo partecipante più ripida fra 20–64 e fra 128–256 giocatori. Il tetto di punteggio è implicito nella taglia: un RTT non può valere quanto un GT. Max 6 eventi, di cui max 4 di taglia RTT.
- **UKTC** — adotta direttamente il sistema BCP. Stagione da un evento cardine al successivo. Per le squadre accumula i **10 punteggi migliori fra tutti i membri**.
- Tre sistemi, **un solo schema**: `punti = f(piazzamento, percorso, taglia) × pesi`, poi **best-N con quote per categoria**. Conferma A3, A4 e A8.

#### La pubblicazione è un atto con scadenza

- USA Ultimate: risultati entro **la fine del giorno successivo**. Esports (The Finals): **72 ore**, e la submission include la dichiarazione che **non ci sono dispute aperte**. Pickleball: una settimana. Pokémon: **7 giorni** dal portale, e chi sfora è *delinquent* e rischia di non poter più ospitare eventi Premier. NAF: probation per l'organizzatore che non riporta, e **ogni match giocato deve finire nel database**.
- Due cose per noi: la pubblicazione ha una **scadenza con conseguenze sull'organizzazione**, e fra le condizioni di pubblicabilità c'è **zero dispute aperte** — aggancio diretto allo stato `contestato` di D19.

#### Le qualifiche sono un bene contingentato

- RCQ: un negozio WPN può ospitare 3 eventi per round di stagione; un RCQ di negozio normale **emette una qualifica**, uno Premium **due**, e ognuno richiede l'acquisto di un kit.
- Conferma A: la qualifica ha un payload, un emittente, una quota di emissione e un consumo. Non è un flag.

#### Rating e punti circuito sono due cose diverse

- I punti di circuito sono **stagionali e si azzerano**; Elo/Glicko misurano la **forza corrente** e non si azzerano mai. Glicko aggiunge l'**RD**, la deviazione: la fiducia nella stima **cresce giocando e decade col tempo**, quindi un inattivo ha un rating *meno certo*, non semplicemente vecchio.
- Serve tenerli separati: se un giorno vogliamo abbinare per forza (il peso previsto in D3) serve un rating, non i punti di circuito.

#### Punteggi "soft": la classifica non è solo funzione dei match

- Molti eventi wargame non classificano solo sulle partite. Un esempio pubblicato pesa **battaglia 60% · sportività 30% · pittura 10%**. La pittura la valutano i giudici con una **rubrica** (checklist) diversa per ogni evento; la sportività viene da valutazioni fra giocatori.
- È un punteggio **per-evento non derivato dal log dei match**, che entra nella classifica finale con un peso. Tocca E (la classifica non è più solo una funzione del log) e B (il ruleset deve poter dichiarare componenti di punteggio extra).

#### Statistiche del giocatore

- BCP Rankings è alimentato dagli eventi caricati e ha scope **locale, regionale e mondiale**. Piattaforme terze aggregano storico tornei, breakdown dei mazzi e trend dei matchup.
- Nulla di nuovo da inventare: sono un secondo read model sul log. Va deciso *cosa* si espone, non come si calcola.

### Decisioni

| # | Decisione |
|---|---|
| F1 | La ranking policy è una **forma fissa parametrizzata** (tabella dei punti base per piazzamento × moltiplicatore di taglia × peso dell'evento), non un'espressione configurabile. Nessun interprete da scrivere. |
| F2 | **Best-N per categoria**: le quote per taglia di evento ci sono, non solo il best-N liscio. |
| F3 | La policy usa il **piazzamento**. Non il percorso. |
| F4 | La pubblicazione è **manuale dell'organizzatore**. |
| F5 | Le condizioni le **conferma il circuito**: zero match contestati · zero risultati mancanti · minimo giocatori · ruleset non custom (B1). |
| F6 | **Scadenza di pubblicazione: 7 giorni.** Chi sfora prende un **warning all'organizzazione**. |
| F7 | Un evento pubblicato si può **correggere e ritirare**. |
| F8 | **I bye si emettono da soli**: alla chiusura dell'evento per gli eventi che ne prevedono, alla chiusura della stagione se sono premio di classifica. Si registra **quanti e a chi**. Finiscono **nell'account del giocatore, non su un evento specifico**, e **scadono al circuito successivo** (di norma un anno). |
| F9 | **Quote di emissione in v1** (modello RCQ: quante qualifiche può emettere un evento, quanti eventi può ospitare un'organizzazione). |
| F10 | **Punteggi soft (pittura, sportività) fuori dalla v1.** |
| F11 | **Rating tipo Elo/Glicko per i circuiti che lo supportano.** |
| F12 | Statistiche del giocatore: **tutto tranne fazione e archetipo**. |
| F13 | Profilo pubblico: un estraneo vede **gli eventi a cui il giocatore ha partecipato e il piazzamento**. |
| F14 | La **lega interna pubblica con lo stesso meccanismo del circuito**. |

### Conseguenze sul modello

- **F8 corregge il modello della qualifica dato in A e in C9.** In A la qualifica aveva un `evento_destinazione`; F8 dice il contrario: il bye **sta nell'account del giocatore** e vale su qualunque evento del circuito che lo accetti, fino alla scadenza. Quindi il consumo non è "prenoto l'evento per cui ho il diritto" ma **"spendo un credito che ho"** — un portafoglio di diritti, non una prenotazione nominale. Cambia C9 e semplifica la prenotazione.
- **F7 + A4 rendono il ricalcolo un fatto di stagione, non di evento.** Correggere un evento già pubblicato obbliga a rieseguirlo con la sua policy congelata, e se cambia il suo punteggio possono cambiare i **best-N di altri giocatori che in quell'evento non c'erano**. Il ricalcolo si propaga a tutta la stagione del circuito: va progettato come job (pg-boss), non come effetto sincrono di una `PATCH`.
- **F11 aggiunge una dimensione temporale che il resto del sistema non ha.** L'RD di Glicko **decade con l'inattività**: il rating cambia anche quando non succede niente. Serve un job periodico oppure un calcolo pigro alla lettura che tenga la data dell'ultimo aggiornamento. È l'unico numero del sistema che non è funzione pura del log.
- **F6 chiede un'entità, non un contatore**: il warning all'organizzazione ha un chi, un quando, un perché e un evento di riferimento.
- **F3 è la scelta più semplice e anche la più criticata.** Con il solo piazzamento, due giocatori arrivati decimi prendono gli stessi punti anche se uno ha vinto cinque partite e l'altro tre: è esattamente ciò che ITC ha voluto evitare introducendo il percorso. Accettabile, ma il moltiplicatore di taglia resta l'unico correttivo.
- **F13 + C7 danno l'esposizione più ampia possibile**: di una persona che non ha mai aperto un account resteranno pubblici nome, eventi e piazzamenti. Coerente con le decisioni prese, ma è il punto del sistema in cui vale la pena avere una pagina di informativa e una procedura di rimozione.

---

## Architettura a fasi (trasversale)

Il torneo è una **sequenza di fasi modulari e concatenabili**. Il contratto è uno solo:

> Ogni fase prende **un elenco ordinato di partecipanti** e restituisce **un elenco ordinato di partecipanti**.

Davanti a ogni fase può esserci un **gate**, che taglia l'elenco in ingresso (top 8, per punti, o "tutti quelli a pari punteggio con l'n-esimo" — i tre criteri di B3). Il gate è **separato dalla fase**: "top 8" non è una proprietà dell'eliminazione diretta, ed è per questo che si può mettere un taglio anche davanti a una seconda fase svizzera (il day 2). Alcuni **template di evento hanno fasi già standardizzate e non modificabili** (B4: il circuito impone il template).

**Conseguenze:**

- **L'ordine in ingresso è il seeding, l'ordine in uscita è la classifica.** È la stessa lista che cambia significato attraversando la fase, e questo rende la concatenazione possibile.
- **Ogni fase deve saper linearizzare anche quando la sua logica non lo fa.** L'eliminazione diretta produce un ordine *parziale*: i quattro perdenti dei quarti sono tutti "quinti". Ogni tipo di fase deve quindi dichiarare la propria regola di linearizzazione — per l'eliminazione: prima il round in cui sei uscito, poi il seed d'ingresso; e in ultima istanza il sorteggio registrato di E8.
- **La classifica finale dell'evento si compone a ritroso**, impilando: chi è arrivato in fondo all'ultima fase, poi chi è stato tagliato dall'ultimo gate nel suo ordine, poi chi è stato tagliato prima. I tagliati non spariscono, si sedimentano.
- **Lo snapshot di classifica (E14) è per round dentro la fase**, e la classifica dell'evento è l'output dell'ultima fase — non lo snapshot dell'ultimo round.
- **Le impostazioni operative sono per fase, non per evento**: durata del round, best-of, tempo sì/no. Un top cut in Bo3 dopo una svizzera in Bo1 è il caso normale, non l'eccezione.
- **Il gate che non è potenza di due** (terzo criterio di B3) produce i bye del bracket, assegnati ai seed più alti (E9).
- **Il motore di abbinamento non cambia**: una fase è una strategia di abbinamento più una regola di linearizzazione. Il blossom di D1 serve la svizzera; girone ed eliminazione hanno strutture proprie ma lo stesso contratto esterno.

**Decisioni:**

- **I punti non si ereditano fra le fasi**, ma esiste l'opzione per farlo: lo dichiara la fase, default `no`.
- **Il vincolo di no-rematch vale dentro la fase**, non sull'intero evento: in un top cut si rigioca contro chi si è già incontrato in svizzera.
- Nelle fasi a eliminazione **la patta è disabilitata** (E11): il tempo non chiude la partita, si gioca fino al vincitore.

---

## Fonti consultate

Melee.gg Help (decklist per organizzatori e giocatori) · [MTR Appendix E](https://blogs.magicjudges.org/rules/mtr-appendix-e/) · [ITC 2025 — Warhammer Community](https://www.warhammer-community.com/en-gb/articles/x96wp1cj/itc-2025-key-changes-to-the-competitive-warhammer-calendar/) · [ITC scoring — Goonhammer](https://www.goonhammer.com/measuring-up-the-competition-a-review-of-the-itc-scoring-system) · [RCQ — WPN](https://wpn.wizards.com/en/news/regional-championship-qualifier-format-update-and-upcoming-promo-cards) · [Best Coast Pairings](https://www.bestcoastpairings.com/) · [Longshanks](https://www.longshanks.org/) · [EventLink — WPN](https://wpn.wizards.com/en/news/definitive-guide-wizards-eventlink) · [Toornament — Stages](https://developer.toornament.com/v2/core-concepts/structure/stage) · [Old World — Scoring & Tiebreakers](https://tow.whfb.app/matched-play/scoring-and-tiebreakers) · [Battlefy — Waitlists](https://medium.com/battlefy/waitlists-for-tournaments-2ec497e3ffb6) · [Battlefy — Check-in](https://help.battlefy.com/en/articles/2616770-tournament-check-in-feature) · [Melee — Decklists for organizers](https://help.melee.gg/docs/decklists-for-organizers/) · [MTR 2.7 — Deck registration](https://blogs.magicjudges.org/rules/mtr2-7/) · [start.gg — Teams](https://blog.start.gg/teams-for-tournaments-799b2d9d17ef) · [start.gg — Attendee management](https://help.start.gg/category/attendee-management) · [EventLink — QR player registration](https://wpn.wizards.com/en/news/wizards-eventlink-update-qr-code-player-registration) · [Toornament — Registration fees](https://help.toornament.com/plans/registration-fees)

**Blocco D:** [FIDE Dutch — algoritmo di pairing](https://chesspairings.org/en/guide/the-pairing-algorithm/) · [Designing chess pairing mechanisms (Biró et al.)](https://real.mtak.hu/80729/7/jXaio4T11ygd57-77-86.pdf) · [Swiss-system chess tournaments and unfairness (arXiv)](https://arxiv.org/pdf/2410.19333) · [slashinfty/tournament-pairings](https://github.com/slashinfty/tournament-pairings) · [tournament-organizer](https://github.com/slashinfty/tournament-organizer) · [MTR 10.4 — Pairing algorithm](https://blogs.magicjudges.org/rules/mtr10-4/) · [MTR 2.10 — Dropping](https://blogs.magicjudges.org/rules/mtr2-10/) · [MTR 2.5 — Concessioni e patte](https://blogs.magicjudges.org/rules/mtr2-5/) · [MTR 2.4 — End-of-match procedure](https://blogs.magicjudges.org/rules/mtr2-4/) · [IPG 1.1 — Definizione delle penalità](https://blogs.magicjudges.org/rules/ipg1-1/) · [Melee — Staffing](https://help.melee.gg/docs/staffing/) · [Melee — Editing pairings](https://help.melee.gg/docs/editing-pairings/) · [Melee — Fixing incorrect results](https://help.melee.gg/docs/fixing-incorrect-results/) · [TopDeck.gg — Running an event](https://topdeck.gg/help/running-a-tournament) · [TopDeck.gg — Running Commander events](https://topdeck.gg/help/running-commander-tournament) · [Toornament — Match (core concepts)](https://developer.toornament.com/v2/core-concepts/match/) · [Goonhammer — 40k team tournaments](https://www.goonhammer.com/start-competing-40k-team-tournaments/) · [Goonhammer — Time is of the Essence](https://www.goonhammer.com/start-competing-time-is-of-the-essence/)

**Blocco E:** [FIDE — Tie-Break Regulations](https://handbook.fide.com/chapter/TieBreakRegulations042024) · [FIDE — Esercizi di tie-break (Held)](https://tec.fide.com/wp-content/uploads/2024/04/C.07-2023-Tiebreak-exercises-V01-1.pdf) · [Tie-breaking in Swiss-system tournaments (Wikipedia)](https://en.wikipedia.org/wiki/Tie-breaking_in_Swiss-system_tournaments) · [Melee — Swiss, top cut e standings](https://help.melee.gg/docs/understanding-melees-swiss-top-cut-pairings-and-standings/) · [MTG Event — Tiebreakers explained](https://www.mtgevent.com/blog/magic-the-gathering-tiebreakers-explained/) · [RK9 — Tiebreakers nel Pokémon TCG](https://rk9.gg/article/20210525-all-about-tiebreakers-in-the-pokemon-tcg) · [Old World — Scoring & Tiebreakers](https://tow.whfb.app/matched-play/scoring-and-tiebreakers) · [Frontline Gaming — incentivi dei battle points](https://frontlinegaming.org/2022/12/09/does-tournament-40k-need-an-incentive-not-to-game-the-system/) · [ChessPairings — Team tournaments](https://chesspairings.org/en/guide/team-tournaments/) · [Limitless — Tournament settings](https://docs.limitlesstcg.com/organizer/reference)

**Blocco F:** [FIDE Circuit 2025 — formula dei punti](https://en.wikipedia.org/wiki/2025_FIDE_Circuit) · [ITC 2025 — cambiamenti](https://www.warhammer-community.com/en-gb/articles/x96wp1cj/itc-2025-key-changes-to-the-competitive-warhammer-calendar/) · [Frontline Gaming — revisione ITC 2025](https://frontlinegaming.org/2025/02/21/massive-overhaul-coming-to-the-itc/) · [UKTC — Rankings](https://www.uktc.events/uktc) · [BCP Rankings](https://bestcoastpairings.zendesk.com/hc/en-us/articles/360003431571-BCP-Rankings) · [RCQ — FAQ per i negozi](https://wpn.wizards.com/en/news/regional-championship-qualifiers-retailer-facing-faq) · [Pokémon — Sanctioning e reporting](https://support.pokemon.com/hc/en-us/articles/40087181036948-Sanctioning-and-Reporting-League-Cups-and-Challenges) · [NAF — Regolamento tornei](https://www.thenaf.net/tournaments/nafdocs/naf-regulations-for-tournaments/) · [Glicko rating system](https://www.glicko.net/glicko/glicko.pdf) · [Hellfire Hobbies — Painting & hobby score](https://hellfirehobbies.com/hobby-score/) · [Old World Rankings — Scoring](https://www.oldworldrankings.com/docs/scoring/)
