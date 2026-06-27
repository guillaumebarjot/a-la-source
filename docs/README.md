# Documentation — À la source

Index des documents du dossier `docs/`. Point de départ pour comprendre l'architecture, contribuer ou déployer.

## Référence technique

| Document | Contenu |
|---|---|
| [`architecture.md`](architecture.md) | Architecture complète : stack, routes API, schéma BDD, client, navigation, glisser-déposer, diffusion hors appli |
| [`schema-bdd.md`](schema-bdd.md) | Familles de tables SQLite (sources, sujets, activités, mécanismes, Discord…) et mode journal |
| [`acces-identite.md`](acces-identite.md) | Authentification Authentik forward-auth, rôles (membre/animateur/admin), matrice de droits |
| [`deploiement.md`](deploiement.md) | Conteneur Docker sur Bomp4rd, volumes, variables d'environnement, procédure de mise à jour |

## Guides d'utilisation

| Document | Contenu |
|---|---|
| [`utilisation.md`](utilisation.md) | Parcours type, pages de l'application, Discord, rôles, tags |
| [`guide-facilitateur.md`](guide-facilitateur.md) | Préparer et mener un atelier « À la source » : vivier, sélection, projection, synthèse |
| [`mecanismes.md`](mecanismes.md) | Glossaire de 10 mécanismes illustratifs (la liste vivante des 25 est dans l'app) |

## Workflow et qualité

| Document | Contenu |
|---|---|
| [`workflow-git.md`](workflow-git.md) | Branches, commits, merge requests, semver, CHANGELOG, règle de la base canonique |
| [`CHANGELOG.md`](CHANGELOG.md) | Historique des évolutions par date |

## Conception (notes de travail)

| Document | Contenu |
|---|---|
| [`conception-activites-dossier-debunkage.md`](conception-activites-dossier-debunkage.md) | Modèle dossier vs débunkage vs décryptage |
| [`conception-tunnelisation-activites.md`](conception-tunnelisation-activites.md) | Tunnel brouillon/publié/archive, jalons de complétude, stepper |
| [`conception-quiz-autoapprentissage.md`](conception-quiz-autoapprentissage.md) | Quiz multi-thème, répétition espacée (SM-2) |
| [`conception-discord.md`](conception-discord.md) | Bot Discord : ingestion, commandes, notifications |
| [`conception-inbox-qualification.md`](conception-inbox-qualification.md) | Tunnel de qualification des sources (6 étapes, jalons, filtres) |
| [`completion-bdd-plan.md`](completion-bdd-plan.md) | Plan et résultats de la complétion de la base canonique |

## Audits

| Document | Contenu |
|---|---|
| [`audit-bdd-2026-06-21.md`](audit-bdd-2026-06-21.md) | État de la base au 21/06 : volumes, manques, doublons |
| [`audit-ux-2026-06-22.md`](audit-ux-2026-06-22.md) | Audit UX 4 perspectives + 10 simulations (22/06) |
| [`audit-ux-2026-06-27.md`](audit-ux-2026-06-27.md) | Audit UX et décisions produit (27/06) |
| [`audit-2026-06-11.md`](audit-2026-06-11.md) | Audit technique initial (schéma, FTS, routes) |
