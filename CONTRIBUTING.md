# Contribuer à « À la source »

## Stack technique

- **Frontend** : React 19, TypeScript strict, Vite, Zustand, React Router v7
- **Backend** : Express, TypeScript, better-sqlite3
- **Base** : SQLite en mode WAL (journal rollback classique en dev local ; la prod tourne en WAL depuis que la base vit sur un disque local, hors OneDrive)
- **Archivage** : @mozilla/readability + jsdom

## Développement

```bash
npm install
npm run init-db   # première fois
npm run dev       # lance server + client en parallèle
```

- Client : http://localhost:5173 (Vite HMR)
- API : http://localhost:3031
- En dev, l'utilisateur par défaut est `HydroLooney` (pas de SSO)

## Conventions

- TypeScript strict partout, pas de `any`
- Composants fonctionnels React, hooks
- Un fichier = un composant ou une route
- Noms de fichiers en PascalCase (composants) ou camelCase (utils)
- CSS avec variables, pas de framework CSS
- API REST, réponses JSON
- Pas de mention d'outils de génération de code

## Schéma BDD

Le schéma initial est dans `server/src/db/schema.sql`. Les évolutions sont des scripts `migrate-*.ts` (à plat dans `server/src/db/`, ex. `migrate-activites.ts`), appliqués au démarrage de manière idempotente par `auto-migrate.ts`. Les seeds sont des `seed-*.ts`.

Socle des activités : la table `activites` (socle commun) + une extension par type (`atelier_pipeline`, `debunkage_pipeline`, `dossier_contenu`, `arpentage_pipeline`). Le parcours vit en tables propres (`parcours*`). Voir `docs/architecture.md`.

## Rôles

- **membre** : soumettre, taguer, commenter, évaluer, lire
- **facilitateur·ice** : tout ce qu'un membre peut faire + gérer les ateliers
- **admin** : tout + gérer les utilisateurs

## Branches et commits

Une branche par chantier, fusionnée par merge request. Messages de commit en français accentué, anonymes, sans mention d'outil. Voir `docs/workflow-git.md` pour la procédure complète (checklist de revue, règle de la base canonique).
