# Changelog dell'API

Cosa cambia nel contratto fra backend e frontend, dal più recente. Ogni voce dice lo stato della
rotta (**proposto**, **disponibile**, **cambiato**, **deprecato**), cosa fare dal lato del frontend e
quale seam `ponytail:` chiude, se ne chiude uno. Il riferimento completo è su `/_docs` in sviluppo,
generato in `docs/api/openapi.json`; le convenzioni sono in `docs/api/README.md`.

## 2026-10-13 · Organizzazioni (F0.5)

Le organizzazioni sono tutte rotte nostre: Better Auth resta solo per account e login, e il plugin
`organization` non si usa. Il client di Better Auth non va esteso.

- **Disponibile:** `GET/POST /api/organizations`, `GET/PATCH /api/organizations/:id`,
  `GET/POST /api/organizations/:id/members`, `PATCH/DELETE /api/organizations/:id/members/:userId`.
  Dettagli e errori su `/_docs`. In breve:
  - chiunque crea un'organizzazione e ne diventa owner; lo slug si calcola dal nome e non cambia
    più, nemmeno quando il nome cambia;
  - un'organizzazione la vedono solo i membri: per gli altri è un `404`;
  - un owner aggiunge owner e admin, un admin solo admin; solo un owner cambia i ruoli;
  - `DELETE …/members/<il proprio id>` è «esci dall'organizzazione»; l'ultimo owner non esce e non
    si declassa (`409`).
- **Cambiato:** `GET /api/users` accetta `search` (almeno due caratteri): trova il nome per
  sottostringa e l'email solo se scritta per intero.
- **Nuovo in `shared/`:** `types/organization.ts` (`Organization`, `OrganizationSummary`,
  `OrganizationMember`, `OrganizationRole`), `schemas/organization.ts`, `OrganizationId` in
  `types/ids.ts`, `UserListQuery` in `schemas/user.ts`.
- **Seed:** `npm run db:migrate && npm run db:seed` crea «Negozio di prova», con Luca
  (`test@example.com`) owner e Giulia admin. Marco Ferrari non ne è membro.

## 2026-10-13 · Iscrizione pubblica spenta (F0.4)

- **Cambiato:** `POST /api/auth/sign-up/email` (Better Auth) risponde `400` con
  `code: 'EMAIL_PASSWORD_SIGN_UP_DISABLED'`. In v1 nessuno si iscrive da solo: gli account li crea
  il backend con `npm run user:create`. Nel frontend non c'è una pagina di registrazione, quindi non
  si rompe niente; non va aggiunta.
- Login, logout e sessione (`/api/auth/sign-in/email`, `/sign-out`, `/get-session`) non cambiano. Gli
  utenti del seed restano, con la password `password`.

## 2026-10-13 · Riferimento generato e convenzioni (F0.3)

- **Nuovo:** `/_docs` (solo in sviluppo) mostra il riferimento dell'API con Scalar, letto da
  `docs/api/openapi.json`. Il file si rigenera con `npm run api:spec`, e un test fallisce se resta
  indietro rispetto al codice.
- **Nuovo in `shared/types/api.ts`:** `ApiWarning`, `ApiWarningCode` e `WithWarnings<T>`. Un comando
  che avvisa senza impedire risponde `{ data, warnings }`. Oggi nessuna rotta avvisa, e
  `ApiWarningCode` è vuoto (`never`): i codici arrivano con le rotte che li usano.
- **Convenzioni fissate** (`docs/api/README.md`): atti come `POST /api/<risorsa>/:id/<atto>`, `reason`
  obbligatoria dove serve, errori `400/401/403/404/409` con il testo per l'utente in `message`.
- **Disponibile, invariato:** `GET /api/users`, `GET /api/users/:id`, `GET /api/users/me`, ora
  documentati nel riferimento.
- **Sviluppo:** `NUXT_MOCKS=false` nel `.env` spegne tutti i mock (`server/middleware/mocks.ts`). Il
  default resta acceso.
