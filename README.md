# A la source

**Outil d'education populaire aux medias**, porte par [Rouge Coquelicot](https://rouge-coquelicot.fr).

> Developper le sens critique, ensemble. Pas denoncer les medias, mais comprendre comment l'information est construite.

---

## Pourquoi cet outil ?

Les ateliers « A la source » existent depuis 2024 au sein de Rouge Coquelicot. Un groupe se retrouve, decouvre une source choisie collectivement, et analyse ensemble comment l'information est construite — quels mecanismes informationnels sont a l'oeuvre, quel cadrage, quels implicites.

**Le probleme** : preparer ces ateliers et maintenir une veille collaborative necessitait un outil dedie. Rien sur le marche ne correspondait a notre usage (voir la section [Pourquoi pas Linkwarden ?](#pourquoi-pas-linkwarden-ou-wallabag-ou-shaarli)).

**La solution** : une application web legere, autohergee, construite sur mesure pour le workflow associatif d'education populaire aux medias.

---

## Ce que permet l'application

> **Refonte v3, par sujets.** L'entree du produit est le **Sujet** (theme durable, ex. le lithium en Alsace), pas le flux de liens. La page d'accueil est la grille des Sujets ; la veille collaborative (« Veille ») devient un **substrat secondaire** qui alimente sujets et activites. Autour des donnees communes (sources, evenements, medias, mecanismes, sujets) se branche une famille d'**activites** d'education populaire.

### Sujets (accueil)

- Theme durable, objet pivot editorial : couverture multisource, evenements, sources rattachees par glisser-deposer
- Creation par les membres, publication par les animateur·ices
- Page publique partageable (OpenGraph) + export YesWiki

### Activites d'education populaire

Un **socle commun** (table `activites`) avec un pipeline par type. 6 types : **atelier, dossier, decryptage (a chaud), debunkage, parcours, arpentage**. Le hub `/activites` les reunit avec une entree « Creer une activite ».

- **Atelier** : vivier de sources, preparation, projection plein ecran, synthese, export PDF. La bascule sur le socle `activites` est terminee.
- **Dossier / decryptage** : mise en perspective et contenu redige ; le decryptage est un dossier « a chaud » rattache a un evenement.
- **Debunkage** : demonstration, sources pour/contre, liens de posts reseaux.
- **Parcours** : cursus Apprendre, quiz de reperage des mecanismes sur cartes-sources nues (score).
- **Arpentage** : lecture collective fragmentee d'un document, attribution, restitutions, synthese.

### Veille collaborative (substrat)

- **Soumission URL-first** : coller une URL, tout le reste est auto-fetche (titre, auteur, media, mots-cles, image, accroche, archive)
- Vignettes enrichies avec badges (paywall, archive locale, evaluations, commentaires)
- Groupement temporel, filtres par media/tag/type
- Chaque membre peut soumettre, commenter, recommander

### Lecture et analyse (Lire)

- **Reader integre** : lecture de la copie locale (Readability, markdown, PDF) ou source originale
- **Sidebar interactive** : metadonnees, mots-cles, tags, evaluation, mecanismes identifies, commentaires
- Actions rapides : lire plus tard, proposer pour un atelier, recommander a un membre, partager sur Discord

### Identification des mecanismes

- 25 mecanismes de reference classes par famille (manipulation par les chiffres, arguments fallacieux, biais de cadrage, procedes discursifs, biais structurels)
- Chaque membre peut identifier un mecanisme sur une source, avec justification et extrait
- Fiches pedagogiques avec exemples et questions guidees

### Observatoire

- Matrice media × mecanisme (heatmap)
- Indice de confiance par media (calcul automatique)
- Fiches medias detaillees + propriete structuree, requetable (qui possede quoi)
- Couverture multisource d'un sujet, top sources les plus evaluees

> **Doctrine « decrire, ne pas noter ».** On decrit les sources et les medias par des **faits** (facettes factuelles), on ne les note pas par un score-verdict. Au vivier, le tri par defaut est la recence ; le score reste fourni pour un tri optionnel mais n'est plus presente comme un verdict. En atelier et en parcours, la source est presentee « a nu » (epoche : image + titre, sans indice du mecanisme) pour ne pas biaiser le groupe, garanti aussi cote API.

### Archivage anti-linkrot

- Extraction automatique (Mozilla Readability + regles FTR par site)
- 65 sites francais configures (presse nationale, PQR, pure players, radio/TV)
- Detection automatique des paywalls et archives partielles
- Upload manuel possible (markdown, PDF, HTML)

### Espace personnel

- Lectures sauvegardees, recommandations recues
- Chaines partenaires (YouTube, podcasts)

### Apprendre (pedagogie integree)

- **Catalogue de 25+ mecanismes informationnels** classes en 6 familles, avec fiches detaillees, exemples concrets, questions guidees pour les ateliers
- **Manuel de deconstruction mediatique** : guide complet pour les facilitateur·ices — biais cognitifs (Kahneman S1/S2, ancrage, cadrage), mecaniques de fabrication (titraille, chapo, angle), economie de l'attention, grille d'analyse imprimable, glossaire, references academiques
- Contenu stocke en base (anti link-rot), rendu en markdown cote client

### Diffusion hors appli

- **Pages publiques OpenGraph** (`/partage/debunkage|dossier/:id`, `/partage/sujet/:slug`) : pages autoportantes partageables sur Discord (carte « unfurlee »), rendues si l'objet est publie
- **Export YesWiki** des debunkages, dossiers et sujets : a coller sur becs-rouges.fr / rouge-coquelicot.fr

### Integration Discord

- **Ingestion Discord → Inbox** : un message poste dans un canal surveille cree une source en **Inbox a qualifier** (origine `discord`), triee ensuite dans l'appli. Le bot **repond** avec le lien vers l'article dans l'app, credite la source au bon membre (rapprochement par `discord_id`, sinon pseudo Discord), gere les **PDF Europresse joints** (copie integrale hors-ligne lisible dans l'app) et les fichiers `.ris` (metadonnees). Le bot est **gated sur le token** : sans `DISCORD_TOKEN`, l'ingestion est simplement inactive et le demarrage n'est jamais casse.
- **Ajout manuel** : poster un lien (avec texte en plus = commentaire), une version sans paywall par edition, repondre ou editer un message Discord rattache a la bonne source.
- **Consultation** : `!source`/`!fiche <id>` (fiche d'une source), `!texte <id>` (texte integral en blocs), `!editcom <id> <texte>` (editer un commentaire), `!vivier`/`!atelier`/`!analyser`, `!aide`/`!manuel`/`!guide` (le manuel). Chaque reponse invite a « faire encore mieux dans l'app ».
- **Notifications App → Discord** : a la publication d'un sujet, d'un dossier/decryptage ou d'un debunkage, un message est poste dans le salon dedie via `DISCORD_WEBHOOK_URL` (sans bot, garde anti-doublon).

### Espace personnel

- **Mon compte** : identite SSO, role, **pseudo Discord** editable.
- **Mes contributions** : sources proposees, evaluations, mecanismes, commentaires, activites creees ou animees, sujets crees.
- **Mes lectures** et recommandations recues, chaines partenaires suivies.

---

## Pourquoi pas Linkwarden, ou Wallabag, ou Shaarli ?

Cette question revient regulierement. Voici la reponse :

| Critere | Linkwarden / Wallabag / Shaarli | A la source |
|---------|-------------------------------|-------------|
| **Objectif** | Archiver des liens personnels | Education populaire collective |
| **Mecanismes** | Inexistant | 25 mecanismes, fiches, identification collaborative |
| **Evaluation multi-criteres** | Non | Score pedagogie + echo, multi-evaluateurs |
| **Pipeline atelier** | Non | Vivier → Selection → Preparation → Atelier → CR |
| **Observatoire** | Non | Timeline, matrice, confiance media |
| **Roles** | Admin/user | Membre / Animateur·ice / Admin |
| **Export atelier PDF** | Non | Oui |
| **Analyse collaborative** | Non | Commentaires types, questions guidees |
| **Anti-linkrot specialise** | Oui (generique) | Oui + regles par site (65 sites FR) |

**En resume** : les outils de bookmarking archivent des liens. **A la source** structure une demarche pedagogique collective autour de ces liens. Ce n'est pas la meme chose.

---

## Installation

```bash
# Prerequis : Node.js >= 22
npm install

# Initialiser la base de donnees
npm run init-db

# Developpement (server + client avec HMR)
npm run dev

# Production
npm run build
npm start
```

L'application tourne sur `http://localhost:3031`.

En developpement, le client Vite tourne sur le port 5173 avec proxy vers le serveur.

### Variables d'environnement

| Variable | Defaut | Description |
|----------|--------|-------------|
| `PORT` | 3031 (dev) / 3033 (conteneur) | Port du serveur |
| `NODE_ENV` | development | `production` active le serve statique |
| `A_LA_SOURCE_DB` | (auto) | Chemin de la base SQLite (en prod : `/data/a-la-source.db`) |
| `PUBLIC_BASE_URL` | — | URL publique de l'app (`https://alasource.barjot.net`), pour les liens et l'unfurl |
| `DISCORD_TOKEN` | — | Token du bot Discord ; sans lui l'ingestion et les commandes sont inactives |
| `DISCORD_WEBHOOK_URL` | — | Webhook du salon de diffusion (notifications App → Discord, sans bot) |
| `DISCORD_CHANNEL_VEILLE` | — | Identifiant du canal Discord surveille pour l'ingestion |

---

## Architecture

```
a-la-source/
├── server/          ← API Express + TypeScript
│   └── src/
│       ├── index.ts
│       ├── routes/  (sources, sujets, ateliers, debunkages, dossiers, arpentage,
│       │            parcours, medias, mecanismes, evenements, partage, tags,
│       │            evaluations, commentaires, recherche, becsrouges, auth,
│       │            contenus, parametres)
│       ├── lib/     (db, auth, score, readability, opengraph, ftr-site-config, yeswiki)
│       ├── discord/ (bot, client, ingestion, notify : ingestion + commandes + notifications, gated sur token)
│       └── db/      (schema, seed-*, migrate-* dont migrate-activites, auto-migrate)
├── client/          ← React 19 + Vite 6 + TypeScript
│   └── src/
│       ├── pages/   (Sujets, Sujet, Flux, Inbox, Activites, Ateliers, Dossiers,
│       │            Debunkages, Arpentages, Parcours, Lire, Observatoire,
│       │            Archiver, MonEspace, Mecanismes, Projection, AdminParametrage)
│       ├── components/  (layout, reader, sidebar, cards, forms)
│       ├── store/   (Zustand : useAuth, useUI)
│       └── api/     (client type-safe)
├── db/              ← SQLite + image-cache
└── uploads/         ← Copies locales (PDF, markdown)
```

### Stack technique

| Couche | Choix | Justification |
|--------|-------|---------------|
| Frontend | React 19 + Vite 6 + TypeScript | Ecosysteme, composants, HMR |
| State | Zustand | 3 KB, pas de boilerplate |
| Backend | Express + better-sqlite3 | Simple, performant, < 100 users |
| BDD | SQLite WAL | Zero config, backup triviale |
| Archivage | Readability + jsdom + FTR | Extraction intelligente par site |
| Auth | Authentik forward-auth (PIAF) | Zero mot de passe a gerer |
| Deploy | Conteneur Docker (infra PIAF, Bomp4rd) | Autoheberge, un seul process |

---

## Navigation

L'interface s'organise en 3 niveaux de header :

```
┌─────────────────────────────────────────────────────────────┐
│ H0 — Bandeau Rouge Coquelicot (logo + titre)                │
├─────────────────────────────────────────────────────────────┤
│ H1 — Navigation principale (refonte v3, Sujets en tete)      │
│   Sujets | Activites | Veille | Observatoire | Archiver      │
│   | Apprendre | Mon espace | [Admin]                          │
├─────────────────────────────────────────────────────────────┤
│ H2 — Sous-navigation contextuelle (selon la page)            │
│   ex: Mecanismes | Medias | Fiches medias | Couverture       │
└─────────────────────────────────────────────────────────────┘
```

---

## Deploiement (infra PIAF, Docker + Authentik)

En production, l'application tourne dans un **conteneur Docker** sur l'infra PIAF
(serveur **Bomp4rd**), sur le modele de Prisme :
- Servie sur `alasource.barjot.net`, derriere **Authentik forward-auth** (via NPM) ; aucun mot de passe a gerer.
- Conteneur `a-la-source` sur le reseau Docker `web`, **port interne 3033** (un seul process Node.js qui sert l'API et le build client).
- Base SQLite montee en lecture-ecriture (`A_LA_SOURCE_DB=/data/a-la-source.db`), volumes `uploads/` et `image-cache/`.
- Secrets (token et webhook Discord) dans `/srv/a-la-source/.env`.

Mise a jour depuis le poste de dev :

```bash
# Pousser le code vers le serveur (pas de .git distant)
git archive HEAD | tar -x -C /srv/a-la-source/app

# Rebuild et relance du conteneur
docker compose build && docker compose up -d
```

Voir `docs/deploiement.md` pour le detail (Dockerfile, compose, NPM, forward-auth).

---

## Contribution

Le projet est porte par Rouge Coquelicot. Les contributions sont les bienvenues :
- Signaler un bug : ouvrir une issue
- Proposer un mecanisme : PR sur `server/src/db/seed.ts`
- Ajouter un site FTR : PR sur `server/src/lib/ftr-site-config.ts`

---

## Licence

CC-BY-NC-SA 4.0 — Rouge Coquelicot
