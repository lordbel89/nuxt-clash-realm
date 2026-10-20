# Repository access — GitHub

Le operazioni del contratto si fanno con lo script accanto a questo file (stdlib Python + `gh`):

```bash
python .claude/pr/github.py meta    <PR>                       # metadata
python .claude/pr/github.py threads <PR>                       # thread normalizzati, bot esclusi
python .claude/pr/github.py post    <PR> <payload.json>        # nuovo thread (review-pr)
python .claude/pr/github.py reply   <PR> <threadId> <body.md>  # risposta in un thread (address-pr)
python .claude/pr/github.py status  <PR> <threadId> <valore>   # resolved | unresolved (address-pr)
```

`<PR>` è il numero o l'URL. Con il solo numero il repo è quello di `origin`
(`Baxtion-dev/baxtion-dashboard`).

## Prerequisiti

`gh` installato e `gh auth login` fatto dall'utente. Se lo script esce con codice 2, riporta il
messaggio `STOP: ...` e il comando indicato, poi fermati. Non lanciare `gh auth login` al posto
dell'utente (è interattivo) e non chiedere token in chat.

## Cose da sapere

- **Su GitHub non tutto è un thread.** Solo i commenti di review ancorati a una riga hanno uno
  stato: id `PRRT_...`, `rawStatus` `resolved`/`unresolved`, più `,outdated` se il codice sotto
  è cambiato dopo il commento (in quel caso `line` è la riga originale). I commenti di
  conversazione (`rawStatus: comment`) e i corpi delle review (`rawStatus: review:<STATO>`) escono
  come thread di un solo commento, sempre `open`, perché non si possono risolvere: giudicali dal
  contenuto e dalle risposte che seguono nella conversazione, non dallo stato.
- `reply` su un id che non è `PRRT_...` pubblica un commento nuovo della PR (su GitHub non c'è
  altro modo), e lo dice nel campo `note`. `status` su quegli id fallisce.
- I commenti degli autori di tipo `Bot` (deploy Cloudflare Pages, CI) sono esclusi: sono i thread
  di sistema. I bot restano invece se aprono un thread di review su una riga.
- `post` ancora il commento al commit di testa della PR (`sourceCommit`): la riga deve esistere
  nella diff di quel commit, altrimenti GitHub risponde 422. Se succede, rileggi il file dal
  branch e ricontrolla il numero di riga prima di ripiegare su un commento a livello di PR.
- Valori di `vote`: `APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`, `DISMISSED`; `REQUESTED` per
  chi è stato chiamato in review e non ha ancora risposto.
- Non leggere i commenti con `gh pr view --comments`: mescola review e conversazione e perde
  riga, lato e stato. Passa dallo script.
