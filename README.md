# A la source

Outil d'education populaire sur l'information, porte par [Rouge Coquelicot](https://rouge-coquelicot.fr).

**A la source** permet aux membres d'une communaute de :
- **Collecter** des sources mediatiques (articles, videos, rapports)
- **Identifier** les mecanismes informationnels a l'oeuvre (cadrage, cherry-picking, appel a l'emotion...)
- **Evaluer** collectivement l'interet pedagogique des sources
- **Preparer** des ateliers de decryptage en presentiel

Les ateliers « A la source » sont le point culminant : un groupe se retrouve, decouvre une source choisie collectivement, et analyse ensemble comment l'information est construite.

## Installation

```bash
# Prerequis : Node.js >= 22
npm install

# Initialiser la base de donnees
npm run init-db

# Developement (server + client avec HMR)
npm run dev

# Production
npm run build
npm start
```

L'application tourne sur `http://localhost:3031`.

En developpement, le client Vite tourne sur le port 5173 avec proxy vers le serveur.

## Architecture

```
a-la-source/
├── server/          ← API Express + TypeScript
│   └── src/
│       ├── index.ts
│       ├── routes/  (sources, tags, evaluations, ateliers, auth, medias, mecanismes, contenus)
│       ├── lib/     (db, auth, score, readability, opengraph)
│       └── db/      (schema, seed, migrations)
├── client/          ← React + Vite + TypeScript
│   └── src/
│       ├── pages/   (Veille, Lire, Decrypter, Ateliers, MonEspace, Aide)
│       ├── components/
│       ├── store/   (Zustand)
│       └── api/
├── db/              ← SQLite (WAL mode)
└── uploads/         ← Copies locales (PDF, markdown)
```

## Deploiement YunoHost

L'application est conçue pour etre deployee sur YunoHost :
- Authentification par SSO (header `Remote-User`)
- Un seul process Node.js, un seul port
- Base SQLite locale (pas de SGBD externe)
- Build statique servi par Express en production

## Licence

CC-BY-NC-SA 4.0 — Rouge Coquelicot
