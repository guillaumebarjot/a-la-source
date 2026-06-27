# À la source

**Outil d'éducation populaire aux médias**, porté par [Rouge Coquelicot](https://rouge-coquelicot.fr).

> Développer le sens critique, ensemble. Pas dénoncer les médias, mais comprendre comment l'information est construite.

## Pourquoi cet outil ?

Les ateliers « À la source » existent depuis 2024 au sein de Rouge Coquelicot. Un groupe se retrouve, découvre une source choisie collectivement, et analyse ensemble comment l'information est construite : quels mécanismes informationnels sont à l'œuvre, quel cadrage, quels implicites.

**Le problème** : préparer ces ateliers et maintenir une veille collaborative nécessitait un outil dédié. Rien sur le marché ne correspondait à notre usage (voir la section [Pourquoi pas Linkwarden ?](#pourquoi-pas-linkwarden-ou-wallabag-ou-shaarli)).

**La solution** : une application web légère, autohébergée, construite sur mesure pour le workflow associatif d'éducation populaire aux médias.

## Ce que permet l'application

> **Refonte v3, par sujets.** L'entrée du produit est le **Sujet** (thème durable, ex. le lithium en Alsace), pas le flux de liens. La veille collaborative (« À lire ») devient un **substrat secondaire** qui alimente sujets et activités. Autour des données communes (sources, événements, médias, mécanismes, sujets) se branche une famille d'**activités** d'éducation populaire.

### Accueil pédagogique (`/accueil`)

La page d'accueil explique le parcours d'une source de bout en bout (de l'Inbox aux activités), avec **aide au survol** sur chaque étape et **blocs repliables** pour le menu de l'application. Le raccourci vers l'Inbox en attente et vers les parcours et lectures en cours y est affiché.

### À trier — hub de la qualité des sources (`/inbox`)

L'Inbox est le **hub collectif de qualification des sources** (entrée H1, libellé « À trier »). Qualifier une source n'est plus un simple « envoyer en veille » : c'est un **tunnel d'enrichissement à la carte**, non bloquant, en six étapes (accepter, fiabiliser, situer, analyser, mobiliser, commenter). Chaque source affiche ses **jalons factuels** (copie locale, accroche, image, sujet, mécanisme, activité, commentaire) et un **compteur de jalons** N/M. Une source est « bien qualifiée » quand elle a une copie locale, une accroche et une image.

Les **filtres par ce qui manque** (à accepter, sans copie locale, sans accroche, sans image, sans sujet, non analysée) remplacent l'ancienne page Archiver. La copie locale s'ajoute inline sur la carte de la source (archivage automatique, collage de texte Europresse ou PDF joint) sans ressaisir l'identifiant de la source. Endpoint serveur : `GET /api/sources/qualification`.

La page Archiver est redirigée vers `/inbox?manque=copie_locale`.

### Sujets (`/sujets`)

Thème durable, objet pivot éditorial : couverture multisource, événements, sources rattachées par glisser-déposer. Création par les membres, publication par les animateur·ices. Page publique partageable (OpenGraph) et export YesWiki.

### Activités d'éducation populaire

Un **socle commun** (table `activites`) avec un pipeline par type. 6 types : **atelier, dossier, décryptage (à chaud), débunkage, parcours, arpentage**. Le hub `/activites` les réunit avec une entrée « Créer une activité ». Le **Parcours** ne vit plus que sous **Apprendre** (retiré du hub Activités).

- **Atelier** : liste unique (à venir, en cours, puis passés) + page objet par atelier (stepper de jalons, onglets Préparation / Pilotage / Synthèse, projection plein écran, export PDF). Vivier accessible depuis la liste ou directement.
- **Dossier / décryptage** : mise en perspective et contenu rédigé ; le décryptage est un dossier « à chaud » rattaché à un événement.
- **Débunkage** : démonstration, sources pour/contre, liens de posts réseaux.
- **Parcours** : cursus Apprendre, quiz de repérage des mécanismes sur cartes-sources nues.
- **Arpentage** : lecture collective fragmentée d'un document, attribution, restitutions, synthèse.

### À lire — veille collaborative (`/veille`)

Le substrat de la veille (libellé « À lire », distinct de l'Inbox). Affiche les sources soumises et qualifiées, triées par récence. Soumission URL-first : coller une URL, tout le reste est auto-fetché (titre, auteur, média, mots-clés, image, accroche, archive). Filtres par média/tag/type/commentées.

### Observatoire (`/observatoire`)

La **référence critique des médias** : qui possède quoi (propriété et concentration), couverture comparée d'un même fait, fiches médias factuelles, catalogue des mécanismes. Cinq sections (sous-nav H2) : **Tableau de bord** (miroir factuel de notre veille : volumes, médias, mécanismes, sujets), **Propriété** (cartographie des actionnaires), **Couverture comparée**, **Fiches médias** (propriété + transparence), **Catalogue mécanismes** (fiches pédagogiques avec exemples réels). Doctrine : décrire, ne pas noter.

### Apprendre (`/apprendre`)

Pédagogie intégrée : **Manuel de déconstruction médiatique**, **Parcours/quiz** de repérage des mécanismes (cartes-sources nues), **Aide et Ressources**.

### Identification des mécanismes

25 mécanismes de référence classés par famille. Chaque membre peut identifier un mécanisme sur une source, avec justification et extrait. Des analyses initiales ont été posées sur les sources à copie locale, de façon conservative et anonyme (`identifie_par = NULL`).

### Données fiabilisées (complétion v2)

Scripts de complétion appliqués à la base canonique (voir `docs/audit-bdd-2026-06-21.md`) :
- **Images** : récupération de l'`og:image` avec décodage des entités HTML et filtrage des placeholders évidents.
- **Accroches** : backfill depuis le texte archivé pour les sources sans accroche.
- **Rattachement aux sujets** : rapprochement automatique par mots-clés.
- **Rapport des liens morts** : détection et signal (sans suppression, décision humaine).
- **Dédoublonnage** : fusion des doublons d'URL.

### Archivage anti-linkrot

Extraction automatique (Mozilla Readability, règles FTR par site). 65 sites français configurés (presse nationale, PQR, pure players, radio/TV). Détection automatique des paywalls. Upload manuel possible (markdown, PDF, HTML).

### Espace personnel (`/perso`)

Mon compte (identité SSO, rôle, pseudo Discord), mes contributions, mes lectures, recommandations reçues, chaînes partenaires suivies.

### Lecture (`/lire/:id`)

Reader avec sidebar interactive (métadonnées, tags, mécanismes, évaluation, commentaires). Panneau **« Corriger l'accès »** (toujours disponible, pré-ouvert si paywall ou archive partielle) pour remettre un lien d'accès, coller le texte intégral ou joindre un PDF, sans ressaisir l'identifiant. Actions rapides : lire plus tard, recommander, ranger dans un dossier, proposer au vivier, partager sur Discord.

### Intégration Discord

Ingestion Discord vers Inbox : un message posté dans un canal surveillé crée une source en Inbox à qualifier. Le bot répond avec le lien vers l'article dans l'app, crédite la source au bon membre, gère les PDF Europresse joints et les fichiers `.ris`. Gated sur le token : sans `DISCORD_TOKEN`, l'ingestion est inactive et le démarrage n'est jamais cassé. Commandes de consultation : `!source`, `!fiche`, `!texte`, `!editcom`, `!vivier`, `!atelier`, `!analyser`, `!aide`, `!manuel`.

### Diffusion hors appli

Pages publiques OpenGraph (`/partage/debunkage|dossier/:id`, `/partage/sujet/:slug`) partageables sur Discord (carte « unfurlée »). Exports YesWiki des débunkages, dossiers et sujets.

## Pourquoi pas Linkwarden, ou Wallabag, ou Shaarli ?

Cette question revient régulièrement. Voici la réponse :

| Critère | Linkwarden / Wallabag / Shaarli | À la source |
|---|---|---|
| **Objectif** | Archiver des liens personnels | Éducation populaire collective |
| **Mécanismes** | Inexistant | 25 mécanismes, fiches, identification collaborative |
| **Évaluation multi-critères** | Non | Score pédagogie + écho, multi-évaluateurs |
| **Pipeline atelier** | Non | Vivier > Sélection > Préparation > Atelier > CR |
| **Observatoire** | Non | Propriété des médias, couverture comparée, fiches |
| **Rôles** | Admin/user | Membre / Animateur·ice / Admin |
| **Export atelier PDF** | Non | Oui |
| **Analyse collaborative** | Non | Commentaires types, questions guidées |
| **Anti-linkrot spécialisé** | Oui (générique) | Oui, règles par site (65 sites FR) |

Les outils de bookmarking archivent des liens. **À la source** structure une démarche pédagogique collective autour de ces liens.

## Navigation

L'interface s'organise en 3 niveaux de header :

| Niveau | Contenu |
|---|---|
| H0 | Bandeau Rouge Coquelicot (logo + titre) |
| H1 | Navigation principale : **Accueil · Mon espace · À trier · À lire · Sujets · Activités · Apprendre · Observatoire** (+ Admin) |
| H2 | Sous-navigation contextuelle selon la page (ex. Activités > Ateliers · Dossiers · Débunkages ; Ateliers > Liste · Vivier ; Observatoire > Tableau de bord · Propriété · Couverture comparée · Fiches médias · Catalogue mécanismes ; Apprendre > Parcours · Manuel · Aide & Ressources) |

Redirections de compatibilité : `/` vers `/accueil`, `/archiver` et `/a-archiver` vers `/inbox?manque=copie_locale`, `/mecanismes` vers `/apprendre`, `/decrypter` vers `/observatoire`, `/aide` vers `/apprendre/aide`, `/becs-rouges` vers `/perso/chaines`.

## Installation

```bash
# Prérequis : Node.js >= 22
npm install

# Initialiser la base de données
npm run init-db

# Développement (server + client avec HMR)
npm run dev

# Production
npm run build
npm start
```

L'application tourne sur `http://localhost:3031` en développement. En développement, le client Vite tourne sur le port 5173 avec proxy vers le serveur.

### Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | 3031 (dev) / 3033 (conteneur) | Port du serveur |
| `NODE_ENV` | development | `production` active le serve statique |
| `A_LA_SOURCE_DB` | (auto) | Chemin de la base SQLite (en prod : `/data/a-la-source.db`) |
| `PUBLIC_BASE_URL` | (aucun) | URL publique de l'app (`https://alasource.rouge-coquelicot.fr`), pour les liens et l'unfurl |
| `DISCORD_TOKEN` | (aucun) | Token du bot Discord ; sans lui l'ingestion et les commandes sont inactives |
| `DISCORD_WEBHOOK_URL` | (aucun) | Webhook du salon de diffusion (notifications App vers Discord, sans bot) |
| `DISCORD_CHANNEL_VEILLE` | (aucun) | Identifiant du canal Discord surveillé pour l'ingestion |

## Architecture

```
a-la-source/
├── server/          <- API Express + TypeScript
│   └── src/
│       ├── index.ts
│       ├── routes/  (sources, sujets, ateliers, debunkages, dossiers, arpentage,
│       │            parcours, medias, mecanismes, evenements, partage, tags,
│       │            evaluations, commentaires, recherche, becsrouges, auth,
│       │            contenus, parametres)
│       ├── lib/     (db, auth, score, readability, opengraph, ftr-site-config, yeswiki)
│       ├── discord/ (bot, client, ingestion, notify : ingestion + commandes + notifications, gated sur token)
│       └── db/      (schema, seed-*, migrate-* dont migrate-activites, auto-migrate)
├── client/          <- React 19 + Vite 6 + TypeScript
│   └── src/
│       ├── pages/   (Accueil, Sujets, Sujet, Flux, Inbox, Activites, Ateliers,
│       │            Dossiers, Debunkages, Arpentages, Parcours, Lire, Observatoire,
│       │            MonEspace, Mecanismes, Projection, AdminParametrage)
│       ├── components/  (layout, reader, sidebar, cards, forms)
│       ├── store/   (Zustand : useAuth, useUI)
│       └── api/     (client type-safe)
├── db/              <- SQLite + image-cache
└── uploads/         <- Copies locales (PDF, markdown)
```

### Stack technique

| Couche | Choix |
|---|---|
| Frontend | React 19 + Vite 6 + TypeScript |
| State | Zustand |
| Backend | Express + better-sqlite3 |
| BDD | SQLite mode WAL |
| Archivage | Readability + jsdom + FTR |
| Auth | Authentik forward-auth (PIAF) |
| Deploy | Conteneur Docker (infra PIAF, Bomp4rd) |

## Déploiement (infra PIAF, Docker + Authentik)

En production, l'application tourne dans un **conteneur Docker** sur l'infra PIAF (serveur **Bomp4rd**) :
- Servie sur `alasource.rouge-coquelicot.fr`, derrière **Authentik forward-auth** (via NPM) ; aucun mot de passe à gérer.
- Conteneur `a-la-source` sur le réseau Docker `web`, **port interne 3033** (un seul process Node.js qui sert l'API et le build client).
- Base SQLite montée en lecture-écriture (`A_LA_SOURCE_DB=/data/a-la-source.db`), volumes `uploads/` et `image-cache/`.
- Secrets (token et webhook Discord) dans `/srv/a-la-source/.env`.

Mise à jour depuis le poste de dev :

```bash
# Pousser le code (git archive sur main)
git archive HEAD | ssh bomp4rd 'tar -x -C /srv/a-la-source/app'

# Rebuild et relance du conteneur
docker compose build && docker compose up -d
```

Voir `docs/deploiement.md` pour le détail (Dockerfile, compose, NPM, forward-auth).

## Contribution

Le projet est porté par Rouge Coquelicot. Les contributions sont les bienvenues :
- Signaler un bug : ouvrir une issue
- Proposer un mécanisme : PR sur les migrations `server/src/db/migrate-mecanismes*.ts`
- Ajouter un site FTR : PR sur `server/src/lib/ftr-site-config.ts`

La discipline de travail (branches, commits anonymes, ouverture d'une merge request, checklist de revue, règle de la base canonique) est décrite dans [`docs/workflow-git.md`](docs/workflow-git.md).

## Licence

CC-BY-NC-SA 4.0 — Rouge Coquelicot
