# Architecture — À la source v2

> Documentation canonique de l'architecture, à jour de ce qui est réellement codé.
> Dernière mise à jour : 2026-06-05.

## Vue d'ensemble

Monorepo npm workspaces (`server/`, `client/`). Outil web d'éducation populaire aux médias de Rouge Coquelicot. Auto-hébergé sur YunoHost.

```
a-la-source/
├── package.json            workspaces: [server, client]
├── client/                 front React 19 + Vite 6
├── server/                 back Express + better-sqlite3
├── db/                     base SQLite + image-cache
├── docs/                   documentation (ce dossier)
└── uploads/                fichiers uploadés
```

Stack : voir la note vault `02 — Choix technologiques`. Résumé : server Node 22 + Express 4 + TypeScript + better-sqlite3 + Mozilla Readability ; client React 19 + Vite 6 + react-router-dom 7 + zustand + recharts ; PWA.

## Serveur (`server/src/`)

Point d'entrée `index.ts` : Express sur le port `3031`, `authMiddleware` global, sert `/uploads` et `/images` (db/image-cache), et `client/dist` en production (fallback SPA).

### Routes API (`server/src/routes/`)

| Montage | Fichier | Rôle |
|---|---|---|
| `/api/sources` | sources.ts | CRUD des sources (vivier), fetch métadonnées, statuts veille/vivier/atelier/archive |
| `/api/tags` | tags.ts | tags manuels (thématique/mécanisme/média/libre) |
| `/api/evaluations` | evaluations.ts | scores écho (0-40) et pédagogie (0-50) par évaluateur |
| `/api/commentaires` | commentaires.ts | commentaires/analyses/questions sur les sources |
| `/api/medias` | medias.ts | liste, détail, stats, matrice média x mécanisme, **indice de confiance** |
| `/api/ateliers` | ateliers.ts | pipeline préparation + archives ateliers |
| `/api/auth` | auth.ts | authentification (rôles membre/animateur/admin) |
| `/api/mecanismes` | mecanismes.ts | 25 mécanismes de référence (fiches pédagogiques) |
| `/api/contenus` | contenus.ts | pages éditables (clé/valeur) |
| `/api/parametres` | parametres.ts | paramètres admin (courbes de fraîcheur, poids scores, formule confiance) |
| `/api/recherche` | recherche.ts | recherche plein texte |
| `/api/becs-rouges` | becsrouges.ts | suivi de chaînes/médias (intégré à l'espace perso) |

### Bibliothèques (`server/src/lib/`)

- `db.ts` : connexion better-sqlite3.
- `auth.ts` : middleware d'authentification.
- `readability.ts` + `opengraph.ts` : extraction d'articles (Mozilla Readability, OpenGraph).
- `ftr-site-config.ts` : règles FullTextRSS par site (65 sites configurés).
- `score.ts` : calcul du score atelier (écho/pédagogie/fraîcheur/timing) et de la confiance média.

### Base de données (`server/src/db/`)

`schema.sql` définit les tables ; des scripts `migrate-*.ts` appliquent les évolutions (phases 1-3, mécanismes v2, ateliers v2, archives v2) ; des `seed-*.ts` peuplent (médias, descriptions médias, évaluations d'ateliers).

Tables principales : `utilisateurs`, `medias`, `auteurs`, `sources`, `archives`, `tags` + `source_tags`, `mecanismes_reference` + `source_mecanismes`, `evaluations`, `commentaires`, `lectures`, `ateliers` + `atelier_sources` + `atelier_mecanismes`, `contenus`, `parametres`, `mots_cles`.

Table `medias` : `id, nom, type, url_site, description` + propriété structurée (Chantier A) `proprietaire, actionnaire_ultime, type_propriete, financement, annee_creation, ligne_revendiquee`. La propriété est désormais requêtable (cartographie « qui possède quoi »), plus seulement en texte libre. Migration `migrate-medias-propriete.ts`, données `seed-medias-propriete.ts` (à valider sur la carte Acrimed). Édition via `PUT /api/medias/:id/propriete`. Affichage dans la fiche média de l'Observatoire (`FichesMedias`). Principe : on décrit la propriété, on ne note pas le média. Cf. note vault `2026-06-05 — Refonte Observatoire et propriété des médias`.

### Intégration Discord

`server/src/discord/bot.ts` : soumission de sources depuis Discord (origine `discord`).

## Client (`client/src/`)

SPA React 19, react-router-dom 7, pages en `lazy()`. State global zustand (`store/useAuth.ts`, `store/useUI.ts`). API via `api/client.ts`. Types dans `types/index.ts`.

### Routes (vocabulaire à jour)

| Route | Page | Rôle |
|---|---|---|
| `/flux` | Flux | flux collaboratif de sources (page d'arrivée) |
| `/lire/:id` | Lire | reader + sidebar d'analyse (cœur) |
| `/observatoire[/:section]` | Observatoire | visualisations : mécanismes, matrice média x mécanisme, confiance, fiches médias |
| `/ateliers[/:section]` | Ateliers | pipeline de préparation + archives |
| `/archiver[/:section]` | Archiver | archivage collaboratif |
| `/perso[/:section]` | MonEspace | espace personnel (dont chaînes suivies, ex Becs Rouges) |
| `/apprendre[/:categorie[/:slug]]` | Mecanismes | fiches des 25 mécanismes + aide |
| `/admin/:section` | AdminParametrage | paramétrage (rôle admin) |
| `/projection/:atelierId` | Projection | mode projection plein écran en atelier |

Redirections de compatibilité : `/veille→/flux`, `/decrypter→/observatoire`, `/becs-rouges→/perso/chaines`, `/mecanismes→/apprendre`, `/aide→/apprendre/aide`, `/admin→/admin/parametrage`.

## Modules fonctionnels (rappel produit)

1. Veille collaborative (Flux), URL-first avec auto-fetch et archivage anti-linkrot.
2. Lecture et analyse (Lire), reader + sidebar interactive.
3. Identification des mécanismes (25 mécanismes de référence, fiches dans Apprendre).
4. Observatoire (timeline, matrice média x mécanisme, confiance, fiches médias).
5. Pipeline atelier (vivier filtrable par score 60 pédagogie / 40 écho, préparation, projection, export).

## Déploiement

YunoHost. En production, le serveur Express sert le build React (`client/dist`). Voir `docs/deploiement.md`.
