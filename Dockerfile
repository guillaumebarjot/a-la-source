# syntax=docker/dockerfile:1
# Image multi-etapes : build des workspaces (server tsc + client vite), puis runtime
# servant l'API Express et le build statique du client sur un seul port.

FROM node:22-bookworm AS build
WORKDIR /app
# better-sqlite3 compile un binding natif : outils de build necessaires.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm ci && npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3033
ENV A_LA_SOURCE_DB=/data/a-la-source.db
# Repertoires de donnees runtime (montes en volume en production).
RUN mkdir -p /data /app/uploads /app/db/image-cache
COPY --from=build /app /app
EXPOSE 3033
CMD ["npm", "start"]
