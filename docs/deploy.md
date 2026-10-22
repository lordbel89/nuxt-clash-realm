# Deploy su CapRover

Un push sul ramo `production` mette online la versione: GitHub Actions verifica tutto, CapRover
costruisce l'immagine, il container migra il database e parte. Questo documento è il runbook: cosa
si prepara una volta, cosa si fa a ogni rilascio, cosa succede se qualcosa si rompe.

## Come funziona

```
push su production
   │
   ▼
GitHub Actions ── eslint · typecheck · test · concorrenza (Postgres vero) · scenari HTTP · docker build
   │  rosso → si ferma qui: CapRover non riceve niente
   ▼
CapRover costruisce l'immagine (Dockerfile)
   │  il build fallisce → la versione precedente resta su
   ▼
il container parte (docker-entrypoint.sh)
   1. controlla che le variabili obbligatorie ci siano
   2. migra il database col ruolo owner, in una sola transazione
   3. dà i permessi al ruolo dell'app (INSERT e SELECT sullo storico, niente di più)
   4. lancia il server col ruolo dell'app, senza l'URL dell'owner nell'ambiente
   │  manca una variabile o una migrazione fallisce → il container esce, la versione precedente resta su
   ▼
CapRover aspetta GET /api/health (HEALTHCHECK) e solo allora sposta il traffico
```

L'app non ha volumi, quindi CapRover avvia il container nuovo **prima** di fermare il vecchio
(`start-first`): in un rilascio riuscito non c'è interruzione, e in uno fallito il vecchio non si è
mai fermato. I client SSE cadono allo scambio, si riconnettono da soli e ripartono da `hello`.

## Una tantum

Si fa una volta sola, nell'ordine dei punti qui sotto. Serve:

- un server con CapRover già installato, il dominio radice configurato (un record DNS `*.<dominio>`
  che punta al server) e HTTPS attivo sulla dashboard;
- in locale, questo repository con Node 26 (`.nvmrc`), per la prova finale.

Non serve l'accesso SSH: dove bisogna lavorare dentro un container (il Postgres, la creazione degli
account) si passa dalla console di Portainer.

### 1. Portainer

CapRover non ha un terminale nella dashboard. Portainer è un'interfaccia web per Docker che apre una
console in qualunque container.

1. CapRover → **Apps → One-Click Apps/Databases → Portainer**. Nome `portainer`, edizione `ce`. La
   versione proposta è vecchia: metti l'ultima LTS indicata su Docker Hub (`portainer/portainer-ce`).
2. Nella scheda **HTTP Settings** della sua app: **Enable HTTPS**, **Force HTTPS** e **Websocket
   Support** (senza, la console non si apre).
3. Apri **subito** `https://portainer.<dominio>` e crea l'utente admin con una password forte. Finché
   l'admin non esiste, chi arriva per primo all'indirizzo può crearlo al posto tuo; se non lo crei
   entro pochi minuti Portainer si blocca, e va riavviato (*Save & Restart* in CapRover).
4. Come ambiente scegli quello locale (**Get Started**, il Docker del server stesso).

Portainer monta il socket Docker: chi entra in Portainer comanda il server intero. Quando non serve,
in CapRover → **App Configs** di Portainer metti **Instance Count = 0** e *Save & Update*; per usarlo
lo riporti a 1. I dati (l'utente admin) restano nel suo volume.

**Aprire una console**: Portainer → **Containers** → il container (il nome comincia con
`srv-captain--<app>.1.`) → **>_ Console** → scegli la shell e l'utente → **Connect**.

### 2. Il Postgres

1. CapRover → **Apps → One-Click Apps/Databases → PostgreSQL**. Nome `clash-realm-db`, versione `18`
   (è il tag dell'immagine Docker: la stessa versione dei test), utente `postgres`, una password a
   caso (è quella del superutente: serve solo qui sotto), database `postgres`. Il Postgres non è
   esposto fuori: gli altri container lo raggiungono come `srv-captain--clash-realm-db:5432`.
2. Due ruoli e il database. Il ruolo **owner** possiede le tabelle e fa le migrazioni; il ruolo
   **app** è quello con cui gira il server e non può cambiare lo schema né riscrivere lo storico.
   Apri la console di `srv-captain--clash-realm-db.1.…` (shell `/bin/bash`, utente `root`) e lancia:

   ```bash
   psql -U postgres
   ```

   Poi, dentro `psql`:

   ```sql
   CREATE ROLE clash_owner LOGIN PASSWORD '<password-owner>';
   CREATE ROLE clash_app   LOGIN PASSWORD '<password-app>';
   CREATE DATABASE clash_realm OWNER clash_owner;
   REVOKE ALL ON DATABASE clash_realm FROM PUBLIC;
   GRANT CONNECT ON DATABASE clash_realm TO clash_app;
   ```

   Le password finiscono dentro un URL: generale con `openssl rand -hex 24`, così non hanno
   caratteri da proteggere.

### 3. L'app

1. **Apps → Create New App**, nome `clash-realm`. **Lascia spenta** «Has Persistent Data»: con un
   volume CapRover ferma il vecchio container prima di avviare il nuovo, e perderesti la
   continuità.
2. Scheda **HTTP Settings**: collega il dominio, attiva **Enable HTTPS** e **Force HTTPS**, e
   imposta **Container HTTP Port = 3000**.
3. Scheda **App Configs → Environmental Variables** (Bulk Edit):

   | Variabile | Valore |
   |---|---|
   | `NUXT_AUTH_SECRET` | `openssl rand -base64 32` |
   | `NUXT_AUTH_URL` | l'origine pubblica, `https://clash-realm.<dominio>`. Better Auth la usa per cookie e redirect, e rifiuta i login da ogni altra origine. |
   | `NUXT_DATABASE_URL` | `postgres://clash_app:<password-app>@srv-captain--clash-realm-db:5432/clash_realm` |
   | `DATABASE_MIGRATION_URL` | `postgres://clash_owner:<password-owner>@srv-captain--clash-realm-db:5432/clash_realm` |

   Sono tutte e quattro obbligatorie: se ne manca una il container esce prima di migrare e lo dice
   nel log. Senza questo controllo, senza segreto o senza origine il server partirebbe e passerebbe
   il controllo di salute, ma ogni login fallirebbe.

   `NUXT_DATABASE_DIALECT=postgres`, `NODE_ENV`, `HOST` e `PORT` sono già nell'immagine.
   `DATABASE_APP_ROLE` vale `clash_app` se non la imposti. `NUXT_JOBS_ENABLED` resta spenta in v1.
4. Scheda **Deployment**: **Enable App Token** e copia il token.

### 4. GitHub

Repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valore |
|---|---|
| `CAPROVER_SERVER` | l'indirizzo della dashboard, `https://captain.<dominio>` |
| `CAPROVER_APP_TOKEN` | il token del punto 3.4 |

Il nome dell'app (`clash-realm`) sta nel workflow, `.github/workflows/deploy.yml`.

### 5. Primo rilascio e primi account

Il deploy (Dockerfile, workflow, script) deve essere su `main`: la Action parte dal ramo
`production`, che ancora non esiste, e lo crea il primo push.

```bash
git push origin main:production
```

Segui la Action su GitHub (scheda *Actions*) e il build su CapRover (scheda *Deployment*). Quando
`https://clash-realm.<dominio>/api/health` risponde `{"status":"ok"}`, crea due account (vedi
«Creare un account»): il tuo, e uno solo per la prova. La prova lascia nel database
un'organizzazione «Smoke test» con un torneo in bozza (che riusa a ogni giro): con un account suo,
non compare tra le tue.

```bash
node scripts/user-create.ts --email lord@example.com --name "Lord Bel"
node scripts/user-create.ts --email smoke@<dominio> --name "Smoke Test"
```

Poi la prova, da questo repository:

```bash
SMOKE_EMAIL=smoke@<dominio> SMOKE_PASSWORD=… npm run smoke -- --url https://clash-realm.<dominio>
```

Controlla health, login e un flusso SSE tenuto aperto 65 secondi: se il proxy lo taglia
(`proxy_read_timeout` di nginx, 60 secondi di default), qui lo vedi. Se finisce con `✔ tutto a
posto`, il deploy è fatto.

## Creare un account

Non c'è iscrizione pubblica né un mailer: ogni account nuovo (un organizzatore, uno staff) si crea
così, e la password si consegna a mano.

1. Se Portainer è spento, riaccendilo (CapRover → **App Configs** di Portainer → **Instance Count =
   1**).
2. Portainer → **Containers** → `srv-captain--clash-realm.1.…` → **>_ Console**, shell `/bin/sh`,
   utente `node` → **Connect**. La console parte da `/app`.
3. Lancia:

   ```bash
   node scripts/user-create.ts --email mario@example.com --name "Mario Rossi"
   ```

   La password si stampa una volta sola: copiala subito. Chi la riceve la cambia dopo il primo
   accesso.
4. Rispegni Portainer (**Instance Count = 0**).

Lo script usa il ruolo dell'app (`NUXT_DATABASE_URL` del container), che può scrivere gli account:
non serve altro.

## Rilasciare

`production` è un ramo che si sposta soltanto in avanti: ci si arriva da `main`, mai da lavori a
metà.

```bash
git push origin main:production
```

Il push rifiuta se `production` ha commit che il ramo di partenza non ha: è voluto. Un rilascio
manuale, senza nuovi commit, si fa da GitHub: *Actions → Deploy → Run workflow*, scegliendo il ramo
`production`. Su un altro ramo la Action fa le verifiche ma non manda niente a CapRover.

## Se qualcosa va storto

| Dove | Cosa succede | Cosa fare |
|---|---|---|
| Un controllo della Action è rosso | CapRover non riceve niente. Nessun build, nessuna migrazione. | Correggi e rifai il push. |
| Il build su CapRover fallisce | L'immagine non nasce, il container vecchio resta su. | Leggi il log in *Deployment*. |
| Manca una variabile d'ambiente | Il container nuovo esce subito, senza migrare. Il log dice quali mancano. | Aggiungila in *App Configs*: CapRover riavvia l'app da sé. |
| Una migrazione fallisce | Annullata per intero (una transazione sola), il database è com'era. Il container nuovo esce. | Correggi la migrazione e rifai il push. |
| Il container nuovo non passa `/api/health` | CapRover non sposta il traffico. | Guarda i log dell'app: la riga `[health]` dice perché il database non risponde (di solito la password di `clash_app` in `NUXT_DATABASE_URL`). |
| La versione nuova è sbagliata ma è partita | La precedente è nella cronologia: *Deployment → Version History*. | Se le migrazioni erano additive (vedi sotto), basta tornare al codice vecchio. |

## Regole per le migrazioni

Una migrazione che riesce è definitiva: Drizzle non ha un `down`. Perché un rilascio sbagliato si
possa annullare tornando al codice vecchio, le migrazioni devono essere **compatibili con la versione
precedente**:

- **Aggiungere** è sicuro: tabelle e colonne nuove, nullable o con un valore predefinito.
- **Togliere o rinominare** si fa in due rilasci. Nel primo il codice smette di usare la colonna;
  nel secondo una migrazione la cancella.
- Una colonna `NOT NULL` nuova senza valore predefinito rompe il codice vecchio, che non la scrive.

Durante lo scambio per qualche secondo girano insieme il container nuovo (già migrato) e il vecchio:
la regola serve anche a questo.

## Cose da sapere

- **Nessun template nginx.** Il flusso SSE regge dietro l'nginx di CapRover così com'è. Il server
  manda un `ping` ogni 30 secondi, metà del `proxy_read_timeout` predefinito (60 secondi), e h3
  manda `X-Accel-Buffering: no`, che spegne il buffering di nginx per quella sola risposta. Provato
  con un flusso aperto 130 secondi dietro un nginx configurato come quello di CapRover. Un template
  personalizzato sostituirebbe per intero quello di CapRover: andrebbe tenuto a mano nella
  dashboard e non riceverebbe le correzioni degli aggiornamenti. Se un giorno servisse (un proxy
  in più davanti, con un timeout più corto del `ping`), è *HTTP Settings → Edit Default Nginx
  Configurations*, con `proxy_read_timeout` alto solo per `/api/tournaments/`.
- **Un'istanza sola.** Due container che migrano insieme si pesterebbero. Per più istanze servirebbe
  un blocco (`pg_advisory_lock`) in `server/database/migrate.ts`.
- **I permessi dell'app** sono in `server/database/grants.ts` e si riapplicano a ogni rilascio, così
  le tabelle nuove li ricevono da sole. Per aggiungere una tabella di sola aggiunta, va in
  `APPEND_ONLY_TABLES`.
- **pg-boss** (F7) vorrà creare il suo schema `pgboss`: il ruolo dell'app non può. Quando i job si
  accenderanno, `grants.ts` dovrà dargli i permessi su quello schema (o pg-boss migrerà col ruolo
  owner).
- **I backup** non ci sono ancora: sono F6.2. Il volume di Postgres sta sul server CapRover.
- **`/_docs` e i mock** non esistono in produzione.
