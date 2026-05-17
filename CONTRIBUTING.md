# Contribuer a « A la source »

## Stack technique

- **Frontend** : React 19, TypeScript strict, Vite, Zustand, React Router v7
- **Backend** : Express, TypeScript, better-sqlite3
- **Base** : SQLite en mode WAL
- **Archivage** : @mozilla/readability + jsdom

## Developpement

```bash
npm install
npm run init-db   # premiere fois
npm run dev       # lance server + client en parallele
```

- Client : http://localhost:5173 (Vite HMR)
- API : http://localhost:3031
- En dev, le user est `HydroLooney` par defaut (pas de SSO)

## Conventions

- TypeScript strict partout, pas de `any`
- Composants fonctionnels React, hooks
- Un fichier = un composant ou une route
- Noms de fichiers en PascalCase (composants) ou camelCase (utils)
- CSS avec variables, pas de framework CSS
- API REST, reponses JSON
- Pas de mention d'outils de generation de code

## Schema BDD

Le schema est dans `server/src/db/schema.sql`. Les migrations dans `server/src/db/migrations/`.

## Roles

- **membre** : soumettre, taguer, commenter, evaluer, lire
- **facilitateur·ice** : tout ce qu'un membre peut faire + gerer les ateliers
- **admin** : tout + gerer les utilisateurs
