# Linee guida — ecosistema tornei

Sintesi del brainstorm progettuale: i concetti che il sistema deve rispettare, senza la ricerca
che li ha prodotti. Non è una specifica e non descrive schemi o endpoint — fissa i vincoli che
rendono sbagliata un'implementazione anche quando compila.

I termini e i loro identificatori sono in [`glossario.md`](glossario.md). La ricerca e le decisioni
della revisione che ha tolto le contraddizioni sono in [`revisione-brainstorm.md`](revisione-brainstorm.md).

---

## 0 · Principi invarianti

1. **I risultati correnti sono la fonte di verità.** Ogni classifica è un read model ricalcolabile
   dai risultati. Nessun punteggio è un campo che si aggiorna. Non è event sourcing: ciò che conta è
   com'è il torneo adesso, e ogni modifica a un suo fatto lascia una voce di **storico** — chi,
   quando, cosa, perché (§7).
2. **Tutto ciò che è configurabile è versionato e si congela all'uso.** Il torneo congela la versione
   del ruleset alla creazione; il torneo di circuito congela la ranking policy vigente alla sua data.
   Ricalcolare non significa riapplicare le regole di oggi: significa **rieseguire ogni torneo con la
   propria versione**. Vale per ogni ruleset, qualunque sia la sua origine, con un solo meccanismo:
   il torneo **conserva una copia** del ruleset e della policy risolti, non un riferimento (§3).
   **Si congela la configurazione, non il codice**: il codice che la applica è sempre quello
   corrente, e un bug corretto in un tiebreak cambia anche le classifiche dei tornei passati — se e
   quando si ricalcolano (§8).
3. **Il motore è TypeScript puro.** Abbinamento e calcolo della classifica non conoscono Nuxt né il
   database: prendono partecipanti, risultati e configurazione, restituiscono abbinamenti o classifica. Fixture
   e test su quelli.
4. **Ogni casualità è seedata, e ogni esito è un fatto.** Abbinamenti e sorteggi si salvano, non si
   rieseguono. Seed e versione del motore non servono a rifare il calcolo ma a **verificarlo**: ogni
   esito deve poter essere ricontrollato con la versione che l'ha prodotto. Il seed lo genera il
   server e **nessuno lo sceglie**, nemmeno lo staff; lo verifica solo lo staff (§7).
5. **Aggiungere un gioco significa scrivere una composizione, non toccare il motore.** Il motore
   offre un catalogo di moduli; un gioco che rientra nel catalogo è un preset, cioè una scelta di
   moduli e parametri. Una regola che il catalogo non ha è un **modulo nuovo**, cioè codice, ed è
   giusto che lo sia: niente DSL, niente interprete (§3).
6. **La riga di database non è il contratto API** (vedi `CLAUDE.md`): row → mapper → DTO in uscita,
   schema Valibot condiviso in entrata.

**Stack:** Nuxt full stack · better-auth per l'identità multi-organizzazione · Drizzle su Postgres ·
Node 26 · pg-boss per **tutti** i job · SSE per il live in sala · PWA installabile con Web Push (VAPID) · email
via SMTP. Nessun Redis, e **nessun fornitore insostituibile**: l'SMTP è uno standard e il fornitore
sta in configurazione. Deploy su **CapRover**, in un container Node sempre acceso.

- **pg-boss, niente task di Nitro.** Scadenza delle offerte (un job differito per offerta), invio di
  email e push con ritentativi, ricalcolo di stagione, decadimento di Glicko (cron di pg-boss:
  persistente, e gira una volta sola anche con più istanze). I task di Nitro sono sperimentali, non
  recuperano un'esecuzione persa e girano una volta per istanza.
- **Un job si accoda nella stessa transazione della modifica** (`fromDrizzle(tx, sql)`): l'email
  dell'offerta non parte se l'offerta non è stata salvata, e non si perde se l'SMTP è giù.
  L'adattatore è documentato per `postgres-js`, non per PGlite: in sviluppo va verificato, e in caso
  contrario si accoda fuori dalla transazione.
- **Email solo da un job**, mai dalla richiesta HTTP. Fornitore in `NUXT_MAIL_*`; dominio con SPF,
  DKIM e DMARC, che Gmail e Yahoo esigono.
- **Push da un job**, una sottoscrizione per dispositivo. Su iPhone arrivano solo con l'app installata
  nella schermata Home, quindi nessuna comunicazione che *deve* arrivare passa solo dalla push.
- **SSE** con keepalive ogni 30 secondi (nginx di CapRover chiude i flussi muti dopo 60) e
  `X-Accel-Buffering: no`. Fra istanze i tornei passano per `LISTEN/NOTIFY`, una connessione
  dedicata per processo, payload di soli identificativi. Una notifica persa non è grave: il client
  che si ricollega rilegge lo stato dal database.
- **Si parte con un'istanza, progettando per più istanze.** Il container dell'app non ha dati
  persistenti: PGlite è solo per lo sviluppo, il Postgres è un'app CapRover a parte.

---

## 1 · Entità portanti

| Entità | Cos'è |
|---|---|
| **Organizzazione** | Proprietaria dei tornei e dello staff. **Ogni torneo appartiene a un'organizzazione**: non esistono tornei personali. |
| **Circuito nazionale** | Uno per ogni gioco supportato, creato **solo dalla piattaforma**. Non possiede i tornei: li ingerisce. |
| **Lega interna** | Creata dall'organizzazione. Tornei propri, ricorrenti, dove conta anche la presenza. |
| **Player** | Identità globale di piattaforma. |
| **Partecipante** (`Participant`) | Il soggetto dell'iscrizione: 1..n membri che puntano a `Player`. Un torneo individuale è `teamSize = 1`. |

Circuito e lega sono **due entità distinte**, non la stessa macchina con scope diverso. Un torneo
può valere per il circuito, per la lega, per entrambi o per nessuno. Circuito e preset nascono
insieme: entrambi per-gioco, entrambi di piattaforma — aggiungere un gioco significa aggiungere
anche il suo circuito.

**`Participant` è l'unica cosa che pairing, risultati, classifica e display in sala conoscono.** Gli
tornei a squadre si pagano qui, una volta sola: nessun altro blocco deve sapere che dentro un
partecipante ci sono più persone.

Regole di modellazione ricorrenti:

- **Torneo ↔ aggregatore è molti-a-molti con dati propri** (quale aggregatore, moltiplicatore,
  approvato da chi e quando): è un'entità, non un array nel DTO.
- Anche `Participant` e `ParticipantMember` hanno dati propri (seed, numero di sorteggio, bye residui,
  stato pagamento, qualifica consumata, posizione in coda): stessa trappola.
- `Player` e `Participant` sono **DTO diversi**: `Player` non contiene le proprie iscrizioni, o il
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
  organizzazione d'origine, mai contatti. Il profilo pubblico mostra tornei e piazzamenti.
- **Nome visualizzato, per tutti e senza scelte:** il **nickname** se c'è, altrimenti **nome e
  iniziale del cognome**. Vale ovunque (classifiche, display in sala, profilo pubblico), per
  maggiorenni e minori; se il profilo è rivendicato e l'account ha un nickname, compare quello. Il
  profilo conserva quindi nome, cognome e nickname facoltativo, e il nome completo non esce mai.
- **Anno di nascita** sul profilo: è il dato che permette di sapere chi è minore e di dividere i
  tornei per **categorie d'età** (§5). Se il torneo ha categorie, l'anno di nascita è obbligatorio
  all'iscrizione.
- **I minori seguono le stesse regole degli adulti**: profilo cercabile da tutte le organizzazioni,
  profilo pubblico, account senza consenso dei genitori. Vedi *Rischi accettati* qui sotto.
- **Titolarità, ipotesi di lavoro:** l'organizzazione è titolare dei dati del proprio torneo; la
  piattaforma delle funzioni trasversali (ricerca fra organizzazioni, profilo pubblico, circuito
  nazionale), che sono finalità sue e non di un'organizzazione. Da verificare.
- **Rimozione = anonimizzazione.** I risultati sono fatti del torneo e restano (§7, §8): una richiesta
  di cancellazione rende il `Player` «giocatore rimosso», il `Participant` e i suoi risultati restano, e
  nessuna classifica chiusa cambia. Serve un'informativa, e questo è il punto del sistema che la
  richiede.

### Rischi accettati

La piattaforma, per ora, è **su invito e usata da poche persone**, e non c'è un consulente privacy.
Alcune scelte sono state fatte sapendo che vanno in direzione diversa dalle fonti; vanno **riviste
prima di aprire la piattaforma al pubblico**:

- **Account sotto i 14 anni come gli altri.** In Italia (art. 2-quinquies Codice privacy) il minore
  di 14 anni non può dare da solo il consenso ai servizi online: se la base giuridica dell'account è
  il consenso, serve quello di chi esercita la responsabilità genitoriale.
- **Profilo pubblico e ricerca fra organizzazioni anche per i minori.** Il Garante (2026) ha
  affermato che la disponibilità pubblica dei risultati sportivi di un minore non autorizza ad
  aggregarli e indicizzarli per altre finalità; l'EDPB (Linee guida 1/2024) chiede che nel
  bilanciamento l'interesse del minore prevalga di regola. Il profilo pubblico aggrega proprio i
  piazzamenti di organizzazioni diverse.
- **Titolarità non verificata** con un consulente, e anonimizzazione non verificata come risposta
  sufficiente all'art. 17.

L'anno di nascita registrato sul profilo è ciò che permetterà di cambiare queste regole per i soli
minori senza toccare il resto.

**Attenuazioni**, attive da quando esistono le funzioni a cui si applicano:
- il profilo pubblico di un minore ha `noindex`: resta visibile a chi lo cerca sulla piattaforma, ma
  i motori di ricerca non lo indicizzano — è l'indicizzazione che il Garante nomina esplicitamente;
- quando un'organizzazione crea al volo il profilo di un minore, riceve un avviso.

---

## 3 · Ruleset e ranking policy

Sono i due oggetti configurabili che costituiscono il vero prodotto.

### Ruleset

Il ruleset ha **due livelli**:

| Livello | Cos'è | Dove vive | Chi lo cambia |
|---|---|---|---|
| **Catalogo dei moduli** | le varianti di regola implementate | codice del motore | sviluppo, con un deploy |
| **Composizione** | una scelta di moduli, con i loro parametri | file del repository o dato | gestore della piattaforma · organizzatore |

**Un ruleset è una composizione**, e ne esistono tre origini:

- **Preset di piattaforma** — lo scrive il gestore, uno per gioco, come **file TypeScript del
  repository** tipato dal catalogo: un preset che usa un modulo inesistente o un parametro sbagliato
  non compila. È l'unico che il circuito accetta.
- **Preset modificato** — l'organizzatore parte da un preset e cambia dei parametri (un Bo1 invece di
  un Bo3). È consentito, e la composizione diventa custom.
- **Torneo libero** — l'organizzatore non parte da nessun preset e sceglie tutto fra i moduli del
  catalogo: abbinamento, punti, tiebreak, pavimenti, tempi.

L'organizzatore cambia **solo parametri e scelte del catalogo**, mai il comportamento di un modulo.
La sua composizione non è un'entità a sé: **si salva nel template** (§5), resta dell'organizzazione,
non si condivide con altre e non diventa mai un preset. **Qualunque composizione diversa dal preset
del circuito non si aggancia al circuito nazionale** (può stare in una lega interna).

La composizione dell'organizzatore arriva dal client e passa per uno schema Valibot **generato dal
catalogo**: ogni modulo dichiara i propri parametri e i loro limiti (il pavimento di un tiebreak fra
0 e 1), e da quella dichiarazione nascono sia la validazione sia il modulo di creazione del torneo.
Un modulo nuovo compare nell'interfaccia senza scrivere interfaccia.

**Il torneo conserva la composizione risolta** in un `jsonb` — moduli e parametri effettivi — più la
sua origine (`preset:<game>@<version>`, `custom`, `free`). Il ricalcolo legge la copia: un preset
che è un file cambia a ogni deploy, e un riferimento farebbe ricalcolare con la regola di oggi.

Il catalogo ha cinque categorie:

1. **Forma del risultato** — tre archetipi chiusi, non un DSL: `win_loss_draw` · `best_of_n`
   (conteggio game) · `continuous_score` (soglie che derivano l'esito).
2. **Funzione risultato → punti** — default 3 vittoria / 1 patta / 0 sconfitta. **La patta esiste,
   ma non in tutti i ruleset.**
3. **Tie break** — una lista ordinata di funzioni nominate, coi propri parametri.
4. **Forma della lista/deck** — per ora sempre **testo libero con controllo manuale**. I validatori
   automatici sono moduli futuri, **per gioco e per formato**, alimentati dalle fonti esterne
   ufficiali di ciascun gioco e con **la legalità alla data del torneo**.
5. **Moduli operativi** — tipo di fase e di abbinamento, eredità fra fasi e composizione del
   tabellone (per fase, §4), formato di gioco e forma della lista (per fase, nel torneo
   multi-formato), durata round, best-of, tabella round per fascia di giocatori, regime di tempo,
   late entry, se e quando le liste si bloccano.

**Il gioco** di un torneo è testo libero, anche fuori dai preset, e conta per le statistiche e per il
profilo pubblico del giocatore.

### Ranking policy

**Forma fissa parametrizzata**, non un'espressione configurabile: tabella dei punti base per
piazzamento × moltiplicatore di taglia × peso del torneo. Nessun interprete da scrivere. È di
piattaforma come il preset, quindi vive nello stesso modo: file del repository, e il torneo di
circuito ne conserva la copia vigente alla sua data.

- La policy usa il **piazzamento**, non il percorso. È la scelta più semplice e la più criticata
  (due decimi prendono gli stessi punti anche con un numero di vittorie diverso); il moltiplicatore
  di taglia resta l'unico correttivo.
- **Best-N con quote per categoria**: contano i migliori N tornei, con un tetto per taglia
  («al massimo 4 tornei piccoli»). La classifica non è una somma, è una **selezione**.
- Fine stagione: la stagione **si chiude** — nessun nuovo torneo vi entra — e la classifica determina
  l'ingresso al nazionale e il numero di bye. **Chiusa non vuol dire immutabile**: una correzione a un
  torneo della stagione si applica anche dopo, e i crediti emessi si riallineano (§9). Un errore non
  deve poter lasciare un invito a chi non lo merita.
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

**L'elenco ordinato non basta sempre.** Basta fra fasi di tipo diverso (svizzera → top cut, gironi
→ tabellone), dove serve un seeding e nient'altro. Non basta quando una fase **continua** la
precedente: per il no-rematch e per `OMW%` servono avversari e risultati, non solo la posizione.
Per questo, oltre all'elenco, una fase può **ereditare** dalla precedente tre cose, ciascuna con un
**parametro separato**:

| Eredità | Cosa passa | Serve a |
|---|---|---|
| **Punti** | i punti accumulati | continuare la classifica |
| **Storia degli avversari** | chi ha incontrato chi | no-rematch |
| **Dati di tiebreak** | avversari e risultati per `OMW%`, `GW%` e simili | tiebreak calcolati su tutta la catena |

**Il day 2 è una seconda fase svizzera che eredita tutte e tre**, con un gate a punti davanti: è
così che lo trattano Magic (18 punti dopo nove round) e Pokémon (19 punti o i primi 32).

Default per coppia di fasi — l'organizzatore li cambia, il preset li fissa:

| Da → a | Punti | Storia avversari | Tiebreak |
|---|---|---|---|
| svizzera → svizzera | sì | sì | sì |
| gironi → tabellone | no | no | no |
| qualunque → eliminazione / top cut | no | no | no |

Fasi disponibili: svizzera · round robin · gironi · eliminazione singola · eliminazione doppia ·
top cut.

Conseguenze:

- **Ogni fase deve saper linearizzare anche quando la sua logica non lo fa.** L'eliminazione produce
  un ordine parziale (i quattro perdenti dei quarti sono tutti «quinti»): ogni tipo di fase dichiara
  la propria regola — per l'eliminazione, prima il round di uscita, poi il seed d'ingresso, in ultima
  istanza il **numero di sorteggio** del partecipante (§8).
- **La classifica finale si compone a ritroso**, impilando chi è arrivato in fondo all'ultima fase,
  poi chi è stato tagliato dall'ultimo gate nel suo ordine, poi chi è stato tagliato prima.
  I tagliati non spariscono: si sedimentano.
- **Le impostazioni operative sono per fase, non per torneo.** Un top cut in Bo3 dopo una svizzera
  in Bo1 è il caso normale. Anche **formato di gioco e lista** possono cambiare da una fase all'altra:
  il torneo multi-formato è previsto (§6, §11).
- **L'ambito del no-rematch è la catena di fasi che eredita la storia degli avversari**, non il torneo
  e non la singola fase. Nel top cut non vale: si rigioca senza penalità contro chi si è già
  incontrato in svizzera. Due casi reali si modellano spezzando la svizzera in **fasi consecutive
  senza gate**, che ereditano punti e tiebreak ma **non** la storia degli avversari:
  - **torneo multi-formato** (draft nei round 1-3, constructed nei round 4-8): chi si è incontrato in
    draft può ritrovarsi in constructed;
  - **azzeramento dopo un round dato** (il Mondiale Magic XXVII, dopo il round 7): con pochi giocatori
    e molti round, le rivincite diventano normali da un certo punto invece di essere forzate dal
    motore (§7).
- **Dai gironi al tabellone**, la composizione del primo turno è un parametro:
  - `overall_standing` (**default**) — un'unica classifica, 1° contro 8°, 2° contro 7°, **a
    prescindere dal girone di provenienza**: due giocatori dello stesso girone possono rincontrarsi
    subito;
  - `fixed_cross` — 1° del girone A contro 2° del girone B e così via, con uno schema fissato,
    come ai Mondiali di calcio. Non usa la storia degli avversari ma **il girone e la posizione nel
    girone**, che la fase a gironi espone insieme al proprio elenco ordinato.
- **Nelle fasi a eliminazione la patta è disabilitata**: non è un risultato inseribile, si gioca
  fino al vincitore.
- Un gate che non produce una potenza di due genera i **bye del bracket**, assegnati ai seed più alti.
- La classifica del torneo è **l'output dell'ultima fase**, non lo snapshot dell'ultimo round.

---

## 5 · Creazione del torneo

- **Template e tornei ricorrenti**: il caso normale non è «creo un torneo», è
  *ricreo quello di ogni venerdì*.
- **Il template contiene la composizione** dell'organizzatore (§3): è lì che si salva un ruleset
  custom, non in un'entità a parte.
- **Il circuito impone il proprio preset.** Non è solo un criterio di ammissione a posteriori: è un
  vincolo di configurazione a monte, e il numero di round è fissato dalle regole del circuito.
  I due meccanismi si compongono così: **il preset vincola alla creazione, i criteri si verificano
  alla pubblicazione dei risultati.**
- Fuori dal circuito il motore **deve permettere** di aggiungere o togliere round in corsa.
- **Oltre metà dei giocatori come numero di round, le rivincite diventano possibili** (fino a quel
  limite un abbinamento senza rivincite esiste sempre). Il sistema **avvisa, non impedisce**: quando
  l'organizzatore imposta o aggiunge round oltre il limite, e quando i drop abbassano il limite sotto
  i round che restano.
- **Un torneo di circuito che non raggiunge il minimo di giocatori non parte**: la soglia è una
  condizione di avvio, non si gioca declassandolo.
- **Tornei a squadre sì**, con n membri per squadra (non solo due).
- **Categorie d'età.** Un circuito o un torneo può dividere i giocatori in categorie per anno
  di nascita, come Pokémon (Junior, Senior, Masters). Le categorie **giocano in parallelo** dentro lo
  stesso torneo, con **classifiche separate** — e, nel circuito, classifiche di stagione separate.
  Una categoria parte separata solo se raggiunge un **numero minimo di giocatori**, parametro del
  circuito o del torneo (Pokémon usa 4). La categoria di un giocatore si fissa sull'anno di nascita
  all'inizio della stagione e non cambia durante la stagione.
- **Sotto il minimo la categoria si combina**, come in Pokémon, con quella d'età più vicina (Junior
  con Senior, Senior con Masters, mai Junior con Masters). **Le categorie combinate condividono solo
  gli abbinamenti della svizzera**: ognuna mantiene la propria classifica e, se c'è, il proprio top
  cut. Nel modello a fasi (§4) la categoria è un attributo del `Participant`: la fase svizzera abbina
  l'unione delle categorie combinate e restituisce **un elenco ordinato per categoria**, e ogni
  categoria prosegue verso il proprio top cut. I tiebreak si calcolano sugli avversari reali, di
  qualunque categoria.
- **Tavoli numerati alla maniera tradizionale**: tavolo 1 = i più forti. L'assegnazione del tavolo è
  **output del motore di abbinamento**, non decorazione del display.
- Le date sono tre — apertura iscrizioni, deadline decklist, inizio torneo — e nei tornei
  ricorrenti vanno generate come **offset**, non come date assolute.

### Ciclo di vita del torneo

| Stato | Identificatore | Cosa vuol dire |
|---|---|---|
| Bozza | `draft` | Lo vede solo lo staff dell'organizzazione. |
| Pubblicato | `published` | Il torneo è visibile, ma le iscrizioni non sono aperte. |
| Iscrizioni aperte | `registration_open` | Ci si iscrive, fino al cap e poi in lista d'attesa (§6). |
| Check-in aperto | `checkin_open` | Il punto di congelamento del §6. |
| In corso | `running` | Si giocano i round. |
| Concluso | `finished` | L'ultima fase è chiusa e la classifica finale esiste. |

- **La pausa non è uno stato del torneo**: è del cronometro del round (`pausedMs`, §7).
- **«Pubblicato» qui vuol dire annunciato**, prima delle iscrizioni. Non va confuso con la
  **pubblicazione dei risultati** verso circuito o lega (§9), che viene dopo `finished` e arriva con i
  circuiti, né con la pubblicazione di un round (§7), che rende visibili gli abbinamenti.
- Un torneo che non parte — per esempio un torneo di circuito sotto il minimo di giocatori — finisce
  in `cancelled`.

### Date e fusi orari

- **Ogni torneo ha il proprio fuso orario** IANA (`Europe/Rome`), in una colonna accanto agli
  istanti: `timestamptz` salva l'istante ma non il fuso con cui è stato scritto.
- **Le ricorrenze sono in ora locale**: «ogni venerdì alle 20» resta alle 20 anche dopo il cambio
  d'ora, ed è l'istante UTC a spostarsi. Sommare 7 × 24 ore a un istante porterebbe il torneo alle 19
  o alle 21.
- **Gli offset sono di calendario locale**, non durate: «6 giorni prima, alle 10» è sempre alle 10.
- **Le scadenze in giorni valgono fino a fine giornata nel fuso del torneo** (pubblicazione dei risultati entro 7
  giorni, §9; scadenza dei crediti, che prende il fuso del torneo che li ha emessi).
- **L'ora legale resta** (l'abolizione nell'UE è ferma in Consiglio): un'ora all'anno non esiste e
  una esiste due volte. Regola per entrambi i casi: la disambiguazione `compatible` di Temporal —
  un orario inesistente si sposta in avanti, un orario doppio prende la prima occorrenza.
- **Temporal** per tutta l'aritmetica di date: nativo sul server con **Node 26**, polyfill
  (`@js-temporal/polyfill`) nel frontend finché Safari non lo supporta.

---

## 6 · Ingresso

### Tre assi ortogonali

Lo stato di un iscritto non è un enum solo, sono tre:

| Asse | Valori |
|---|---|
| **Posto** (`seat`) | prenotato `booked` · in lista d'attesa `waitlisted` · cancellato `cancelled` |
| **Presenza** (`attendance`) | atteso `expected` · presente `present` · no-show `no_show` |
| **Gioco** (`play`) | attivo `active` · ritirato `dropped` · squalificato `disqualified` |

Comprimerli è il modo classico per non saper più rispondere a «quanti ne ho in gioco al round 3».
Ne segue che **«numero di partecipanti» non è una domanda sola**: servono tre viste (iscritti ·
presenti · ancora in gioco) e la classifica deve dichiarare a quale si riferisce.

### Posti e coda

- Iscrizione **self-service** fino al massimo, poi **lista d'attesa ordinata**. L'organizzatore può
  iscrivere al banco **solo se ci sono posti liberi**: nessuna corsia che scavalchi la coda.
- **Promozione per offerta a scadenza.** Si libera un posto → il primo in coda riceve un link che
  vale **fino a «domani alla stessa ora»** nel fuso del torneo (24 ore, 23 o 25 nella notte del
  cambio d'ora), **o fino all'apertura del check-in** se viene prima; se non risponde perde il
  diritto e l'offerta slitta al successivo. Il posto resta **riservato** per tutta la durata
  dell'offerta.
- Il cap è **del torneo**, non della fase: un torneo ha più fasi ma una sola porta d'ingresso.

### Check-in: l'unico punto di congelamento

Il check-in **è separato dall'iscrizione e lo abilita esplicitamente l'organizzatore**, non una
finestra calcolata. Una volta aperto lo fa il giocatore o l'organizzatore per lui.

La sua apertura è **il momento in cui il sistema si congela**: da lì niente più cancellazioni,
niente più offerte automatiche (la scadenza è tagliata lì), e i posti liberi li assegna
l'organizzatore in sala. Un momento solo da implementare e da spiegare, invece di tre regole
scollegate.

All'inizio del torneo **chi non ha fatto check-in viene droppato**: è un **no-show**, non una
cancellazione — il posto non torna in circolo e il fatto resta nello storico, perché serve alla
lega e alle policy del negozio.

### Liste e deck

- **Il deck è del singolo membro**, non della squadra, ed è un'entità con stati propri:
  `missing → draft → submitted → locked → valid | invalid` (assente, bozza, inviata, bloccata, validata, invalida). Deadline propria del torneo.
  **Nel torneo multi-formato la lista è per fase**: una fase draft può non averne, una constructed
  sì, ciascuna con la propria deadline e il proprio blocco (§4). Nella
  v1 la lista è testo libero e **`validata` o `invalida` lo decide lo staff**; quando esisterà un
  validatore per quel gioco e formato, lo dichiarerà il ruleset congelato (§3).
- **Il blocco delle liste lo dichiara il ruleset.** Dove la lista si può cambiare durante il torneo,
  «la lista» non è un campo che si aggiorna: serve sapere **quale versione è stata giocata in quale
  round**, o si perde la tracciabilità per l'arbitraggio e le statistiche.
- **Il torneo non parte finché mancano liste.** Nessun drop automatico alla generazione del round 1:
  la via d'uscita è **droppare** il partecipante, e possono farlo organizzatore e head judge. Droppare
  una squadra fa uscire anche i compagni — il che rende il blocco una pressione reale sul capitano.
- La squadra è «pronta» solo se lo sono tutti i membri: la sanzione parte da `ParticipantMember`, e
  droppare l'intera squadra è **una scelta esplicita**, non una conseguenza automatica.

### Squadre, quote, qualifiche

- **Il roster si blocca alla chiusura delle iscrizioni** e **non esistono sostituti**: il roster ha
  esattamente la dimensione dei tavoli da schierare. Chi perde un componente all'ultimo gioca in
  inferiorità o si ritira, e a intervenire è l'organizzatore, non il sistema. È rigido di proposito.
- **Quota fuori piattaforma**: importo sul torneo, `paymentStatus` sull'iscrizione marcato
  dall'organizzatore. Nessun payment processor, nessuna policy di rimborso nel prodotto.
- **Qualifiche e bye sono crediti nell'account del giocatore**, non diritti su un torneo nominale,
  e sono **due crediti distinti**, perché si spendono in modo diverso:
  - `Qualification { playerId, circuitId, origin, expiresAt }` — il diritto di iscriversi, spendibile su
    qualunque torneo del circuito che la accetti. **Si consuma per intero.**
  - `ByeCredit { playerId, circuitId, origin, expiresAt }` — **una riga per bye**: un piazzamento
    che vale tre bye emette tre righe. Spendere due bye è consumare due righe, e la terza resta
    disponibile; sommare bye di tornei diversi (circuito cumulativo, §7) è contare righe.
- Entrambi si consumano **transazionalmente** con la prenotazione (riferimento sull'iscrizione +
  stato sul credito); se l'iscrizione si cancella e il credito non è scaduto, torna disponibile.
- **Quali bye si spendono**: fino al limite del torneo (§7), **prima quelli che scadono prima**. Se
  il circuito non è cumulativo, in un torneo si usano solo bye della stessa origine, e il sistema
  sceglie l'origine che ne ha di più.
- Il numero di bye spesi viaggia poi come `byeRounds` sul `Participant` e lo applica il motore di
  abbinamento.
- **Late entry dichiarato dal ruleset**: `none | with_losses | with_byes`, con finestra fino
  al round N.

---

## 7 · Svolgimento

### Motore di abbinamento

**Matching a peso massimo (blossom pesato)**, non un algoritmo procedurale alla FIDE: tutte le
regole diventano pesi sugli archi e si risolve un massimo accoppiamento, una computazione per round.

- **Nessun vincolo assoluto: solo pesi, in ordine di priorità.** Il motore produce **sempre** un
  abbinamento completo. Le priorità, dalla più forte alla più debole:
  1. **massima cardinalità** — tutti abbinati, compreso il nodo del bye;
  2. **niente secondo bye** — penalità enorme per chi ha già avuto un bye, di qualunque origine
     (strutturale o premiale, §7 «Bye»);
  3. **niente rivincite** — penalità enorme, ma **minore di quella del secondo bye**: fra una
     rivincita e un secondo bye allo stesso giocatore, il motore sceglie la rivincita;
  4. differenza di punti **quadratica** (due abbinamenti a distanza 1 battono uno a 0 e uno a 2);
  5. alternanza del lato dove la posizione conta (lato, colore, primo turno), sempre **pesata**, mai
     imposta;
  6. rompi-pareggi cosmetici.
- **Le priorità sono lessicografiche**: ogni livello pesa più della somma massima possibile di tutti
  quelli sotto, così nessuna quantità di preferenze minori può comprare una violazione maggiore. Una
  rivincita capita solo se non esiste un abbinamento completo senza; se ne servono, il motore ne usa
  **il minor numero possibile**. I pesi sono interi (§8, matematica esatta), e con sei livelli vanno
  calcolati in `BigInt` o dimensionati per restare sotto 2⁵³.
- **Questo comportamento vale per tutti**: non è un parametro del modulo di abbinamento.
- **Il bye è un nodo fittizio** collegato a tutti, con peso decrescente nella classifica. Il bye
  strutturale va al più basso in classifica.
- **La massima cardinalità risolve gratis il problema più insidioso**: un greedy può bloccarsi
  lasciando appaiati due che si sono già incontrati; il blossom trova l'abbinamento completo che
  minimizza le violazioni. Serve, perché **non esiste un pulsante «rigenera»**.
- **Rivincite e secondi bye si vedono prima di pubblicare.** Un round in `bozza` che ne contiene
  mostra un avviso all'organizzatore; non blocca la pubblicazione del round.
- **Determinismo**: ordinamento stabile dei partecipanti, a parità di peso vince l'indice più basso. Il
  round 1 non usa i pesi: è un mescolamento con RNG seedato.
- **Un solo esito del motore per round.** Il seed nasce alla creazione del round, da un generatore
  crittografico del server, e non cambia più. Ne segue che **stesso input dà stesso esito**: rigenerare
  senza cambiare niente restituisce lo stesso abbinamento, quindi «rigenera» è inutile per
  costruzione, non per divieto. Ogni cambiamento successivo è un override.
- **Firma di generazione sul round**: `{ engineVersion, seed, input }`, con `input` in `jsonb` —
  partecipanti nell'ordine ricevuto, punteggi considerati, coppie già incontrate, bye già ricevuti,
  configurazione della fase.
  Verificare significa `motore(input, seed) == abbinamento salvato`. È un'istantanea di ciò che il
  motore ha ricevuto, non una ricostruzione di tutto il torneo.
- **Il motore è un pacchetto con una versione propria.** Un round della versione corrente si verifica
  dall'applicazione, uno di una versione precedente eseguendo quella versione da riga di comando,
  come il pairing checker FIDE: l'applicazione non conserva il codice delle versioni vecchie. Il
  motore non si aggiorna durante un torneo; se succede, il torneo passa alla versione nuova e la firma
  dice quale round è stato generato da quale.
- **Cambiare l'input cambia l'esito**: aggiungere e togliere un partecipante prima di generare è un modo
  per ottenere un abbinamento diverso. Non si impedisce: resta visibile nello storico.

Il motore produce un abbinamento e basta. **L'organizzatore può modificarlo a mano**, e la modifica
**avvisa ma non impedisce mai** — nemmeno se produce una rivincita: in sala l'autorità è
l'organizzatore. L'override finisce nello storico con la motivazione, che è obbligatoria. Wizards
ha tolto gli abbinamenti manuali da EventLink perché venivano usati soprattutto per frodi; qui si
tengono, e **la motivazione nello storico è considerata sufficiente**.

### Bye

Esistono **due bye con origini diverse**: strutturale (numero dispari) · **premiale** (guadagnato
in classifica di stagione, da materializzare *prima* del pairing del round 1).

**I bye premiali possono essere più di uno nello stesso torneo.** Un giocatore con tre bye premiali
può usarli tutti e saltare i primi tre turni.

- **Cumulativi**, se il circuito o il torneo lo prevede: i bye vinti in tornei diversi si sommano (uno
  al torneo X e uno al torneo Y fanno due bye da spendere).
- **Limite per torneo**: quanti bye premiali si possono usare in un torneo lo decide il circuito. Chi
  ne ha di più ne usa fino al limite, e **gli altri restano sul suo account**.
- **Nel torneo libero** non si spendono crediti: i bye premiali li assegna **l'organizzatore a mano**,
  all'iscrizione o dall'elenco dei partecipanti, **prima del primo abbinamento**. Finiscono nello
  storico come ogni altro fatto del torneo.
**Il bye è sempre una vittoria piena** nei punti, qualunque sia l'origine, e nei tiebreak si tratta
allo stesso modo per entrambe le origini (§8).

**L'avversario che abbandona a abbinamenti fatti non genera un bye**: chi resta ha battuto un
avversario reale (§8).

### Ciclo di vita del round

**Tre atti separati:** `generate` (calcolati ma invisibili) → `publish` (visibili ai giocatori,
notifica tavolo e posto) → `start` (parte il tempo). Il terzo esiste solo per i giochi a tempo.

Stati del round: `draft | published | started | closed | cancelled`.

- **Il round successivo non si genera finché mancano risultati.**
- Un round si può **riaprire**. Si annulla **solo il round corrente**; per risalire più indietro si
  annulla a ritroso, uno alla volta. È un'operazione economica solo perché la classifica è un read
  model: annullare **marca come annullati** abbinamenti e risultati del round e scarta il suo
  snapshot, non «disfa» una classifica materializzata. **Non si cancella niente**: i fatti annullati
  restano consultabili nello storico, con chi ha annullato e quando, e le letture li escludono.

### Risultati

- Li inserisce **lo staff o un giocatore** (nella v1 solo lo staff, §11). **Un solo inserimento è
  già valido**; la conferma dell'avversario produce solo un **segno visivo**. Nelle squadre basta un
  membro qualunque. Judge e organizzatore possono sovrascrivere.
- **Refertazione contraddittoria → stato `disputed`**: il primo risultato resta valido ai fini
  della classifica, lo staff riceve una notifica e decide. Il risultato è **una riga sola per match**:
  la seconda refertazione non la sostituisce, entra nello storico come **tentativo respinto**, ed è
  quella voce a portare il match a `disputed`. Anche la conferma dell'avversario è una voce di
  storico, non un secondo risultato. Senza storico lo stato `disputed` non serve a niente: è
  esattamente il caso in cui bisogna vedere chi ha scritto cosa e quando.
- **Correzione dopo che il round successivo è già abbinato**: il sistema **propone** un
  ri-abbinamento col diff, calcolato **con lo stesso seed del round**: l'unica differenza di input è
  la correzione, quindi il diff mostra solo il suo effetto. Se l'organizzatore rifiuta si prosegue
  con gli abbinamenti attuali ma col punteggio corretto. Ha senso solo se il round successivo è generato e **non ancora avviato**: se
  si sta già giocando si corregge solo il punteggio.
- **Non presentarsi al proprio match è perderlo**, esattamente come averlo giocato e perso: nei
  punti, nei tiebreak dell'avversario e nel record. Dopo la sconfitta **chi non si è presentato
  viene droppato** dal torneo. Il drop si può annullare **solo finché gli abbinamenti del round
  successivo non sono stati generati**; dopo, è definitivo.
- **Il conteggio dei game va registrato anche quando non è stato giocato** (patta intenzionale,
  concessione dopo un game vinto): serve ai tiebreak.

### Storico del torneo

- **Perimetro:** risultati, abbinamenti, override, penalità, drop, check-in, sorteggi. Vale **solo
  per il torneo**: profili, iscrizioni, ruleset e policy non hanno storico generico.
- **Lo scrive l'applicazione, non un trigger**: il trigger non vede l'utente applicativo né la
  motivazione. Ogni comando del torneo passa da un solo helper che scrive la voce **nella stessa
  transazione** della modifica: `{ tournamentId, entity, entityId, action, actorId, reason, before,
  after, at }`, con `before` e `after` in `jsonb`.
- **Una tabella sola per tutto il torneo**: le domande sono «cos'è successo in questo torneo» e
  «cos'è successo a questo match», entrambe filtri sulla stessa tabella.
- **L'applicazione non la può modificare**: in produzione il suo ruolo Postgres ha solo `INSERT` e
  `SELECT` su quella tabella. Non protegge da chi accede al database direttamente, e non deve farlo.
- Lo storico registra anche **le intenzioni che non cambiano lo stato** (la refertazione respinta, la
  conferma): è ciò che lo distingue da un elenco di modifiche.

### Squadre

Il match squadra-contro-squadra ha uno **stato intermedio che nel modello individuale non esiste**:
abbinato ma non ancora spaiato sui tavoli. Lo spaiamento è **manuale e simultaneo cieco** — ogni
capitano ordina i propri membri sui tavoli 1..n senza vedere l'altro; a conferma di entrambi il
sistema rivela e incrocia. Chi non schiera in tempo riceve un'assegnazione automatica casuale,
dal seed del round, salvata come fatto.

### Tempo

**Tre regimi:** nessun tempo · **tempo globale di round** con estensione per tavolo · **tempo per
tavolo**. Col tempo globale il cronometro sta sul TV della sala *e* sul telefono di ogni giocatore,
ciascuno col proprio offset di estensione; col tempo per tavolo è sincronizzato fra i giocatori
di quel tavolo.

**Il cronometro è un fatto nel database, non un `setInterval` sul server.** Il server non manda mai
i secondi rimanenti: manda `{ endsAt, pausedMs, status }` più il proprio `now`; il
client calcola l'offset una volta e conta da solo — telefono in tasca, tab in background e
riconnessioni non producono deriva. SSE trasmette solo i cambi di stato, non un tick al secondo.
La pausa sposta `endsAt`. L'estensione per tavolo è un `endsAt` proprio del match, ed
è anche ciò che sposta l'inizio della procedura di fine round. Stessa logica di `RoundTimer`, che
tiene `now = null` fino a `onMounted`.

Nelle fasi a eliminazione, dove la patta non è inseribile, **il cronometro è informativo**: la fine
del tempo non produce un esito. Il ruleset deve poter dichiarare che quella fase non ha esito a tempo.

### Ruoli, penalità, arbitraggio

- **Ruoli su due livelli.**
  - **Organizzazione** — *owner* e *admin*, come le community di Challonge e i ruoli predefiniti del
    plugin `organization` di Better Auth. Creano i tornei dell'organizzazione, ne gestiscono staff,
    template e leghe, e hanno pieno controllo su tutti i suoi tornei. **Non esiste un ruolo
    «organizzatore» del torneo**: la responsabilità è dell'organizzazione, e chi ha creato il torneo
    resta solo come dato registrato. Chi vuole un torneo fra amici crea un'organizzazione.
  - **Torneo** — *head judge* · *judge* · *scorekeeper*, assegnati al singolo torneo. Possono essere
    membri dell'organizzazione o **utenti esterni**: il judge che arbitra in negozi diversi si aggiunge
    al torneo senza entrare nell'organizzazione. Better Auth non ha permessi per singola risorsa,
    quindi questo livello è una tabella nostra.
  - Staff e admin si aggiungono **con un invito via email** (Better Auth) o **cercandoli fra gli
    utenti registrati**.
- **Il judge che gioca è un'opzione del torneo, spenta di default**, come nell'MTR (1.3: chi gioca
  non può fare l'ufficiale, a meno che il torneo non lo permetta esplicitamente). Accesa, il judge
  gioca ma non può arbitrare, correggere o penalizzare il proprio match: è un **controllo di permesso
  a livello di match**, non di ruolo.
- **Penalità registrate e con effetto**, **senza upgrade automatico**:

  | Penalità | Effetto |
  |---|---|
  | *warning* | solo verbale, nessuna conseguenza |
  | *game loss* | perde una partita dove esiste un conteggio di partite (`best_of_n`); **vale come match loss dove le partite non esistono** |
  | *match loss* | perde il match |
  | *disqualification* | perde il match corrente, **lascia in piedi i risultati già inseriti**, droppa dal torneo |

  La penalità non ha un effetto proprio: ha una **traduzione** nella forma di risultato dichiarata
  dal ruleset congelato.
- **Chiamata arbitro dal telefono del giocatore**, agganciata al tavolo.

### Sala senza rete

**Solo online, con la carta come ripiego**: il modello di EventLink, non quello di WER o di TOM.
Nessuna modalità offline, né in lettura né in scrittura. Scrivere offline contraddirebbe il seed
generato dal server e l'esito unico del round (§0.4, §7), lo storico scritto nella stessa transazione
(§7) e la regola del primo risultato; e offline e abbinamenti manuali pesavano per il 90% dei costi
di manutenzione di WER.

- **Stampa** (dopo la v1, §11): abbinamenti (per nome e per tavolo), **match slip** da far firmare
  ai giocatori, classifiche. In Magic e in Pokémon sono la prassi normale, non un'emergenza.
- Se la rete cade a metà round, i risultati si scrivono sui match slip e lo staff li inserisce quando
  la rete torna, o da un telefono con dati mobili. Il match slip firmato è anche ciò che lo staff
  consulta se un risultato inserito dopo viene contestato.

### Notifiche

| Torneo | Destinatari | Canale |
|---|---|---|
| Abbinamenti pubblicati (tavolo e posto) | giocatori del torneo | push + in app |
| Chiamata arbitro | staff del torneo | push + in app |
| Risultato contestato | staff del torneo | push + in app |
| **Messaggio dall'organizzatore** | partecipanti del torneo | push + in app |
| Offerta di posto dalla lista d'attesa | il primo in coda | **email**, più push se c'è |

L'offerta va per email perché è l'unica che **deve** arrivare fuori dall'app, anche a chi non ha
installato niente. Il messaggio dall'organizzatore è una comunicazione libera ai partecipanti di un
torneo (un ritardo, un cambio di sala).

### Modello dati

`Phase` → `Round` → `Match` → `Board`/`Game`.

Il `Match` usa **slot numerati** (`participantId`, `result`, `rank`, `forfeit`, `score`) e un
`kind: duel | ffa | bye`, così il duello, il pod e il match di squadra sono lo stesso oggetto.
**Per ora un match mette insieme sempre due entità** (dove un'entità può contenere più giocatori):
i pod con più di due entità sono rimandati, ma **il modello a slot va tenuto lo stesso**, perché è
ciò che permetterà all'FFA di entrare senza riscrivere match, risultati e classifica.

Accanto: `Penalty`, `JudgeCall`, `TimeExtension`, lo storico del torneo (`HistoryEntry`).

---

## 8 · Classifica e tie break

**Tutta la matematica della classifica vive nei moduli del catalogo.** Il nucleo del motore non
conosce né `OMW%` né VP: applica la lista ordinata di tiebreak che il ruleset sceglie dal catalogo.

**Catalogo iniziale:** `OMW%` · `GW%` · `OGW%` · punteggio continuo totale (i VP) · Strength of
Schedule / Buchholz · scontro diretto · numero di vittorie.

**Pavimento e tetto sono parametri della funzione**, non costanti: 33% alla MTG, 25–75% alla
Pokémon, o nessuno.

### Il bye nei tiebreak

**Il trattamento del bye è un parametro dei moduli di tiebreak**, non una regola della piattaforma:
ogni preset riproduce quello del proprio gioco, e l'organizzatore lo sceglie nel torneo libero. In
un tiebreak basato sugli avversari il bye entra da due lati, e sono **due parametri indipendenti**:

1. **Il bye nella mia lista di avversari** — il round di bye è un avversario che manca:
   - `exclude`: la media si fa sui soli avversari reali;
   - `dummy_own_score`: vale quanto la mia prestazione, con un tetto (la
     FIDE lo fissa al 50%);
   - `dummy_fixed`: vale un valore dichiarato, per esempio il 100% — il bye come
     miglior avversario possibile.
2. **Il bye nel mio record, come lo vedono i miei avversari** (il mio `MW%` dentro il loro `OMW%`, e
   il mio `GW%`):
   - `win`: il bye conta come vittoria piena, con il punteggio pieno di partite previsto dal
     ruleset (2-0 in un Bo3);
   - `excluded`: il bye si toglie, e il mio record è quello delle sole partite giocate.

| | Lato 1 | Lato 2 |
|---|---|---|
| **Torneo libero, default** | `exclude` | `excluded` |
| **Preset Magic** (MTR, App. C) | `exclude` | `win` |
| **Preset Pokémon** | `exclude` | `excluded` |

**Il preset riproduce le regole ufficiali del proprio gioco**: è il motivo per cui il trattamento
non può essere fisso. I parametri valgono per tutti i bye, qualunque sia l'origine (§7).

- `MW%` = `punti match ottenuti / (punti per vittoria × round considerati)`; quali round si
  considerano dipende dal lato 2.
- `OMW%` e `OGW%` = media delle percentuali degli avversari, con il lato 1 che decide cosa fare dei
  round di bye.
- Ogni percentuale passa per `max(pavimento, min(tetto, valore))`, **avversario fittizio
  compreso**: con un tetto al 75% un avversario fittizio al 100% vale 75%.

**Se si sceglie l'avversario fittizio al punteggio pieno o fisso, due effetti vanno riconosciuti
quando si guarda una classifica strana:** chi riceve bye premiali ha un `OMW%` strutturalmente
gonfiato, e il bye strutturale — che va al più basso in classifica — dà proprio a quel giocatore la
resistenza massima. La FIDE ha introdotto il tetto nel 2026 esattamente per il primo.

**Vittoria per forfait, per ritiro dell'avversario o per penalità non è un bye**: è un avversario
reale che ha perso, e conta come una vittoria normale con le percentuali vere di quell'avversario.
Non presentarsi equivale ad aver giocato e perso (§7). Qui ci si separa di proposito dalla FIDE, che
tratta anche la vittoria a forfait come un round non giocato.

### Altre regole

- **Il ritirato resta in classifica alla sua posizione**, col suo record.
- **Numero di sorteggio per partecipante.** All'avvio del torneo ogni partecipante riceve un numero casuale,
  dal seed del torneo: è **l'ultimo tiebreak ovunque**, nella classifica e nella linearizzazione
  dell'eliminazione (§4). Non si sorteggia a ogni parità perché il gruppo dei pari merito cambia a
  ogni correzione, e un sorteggio salvato per il gruppo di prima non si applicherebbe a quello nuovo.
- **La matematica della classifica usa solo le quattro operazioni, `min` e `max`**: niente
  `Math.pow` né altre funzioni il cui risultato cambia fra versioni di Node. I valori di tiebreak si
  arrotondano a una precisione dichiarata prima del confronto, così due valori uguali in teoria lo
  sono anche in pratica.
- **Squadre:** la classifica primaria sono i match point dell'incontro; **nessuna classifica
  individuale** dentro il torneo a squadre. I singoli tavoli restano comunque registrati, quindi
  win rate e matchup del giocatore sono calcolabili: è la *classifica* individuale a non esistere,
  non il dato.
- **Bracket:** il seeding si congela all'inizio del round; una correzione arrivata prima dell'inizio
  lo rifà. Un taglio che non è potenza di due assegna **bye ai seed più alti** fino a riempire il
  bracket — l'opposto della svizzera, ed è corretto: contesti diversi.

### Snapshot

- La classifica pubblicata è **congelata all'ultimo round chiuso**. Durante un round via SSE
  viaggiano abbinamenti, cronometro e stato dei tavoli, **mai la classifica**.
- **Uno snapshot per round**, calcolato alla chiusura: la storia («com'era dopo il round 3») è
  gratis, il seed del bracket è lo snapshot del round n, e annullare un round è scartare uno
  snapshot. Riaprire un round invalida il suo snapshot e i successivi.
- **Il ricalcolo dai risultati correnti resta l'autorità** (quelli non annullati) e un comando di
  riparazione, non il percorso normale. Lo snapshot è una cache.
- **Per un torneo terminato la classifica è l'ultimo snapshot.** Un deploy non ricalcola niente da
  solo, nemmeno quando corregge un tiebreak. Ricalcolare un torneo terminato è un **comando
  esplicito**, riservato agli errori gravi e ai bug, e finisce nello storico del torneo.

---

## 9 · Post-torneo, circuiti e leghe

- **La pubblicazione dei risultati è un atto manuale dell'organizzatore**, con **scadenza a 7 giorni**; chi sfora
  prende un warning all'organizzazione — che è **un'entità** (chi, quando, perché, quale torneo),
  non un contatore.
- **Le condizioni le conferma l'aggregatore**: zero match contestati · zero risultati mancanti ·
  minimo giocatori. Per il **circuito** si aggiunge il preset del circuito, non modificato; per la
  **lega interna**, che pubblica con lo stesso meccanismo, quella condizione **non si applica** —
  altrimenti preset modificati e tornei liberi sarebbero inutilizzabili proprio nel loro caso d'uso.
- **Ammissione**: automatica per criteri al circuito nazionale; decisa dall'organizzatore per la
  lega del negozio.
- Un torneo con i risultati pubblicati si può **correggere e ritirare**, e si corregge **in loco**, anche a stagione
  chiusa: non esistono versioni della pubblicazione dei risultati. Ma correggerlo obbliga a rieseguirlo con
  la sua policy congelata, e se il suo punteggio cambia possono cambiare i **best-N di giocatori
  che a quel torneo non c'erano**: **il ricalcolo si propaga a tutta la stagione** e va progettato
  come job, non come effetto sincrono di una `PATCH`.
- **I bye si emettono da soli**: alla chiusura del torneo per i tornei che ne prevedono, alla
  chiusura della stagione se sono premio di classifica. Ogni bye è una riga `ByeCredit` (§6) con
  la propria origine; finiscono nell'account del giocatore e scadono al circuito successivo (di norma
  un anno).
- **I crediti si riallineano, non si emettono una volta sola.** Ogni qualifica e ogni bye porta la
  propria **origine** (quale torneo o quale stagione, quale piazzamento). Il job di ricalcolo confronta
  i crediti che la classifica corretta assegna con quelli esistenti: **revoca** quelli non più dovuti
  e **li emette** al nuovo avente diritto. La revoca è uno stato del credito, con data e motivo, non
  una cancellazione.
- **Si corregge ciò che è ancora correggibile; ciò che è già accaduto resta.** Un credito già speso
  non si revoca: l'iscrizione resta, il torneo giocato col bye resta valido. Il nuovo avente diritto
  riceve comunque il suo credito, anche se il torneo per cui era pensato si è già giocato: lo userà
  al prossimo torneo utile, e la sua **scadenza parte dall'emissione effettiva**, altrimenti
  nascerebbe già scaduto. Ne segue che un riallineamento può far **superare la quota di emissione**
  del torneo: è il costo dell'errore, e la quota non lo impedisce.
- **Quote di emissione**: quante qualifiche può emettere un torneo, quanti tornei può ospitare
  un'organizzazione.
- **Rating (Elo/Glicko) per i circuiti che lo supportano**, tenuto **separato dai punti di
  circuito**: i punti sono stagionali e si azzerano, il rating misura la forza corrente e non si
  azzera mai. Serve un rating, non i punti, il giorno in cui si volesse abbinare per forza.
- **Statistiche del giocatore: tutto tranne fazione e archetipo.** Sono un secondo read model sui
  risultati: si decide *cosa* esporre, non come calcolarlo.
- **Profilo pubblico:** un estraneo vede i tornei a cui il giocatore ha partecipato e il
  piazzamento.

---

## 10 · Trappole tecniche da non dimenticare

- **La capienza ha tre stati, non due**: occupato · *riservato da un'offerta* · libero. Un controllo
  `iscritti < cap` è sbagliato per costruzione. È la sorgente di bug numero uno, va difesa con un
  **vincolo in database** — e **PGlite, connessione singola senza pool, non la farà emergere in
  sviluppo**.
- **L'offerta di posto è un'entità con storico**, non un campo: `SeatOffer { queuePosition, issuedAt,
  expiresAt, token, outcome }`. «A chi è stata offerta e chi non ha risposto» è esattamente la domanda
  che farà l'organizzatore quando qualcuno protesta.
- **La scadenza dell'offerta è un job** (pg-boss): alla scadenza non basta invalidare, bisogna
  **emettere l'offerta successiva** — è un effetto, non una vista calcolabile a lettura. La lettura
  resta comunque difensiva: un'offerta scaduta e non processata non è valida.
- **Il link dell'offerta funziona senza login** (token monouso) e **deve essere idempotente**: i
  client di posta e gli scanner (Microsoft Safe Links) aprono i link prima del destinatario, e un GET
  che accetta il posto lo accetterebbe da solo. Schema per **ogni** link monouso: **GET che mostra
  una pagina di conferma senza consumare nulla, POST dal pulsante che consuma il token**. Gli scanner
  non inviano form.
- **Il ricalcolo di stagione è un job**, non una richiesta HTTP, e **riallinea anche i crediti**
  (§9): revoche ed emissioni nella stessa transazione del ricalcolo.
- **L'RD di Glicko decade con l'inattività**: il rating cambia anche quando non succede niente.
  Serve un job periodico o un calcolo pigro con data dell'ultimo aggiornamento. È **l'unico numero
  del sistema che non è funzione pura dei risultati**.
- **I drop abbassano il limite dei round senza rivincite a torneo in corso.** Otto iscritti e quattro
  round sono dentro il limite; due ritiri dopo il round 2 lo portano a tre, e il round 4 può
  richiedere una rivincita senza che nessuno abbia aggiunto round. L'avviso del §5 va ricalcolato a
  ogni drop.
- **Il blossom non è deterministico se i pesi pareggiano**: serve un tie-break stabile, sempre. È
  la condizione perché «stesso input, stesso esito» (§7) sia vera.

---

## 11 · Perimetro e milestone

**La v1 è la prima release su invito**, non l'apertura al pubblico. Il suo scopo è uno solo: giocare
**domenica 29 novembre 2026** il primo torneo vero, nel negozio: **torneo libero** (gioco non
definito, nessun preset), **svizzera con top cut**, individuale.

### Nella v1

- **Fondamenta**: deploy su CapRover (Node 26, Postgres), plugin `organization` con owner e admin,
  profili giocatore creati al volo al banco (§2), storico del torneo, fuso orario del torneo.
- **Composizione**: solo torneo libero. Moduli: svizzera, gate per posizione, top cut a eliminazione
  singola; forme di risultato `win_loss_draw` e `best_of_n`; punti 3/1/0; tiebreak `OMW%`, `GW%`,
  `OGW%` con pavimento; bye con i default del torneo libero.
- **Torneo**: iscrizione e check-in fatti dall'organizzatore; round `generate → publish → start`;
  motore con blossom pesato, seed del server e firma di generazione; **risultati inseriti solo dallo
  staff**, con lo stato `disputed`; drop e mancato arrivo; override con motivazione; cronometro
  globale; classifica e snapshot; linearizzazione del top cut e classifica finale.
- **Live**: SSE con fan-out per il display in sala e per i telefoni dei giocatori.
- **Account creati a mano**: niente mailer in v1, quindi niente verifica email, reset password né
  inviti via email.

**Sala senza rete, in v1**: niente stampa e niente modalità offline. Se il wifi del negozio cade, il
torneo continua solo dai dati mobili di un telefono. È il rischio che la v1 accetta.

### Milestone

| Milestone | Entro | Contenuto |
|---|---|---|
| **M0 · Walking skeleton** | domenica 11 ottobre | App e Postgres su CapRover, Node 26, plugin `organization`, un torneo libero creato da un admin e mostrato in una pagina che si aggiorna via SSE. Due prove tecniche: pg-boss e `fromDrizzle` su PGlite, `LISTEN/NOTIFY` dietro l'nginx di CapRover. |
| **M1 · Svizzera completa** | domenica 1 novembre | Profili al volo, iscrizione e check-in, motore svizzero con tiebreak, ciclo del round, risultati e contestazioni, storico, classifica e snapshot, cronometro, display. |
| **M2 · Top cut** | domenica 15 novembre | Gate, eliminazione singola senza patta, linearizzazione, classifica finale. |
| **M3 · Prova generale** | domenica 22 novembre | Un torneo di prova nel negozio con persone vere, e una settimana per correggere. |
| **Primo torneo** | domenica 29 novembre | — |

### Dopo la v1, in ordine

Ogni voce sblocca o prepara la successiva:

1. mailer (verifica email, reset password, inviti), stampa, push, risultati inseriti dai giocatori;
2. lista d'attesa con offerte a scadenza;
3. template e tornei ricorrenti;
4. penalità e chiamata arbitro, messaggio dell'organizzatore;
5. gironi, eliminazione doppia, day 2 con eredità fra fasi;
6. tornei multi-formato e liste;
7. squadre;
8. categorie d'età;
9. preset per gioco, circuito, pubblicazione dei risultati, ranking policy;
10. qualifiche, crediti bye, riallineamento, quote di emissione;
11. leghe interne;
12. rating Glicko e statistiche del giocatore, profilo pubblico.

Prima dell'**apertura al pubblico**, in qualunque momento arrivi: rivedere i *Rischi accettati* del
§2.

### Non pianificato

Pod e match a più di due entità (FFA) — ma il modello a slot resta · punteggi soft (pittura,
sportività) · merge di profili giocatore (mai) · pagamenti in piattaforma · sostituti nel roster ·
upgrade automatico delle penalità · classifica individuale nei tornei a squadre · validazione
automatica delle liste (arriva gioco per gioco, formato per formato) · forme di risultato con più
contatori per lato o con punti ripartiti in base allo scarto (Blood Bowl, Warhammer 40.000 in
formato WTC) · modalità offline, in lettura e in scrittura (§7, *Sala senza rete*).
