# Clash Realm — immagine di produzione per CapRover (arm64 e amd64).
#
# Due fasi: la prima costruisce l'app con tutte le dipendenze, la seconda tiene solo il risultato
# (`.output` è autosufficiente) più le poche dipendenze degli script di rilascio.

FROM node:26-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
# Le dipendenze degli script di rilascio (migrazioni, permessi, creazione account), con le versioni del lockfile
RUN node scripts/runtime-deps.ts /tools


FROM node:26-slim
WORKDIR /app

ENV NODE_ENV=production \
    NUXT_DATABASE_DIALECT=postgres \
    HOST=0.0.0.0 \
    PORT=3000

# Migrazioni, permessi e creazione degli account sono script TypeScript che Node 26 esegue da sé.
# Il package.json è minimo di proposito: serve solo a dire che i file sono moduli ES.
RUN echo '{"private":true,"type":"module"}' > package.json
COPY --from=build /tools/node_modules ./node_modules

COPY --from=build /app/.output ./.output
COPY server/auth ./server/auth
COPY server/database ./server/database
COPY scripts/user-create.ts ./scripts/user-create.ts
COPY --chmod=755 docker-entrypoint.sh ./

USER node
EXPOSE 3000

# CapRover non sposta il traffico su un container che non risponde; sotto i 40 secondi si tollerano
# migrazioni lunghe
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
