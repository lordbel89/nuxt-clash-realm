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
motore puro potrà vivere in server/domain quando esisterà un primo algoritmo.
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

`npm run test:backend` usa il test runner di Node 24, senza database e senza Nuxt.
Controlla allowlist dei mapper, serializzazione, validazione e payload degli errori,
proiezioni delle query e autorizzazione di /me con dipendenze simulate. Non è un test
HTTP end-to-end né un test dell'integrazione Better Auth/PostgreSQL.
Per futuri comandi concorrenti serviranno test d'integrazione su PostgreSQL reale;
PGlite non sostituisce quella verifica. Nessuna migrazione è richiesta qui.
