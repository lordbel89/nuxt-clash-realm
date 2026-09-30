# Mock

Dati finti serviti da Nitro **solo in sviluppo**. Esistono per due motivi:
lavorare su una pagina prima che l'endpoint esista, e riprodurre a comando uno
stato che il database non ha (lista vuota, 500, risposta lenta).

Il taglio utente di questa documentazione sta in [README.md](../README.md#mock).
Qui c'è il funzionamento interno e la manutenzione.

## I file

| File | Ruolo |
|---|---|
| `server/mocks/define.ts` | I tipi (`Mock`, `MockContext`, `MockMethod`) e `defineMock`, che è un'identità: esiste per avere il controllo del contratto e l'autocompletamento dentro l'oggetto letterale. |
| `server/mocks/index.ts` | Il registro: l'elenco esplicito dei mock, il router `rou3` e `serveMock(event)`, che risolve la risposta. |
| `server/mocks/*.mock.ts` | Un file per entità. Esporta un mock o un array di mock. |
| `server/middleware/mocks.ts` | Il punto di innesto: cinque righe, chiama `serveMock` e ne restituisce il risultato. |

Dipendenze, entrambe **devDependencies**: `@faker-js/faker` per i dati,
`rou3` per il matching delle rotte (è lo stesso router che usa Nitro).

## Il flusso di una richiesta

1. Nitro esegue i middleware prima del routing: `server/middleware/mocks.ts` vede
   ogni richiesta.
2. Fuori dallo sviluppo esce subito (`if (!import.meta.dev) return`).
3. `serveMock` cerca in `rou3` una rotta che combaci con metodo e percorso
   (`event.path` porta con sé la query string, il router ragiona sul solo percorso).
4. Nessun mock, o mock con `enabled: false` → ritorna `undefined`, h3 lo legge come
   "non ho risposto" e la richiesta prosegue verso `server/api/`. Se l'handler non
   esiste, il 404 è quello di Nitro.
5. Altrimenti: mette l'header `MOCK_DATA: true` sulla risposta, aspetta `delay`,
   logga `[mock] GET /api/…`, e restituisce `data` — chiamandolo con
   `{ params, query, event }` se è una funzione.

Due conseguenze volute:

- **Un mock acceso vince sull'handler reale.** Accenderlo non richiede di toccare
  `server/api/`, e confrontare mock e implementazione è questione di un booleano.
- **I mock non passano dall'autenticazione**, perché rispondono prima. È il motivo
  per cui funzionano su endpoint che non esistono ancora.
- **Ogni risposta finta è marchiata** con l'header `MOCK_DATA: true`, e nessun'altra
  lo porta. L'header è messo prima di chiamare `data`, quindi ce l'ha anche l'errore
  che un mock dovesse lanciare. Nel tab Network si distingue a colpo d'occhio quali
  chiamate della pagina sono vere.

## Aggiungere un mock

1. **Il tipo della risposta va in `shared/types/`.** Il codice server non può
   importare da `app/`: un tipo che sta lì non è utilizzabile in un mock. È anche
   il posto giusto a prescindere — è un contratto d'API, come `shared/types/user.ts`.
2. Crea `server/mocks/<entità>.mock.ts`:

   ```ts
   import { fakerIT as faker } from '@faker-js/faker';
   import { defineMock } from './define.ts';

   // Seed fisso: gli id sopravvivono ai riavvii, i link salvati continuano a funzionare
   faker.seed(20260913);

   export default defineMock<Paginated<Thing>>({
     method: 'GET',
     path: '/api/things',
     enabled: true,
     delay: 500,
     data: ({ query }) => ({ … }),
   });
   ```

   Genera i dati **a livello di modulo**, non dentro `data`: così restano stabili
   fra una chiamata e l'altra e il dettaglio può cercare per id negli stessi
   oggetti che ha restituito la lista.

3. Aggiungi la riga nell'array `mocks` di `server/mocks/index.ts`. Niente
   scansione automatica della cartella: l'elenco resta leggibile e un file
   dimenticato non risponde per sbaglio.
4. Rispetta i contratti trasversali del progetto: gli elenchi restituiscono
   `Paginated<T>`, mai un array nudo; gli errori si lanciano con `createError`
   e il testo italiano sta in `message`, non in `statusMessage`.

## Ciclo di vita: il mock non si butta

1. Il mock risponde da solo, l'endpoint non esiste. La pagina usa il generico —
   `useFetch<Paginated<Thing>>('/api/things')` — perché Nitro non conosce la rotta
   e non c'è niente da inferire.
2. Arriva `server/api/things.get.ts`. Accendi e spegni `enabled` per confrontare le
   due risposte: stessa forma, stessi campi, stessi errori. Nitro ricarica al
   salvataggio, non serve riavviare.
3. Quando l'handler regge, `enabled: false` e **togli il generico da `useFetch`**:
   annotarlo a mano disattiva l'inferenza da Nitro, che è ciò che tiene allineati
   handler e pagina (vedi `app/pages/hello.vue`).
4. **Il file resta, spento, nel registro.** Da qui in poi non serve più a sviluppare
   la pagina: serve a riprodurre a comando uno stato che il database non ha —
   duecento partecipanti, un torneo senza round, un 500 sulla lista, una risposta
   che ci mette tre secondi. Il giorno che quel caso serve si riapre il file, si
   scrivono i dati che servono a quel debug e si rimette `enabled: true` per il
   tempo necessario.

Tenerlo non costa niente: in produzione non entra nel bundle, in sviluppo è una riga
nel registro e una rotta in `rou3` che restituisce subito `undefined`.

La manutenzione dovuta è una sola, e si paga da sé: **quando il contratto cambia, il
mock spento smette di compilare.** È tipizzato sullo stesso tipo di `shared/` che usa
l'handler, e il registro lo importa anche da spento, quindi `vue-tsc` lo vede.
Aggiustalo quando succede, non "poi" — un mock che non compila più è esattamente il
motivo per cui la prossima persona lo cancella invece di usarlo.

## Regole da non rompere

- **L'import in `server/middleware/mocks.ts` resta dinamico e dietro
  `import.meta.dev`.** In build Nitro sostituisce la costante con `false`
  (`staticFlags.dev` nel suo plugin `replace`), il resto della funzione diventa
  codice morto e rollup lo elimina: mock e faker non entrano nel bundle di
  produzione. Trasformarlo in un import statico farebbe fallire un
  `npm ci --omit=dev && npm run build`, perché faker è una devDependency.
- **Il registro resta esplicito.** Un `import.meta.glob` qui non funziona (è una
  funzionalità di Vite, Nitro usa rollup) e comunque toglierebbe l'unico punto in
  cui si vede quali mock esistono.
- **`server/mocks/` non è una cartella scansionata da Nitro** (lo sono `api/`,
  `routes/`, `middleware/`, `plugins/`, `utils/`): i file ci finiscono solo perché
  il registro li importa. Rinominare la cartella non rompe niente, spostarla sotto
  `server/api/` sì.
- **Niente mock in produzione, in nessuna forma.** Se serve un ambiente con dati
  finti, è un seed del database, non questo meccanismo.

## Verificare che funzioni

Con `npm run dev` attivo:

```bash
curl -i "http://localhost:3000/api/tournaments?limit=2&offset=1"   # 200 paginato, con MOCK_DATA: true
curl -i "http://localhost:3000/api/tournaments/pippo"              # 404 dal mock, con MOCK_DATA: true
curl -i "http://localhost:3000/api/users"                          # 401 e nessun MOCK_DATA
```

L'ultima è il controllo che conta: il middleware vede ogni richiesta, e una
regressione nel matching si manifesta come mock che rispondono al posto di
handler veri. L'header è il modo più rapido di accorgersene, anche dal browser.

Prima di un rilascio, l'unica verifica che il resto non copre è
`npm run build` seguito da `grep -r faker .output/server` — deve non trovare nulla.
