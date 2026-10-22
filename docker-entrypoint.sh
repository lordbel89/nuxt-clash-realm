#!/bin/sh
# Avvio del container: migra il database, dà i permessi al ruolo dell'app, poi lancia il server.
#
# Le migrazioni girano con il ruolo owner (DATABASE_MIGRATION_URL). Il server parte con il ruolo
# dell'applicazione (NUXT_DATABASE_URL) e senza l'URL dell'owner nel suo ambiente: se una migrazione
# fallisce, il container esce e CapRover tiene la versione precedente.
#
# Prima di tutto le variabili obbligatorie. Senza segreto o senza origine il server partirebbe e
# passerebbe il controllo di salute, ma ogni login fallirebbe: meglio fermarsi qui, prima di migrare.
set -eu

missing=''
for name in DATABASE_MIGRATION_URL NUXT_DATABASE_URL NUXT_AUTH_SECRET NUXT_AUTH_URL; do
  eval "value=\${$name:-}"
  [ -n "$value" ] || missing="$missing $name"
done

if [ -n "$missing" ]; then
  echo "Variabili d'ambiente mancanti:$missing (vedi docs/deploy.md)." >&2
  exit 1
fi

NUXT_DATABASE_URL="$DATABASE_MIGRATION_URL" node server/database/migrate.ts
NUXT_DATABASE_URL="$DATABASE_MIGRATION_URL" node server/database/grant.ts

exec env -u DATABASE_MIGRATION_URL node .output/server/index.mjs
