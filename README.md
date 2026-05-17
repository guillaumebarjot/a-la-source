# A la source

**Outil d'education populaire sur l'information**, porte par [Rouge Coquelicot](https://rouge-coquelicot.fr).

> Developper le sens critique, ensemble. Pas denoncer les medias, mais comprendre comment l'information est construite.

---

## Pourquoi cet outil ?

Les ateliers « A la source » existent depuis 2024 au sein de Rouge Coquelicot. Un groupe se retrouve, decouvre une source choisie collectivement, et analyse ensemble comment l'information est construite — quels mecanismes informationnels sont a l'oeuvre, quel cadrage, quels implicites.

**Le probleme** : preparer ces ateliers et maintenir une veille collaborative necessitait un outil dedie. Rien sur le marche ne correspondait a notre usage (voir la section [Pourquoi pas Linkwarden ?](#pourquoi-pas-linkwarden-ou-wallabag-ou-shaarli)).

**La solution** : une application web legere, autohergee, construite sur mesure pour le workflow associatif d'education populaire a l'information.

---

## Ce que permet l'application

### Veille collaborative (Flux)

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

- Timeline des mecanismes identifies
- Matrice media × mecanisme (heatmap)
- Indice de confiance par media (calcul automatique)
- Fiches medias detaillees (proprietaire, ligne editoriale, stats)
- Top sources les plus evaluees

### Pipeline atelier

- **Vivier** : sources proposees, triees par date, filtrables par score (60% pedagogie / 40% echo)
- **Selection** : l'animateur·ice compose la shortlist
- **Preparation** : questions guidees, mecanismes pressentis, duree par source
- **Atelier en cours** : projection plein ecran, saisie du compte-rendu
- **Export PDF** : version imprimable de l'atelier (page de selection + sources + analyses)

### Archivage anti-linkrot

- Extraction automatique (Mozilla Readability + regles FTR par site)
- 65 sites francais configures (presse nationale, PQR, pure players, radio/TV)
- Detection automatique des paywalls et archives partielles
- Upload manuel possible (markdown, PDF, HTML)

### Espace personnel

- Lectures sauvegardees, recommandations recues
- Chaines partenaires (YouTube, podcasts)

### Integration Discord (prevue)

- Copie rapide pour partage dans un canal Discord
- Bot de notification (a venir)

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
| `PORT` | 3031 | Port du serveur |
| `NODE_ENV` | development | `production` active le serve statique |

---

## Architecture

```
a-la-source/
├── server/          ← API Express + TypeScript
│   └── src/
│       ├── index.ts
│       ├── routes/  (sources, tags, evaluations, ateliers, auth, medias, mecanismes, contenus)
│       ├── lib/     (db, auth, score, readability, opengraph, ftr-site-config)
│       └── db/      (schema, seed, migrations)
├── client/          ← React 19 + Vite 6 + TypeScript
│   └── src/
│       ├── pages/   (Flux, Lire, Observatoire, Ateliers, Archiver, MonEspace, Apprendre)
│       ├── components/
│       │   ├── layout/    (Header, SubNav)
│       │   ├── reader/    (Reader, MarkdownReader, PdfReader, ReadabilityReader)
│       │   ├── sidebar/   (MetadataPanel, TagsPanel, MecanismesPanel, EvaluationPanel, CommentairesPanel)
│       │   ├── cards/     (SourceCard)
│       │   └── forms/     (SubmitSource, EvaluerForm)
│       ├── store/   (Zustand : useAuth, useUI)
│       └── api/     (client type-safe)
├── db/              ← SQLite (WAL mode)
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
| Auth | SSO YunoHost (header Remote-User) | Zero mot de passe a gerer |
| Deploy | YunoHost | Autoheberge, un seul process |

---

## Navigation

L'interface s'organise en 3 niveaux de header :

```
┌─────────────────────────────────────────────────────────────┐
│ H0 — Bandeau Rouge Coquelicot (logo + titre)                │
├─────────────────────────────────────────────────────────────┤
│ H1 — Navigation principale                                   │
│   Flux | Observatoire | Ateliers | Archiver | Apprendre     │
├─────────────────────────────────────────────────────────────┤
│ H2 — Sous-navigation contextuelle (selon la page)            │
│   ex: Mecanismes | Medias | Fiches medias | Sources          │
└─────────────────────────────────────────────────────────────┘
```

---

## Deploiement YunoHost

L'application est concue pour etre deployee sur YunoHost :
- Authentification par SSO (header `Remote-User`)
- Un seul process Node.js, un seul port
- Base SQLite locale (pas de SGBD externe)
- Build statique servi par Express en production

---

## Contribution

Le projet est porte par Rouge Coquelicot. Les contributions sont les bienvenues :
- Signaler un bug : ouvrir une issue
- Proposer un mecanisme : PR sur `server/src/db/seed.ts`
- Ajouter un site FTR : PR sur `server/src/lib/ftr-site-config.ts`

---

## Licence

CC-BY-NC-SA 4.0 — Rouge Coquelicot
