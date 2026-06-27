# Architecture — À la source v3

> Documentation canonique de l'architecture, à jour de ce qui est réellement codé.
> Dernière mise à jour : 2026-06-21.

## Vue d'ensemble

Monorepo npm workspaces (`server/`, `client/`). Outil web d'éducation populaire aux médias de Rouge Coquelicot. Déployé en conteneur Docker sur l'infra PIAF (serveur Bomp4rd), derrière Authentik forward-auth.

**Refonte v3, par sujets.** L'entrée du produit est désormais le **Sujet** (thème durable, ex. lithium en Alsace), pas le flux de liens. La page d'accueil est `/accueil` (pédagogique) ; `/` redirige vers `/accueil`. La veille collaborative (ex `/flux`, renommée « Veille ») devient un **substrat secondaire** qui alimente les sujets et les activités. Autour des données communes (sources, événements, médias, mécanismes, sujets), une famille d'**activités** d'éducation populaire (atelier, dossier, décryptage, débunkage, parcours, arpentage) se branche, chacune posée comme un pipeline-outil sur ce socle.

```
a-la-source/
├── package.json            workspaces: [server, client]
├── client/                 front React 19 + Vite 6
├── server/                 back Express + better-sqlite3
├── db/                     base SQLite + image-cache
├── docs/                   documentation (ce dossier)
└── uploads/                fichiers uploadés
```

Stack : server Node 22 + Express 4 + TypeScript + better-sqlite3 + Mozilla Readability ; client React 19 + Vite 6 + react-router-dom 7 + zustand + recharts ; PWA.

## Serveur (`server/src/`)

Point d'entrée `index.ts` : Express sur le port `3031`, `authMiddleware` global, sert `/uploads` et `/images` (db/image-cache), et `client/dist` en production (fallback SPA).

### Routes API (`server/src/routes/`)

| Montage | Fichier | Rôle |
|---|---|---|
| `/api/sources` | sources.ts | CRUD des sources (vivier), fetch métadonnées, statuts veille/vivier/atelier/archive. `GET /qualification` : hub de qualité des sources (Inbox-hub), jalons booléens, compteur de jalons N/M, filtre `?manque=` par jalon manquant. |
| `/api/tags` | tags.ts | Tags manuels (thématique/mécanisme/média/libre) |
| `/api/evaluations` | evaluations.ts | Scores écho (0-40) et pédagogie (0-50) par évaluateur |
| `/api/commentaires` | commentaires.ts | Commentaires/analyses/questions sur les sources |
| `/api/medias` | medias.ts | Liste, détail, stats, matrice média × mécanisme, propriété groupée, clusters par groupe propriétaire et par famille éditoriale. Doctrine : décrire (compteurs factuels), pas noter. |
| `/api/ateliers` | ateliers.ts | Pipeline atelier (vivier, préparation, en cours, synthèse, impression). A1 terminée : lit/écrit exclusivement depuis `activites` + `atelier_pipeline` + `activite_sources` + `activite_mecanismes`. `GET /vivier` expose un bloc `facettes` factuel (doctrine « décrire, ne pas noter ») et trie par récence de soumission par défaut. |
| `/api/sujets` | sujets.ts | Sujets (thèmes durables) : CRUD, publication, rattachement sources/événements |
| `/api/debunkages` | debunkages.ts | Activité débunkage : démonstration, sources pour/contre, liens de posts réseaux, publier |
| `/api/parcours` | parcours.ts | Cursus Apprendre : parcours/quiz de repérage des mécanismes, sessions, score |
| `/api/dossiers` | dossiers.ts | Activité dossier (et décryptage à chaud = flag `a_chaud` + événement) : contenu, mise en perspective, sources, publier |
| `/api/arpentages` | arpentage.ts | Activité arpentage : fragments, attribution, restitutions, synthèse |
| `/partage/{debunkage,dossier}/:id`, `/partage/sujet/:slug` | partage.ts | Pages HTML publiques (sans login) des débunks, dossiers/décryptages et thèmes publiés, avec OpenGraph (unfurl Discord) |
| `/api/{debunkages,dossiers}/:id/yeswiki`, `/api/sujets/:idOrSlug/yeswiki` | (resp. routes) | Export en syntaxe YesWiki (lib `yeswiki.ts`) |
| `/api/auth` | auth.ts | Authentification (rôles membre/animateur/admin) |
| `/api/mecanismes` | mecanismes.ts | 25 mécanismes de référence (fiches pédagogiques) |
| `/api/contenus` | contenus.ts | Pages éditables (clé/valeur) |
| `/api/parametres` | parametres.ts | Paramètres admin (courbes de fraîcheur, poids scores, formule confiance) |
| `/api/recherche` | recherche.ts | Recherche plein texte |
| `/api/becs-rouges` | becsrouges.ts | Suivi de chaînes/médias (intégré à l'espace perso) |

### Bibliothèques (`server/src/lib/`)

- `db.ts` : connexion better-sqlite3, mode WAL (la base est locale, sur disque, hors OneDrive), `foreign_keys = ON`.
- `auth.ts` : middleware d'authentification (Authentik forward-auth : lit `X-authentik-username` / `X-authentik-groups`, repli `Remote-User` puis `?_user=` en dev ; rôle dérivé des groupes, élevable en base).
- `readability.ts` + `opengraph.ts` : extraction d'articles (Mozilla Readability, OpenGraph).
- `ftr-site-config.ts` : règles FullTextRSS par site (65 sites configurés).
- `score.ts` : calcul du score atelier (écho/pédagogie/fraîcheur/timing) et de la confiance média.

### Base de données (`server/src/db/`)

`schema.sql` définit les tables ; des scripts `migrate-*.ts` appliquent les évolutions additives (phases 1-3, mécanismes v2, ateliers v2, archives v2, activités, sujets, débunkage, parcours, dossiers, arpentage, événements, propriété des médias) ; des `seed-*.ts` peuplent (médias, descriptions médias, évaluations d'ateliers).

Tables principales : `utilisateurs`, `medias`, `auteurs`, `sources`, `archives`, `tags` + `source_tags`, `mecanismes_reference` + `source_mecanismes`, `evaluations`, `commentaires`, `lectures`, `contenus`, `parametres`, `mots_cles`.

Refonte v3 (par sujets), tables additives (auto-migrate au boot, idempotent) :
- `sujets` + `sujet_sources` + `sujet_evenements` : le Sujet, thème durable, objet pivot éditorial.
- `evenements` : faits d'actualité couverts par plusieurs sources.

#### Socle commun des activités : `activites`

`migrate-activites.ts` pose la colonne vertébrale de l'éducation populaire : une table **unique** `activites` (socle commun) + une **extension par type**. Schéma réel :

- `activites` : `id`, `type` (CHECK : `atelier` / `dossier` / `decryptage` / `debunkage` / `parcours` / `arpentage`), `sujet_id` (rattachement au thème), `titre`, `statut` (défaut `brouillon`), `anime_par`, `cree_par`, `legacy_atelier_id` (trace du backfill), `cree_le`, `maj_le`. Index sur `type` et `sujet_id`.
- `activite_sources` : corpus de l'activité (`activite_id`, `source_id`, `ordre`, `note`, PK composite).
- `activite_mecanismes` : mécanismes de synthèse rattachés à l'activité.
- Extensions par type : `atelier_pipeline` (logistique + déroulé), `debunkage_pipeline` + `debunkage_posts`, `dossier_contenu` (dossier + décryptage à chaud, flag `a_chaud` + `evenement_id`), `arpentage_pipeline` + `arpentage_fragments` + `arpentage_restitutions`.

**Types branchés sur `activites` aujourd'hui : atelier, débunkage, dossier (et décryptage = dossier `a_chaud=1`), arpentage.** Le **parcours** est listé dans le CHECK mais vit en tables propres (`parcours` + `parcours_questions` + `parcours_sessions` + `parcours_reponses`), structurellement distinct (cursus/quiz, pas un pipeline éditorial).

#### Bascule A1 (terminée)

`routes/ateliers.ts` lit et écrit exclusivement depuis `activites`, `atelier_pipeline`, `activite_sources` et `activite_mecanismes`. Les tables legacy `ateliers` / `atelier_sources` / `atelier_mecanismes` sont conservées en filet mais ne sont plus lues par aucun code applicatif.

#### Inbox à qualifier : jalons et score

`GET /api/sources/qualification` calcule par source 7 jalons booléens :
- `copie_locale` : archive `complete` ou `completude = 'integral_offline'`
- `accroche` : accroche non vide
- `image` : `image_url` non vide
- `sujet` : rattachée à au moins 1 sujet
- `analysee` : au moins 1 mécanisme identifié
- `mobilisee` : versée dans au moins 1 activité
- `commentee` : au moins 1 commentaire

L'affichage montre un compteur de jalons `N/M` (factuel, pas un verdict de score). **Bien qualifiée** = copie_locale ET accroche ET image. Filtre `?manque=<jalon>` pour cibler les sources incomplètes. Filtre `?tout=1` pour inclure les sources déjà bien qualifiées.

Note : la table `evaluations` conserve des colonnes de score (écho/pédagogie) pour le tri optionnel au vivier ; le score-verdict global n'est plus affiché dans l'Inbox (décision 27/06, aligné avec la doctrine « décrire, ne pas noter »).

#### Autres tables additives

- `sources.completude` : `libre` / `partiel` / `integral_offline`.
- `medias` : propriété structurée (`proprietaire`, `actionnaire_ultime`, `type_propriete`, `financement`, `ligne_revendiquee`) et clusters (`groupe_proprietaire` = groupe nommé au bout de la chaîne, `famille` = famille éditoriale) requêtables (cartographie « qui possède quoi »). Migration `migrate-medias-propriete.ts`, données `seed-medias-propriete.ts`. Les colonnes `groupe_proprietaire` et `famille` sont ajoutées par `autoMigrate()` au boot (ADD COLUMN idempotent).
- `discord_messages` : mapping message Discord vers source (dédup, éditions, réponses Discord rattachées à la bonne source).

#### Scripts de complétion (`server/src/scripts/completion/`)

Appliqués à la base canonique (sur copie, jamais en direct) :
- `refetch-images.ts` : récupère l'`og:image` manquante avec décodage des entités HTML et filtrage des placeholders (chemins contenant « placeholder », « default.png », ou segment « logo » isolé).
- `backfill-accroche.ts` : dérive l'accroche depuis le texte archivé pour les sources sans accroche.
- `rattacher-sujets.ts` : rapprochement automatique source/sujet par mots-clés.
- `rapport-liens-morts.ts` : détecte les sources dont l'URL est inaccessible (ENOTFOUND, ECONNREFUSED, timeout) ; rapport seul, décision humaine.
- `dedup-sources.ts` : fusion des doublons d'URL.

Script `server/src/scripts/seed-analyses.ts` : pose des analyses de mécanismes sur les sources à copie locale, de façon conservative et anonyme (`identifie_par = NULL`).

### Intégration Discord

`server/src/discord/bot.ts` + `client.ts` (discord.js 14). Gated sur `DISCORD_TOKEN`. Tout message entrant dans un canal surveillé crée une source en Inbox (`origine='discord'`, `a_qualifier=1`). Commandes de consultation (`!source`, `!fiche`, `!texte`, `!editcom`, `!vivier`, `!atelier`, `!analyser`, `!aide`, `!manuel`, `!guide`). Notifications App vers Discord à la publication (via `DISCORD_WEBHOOK_URL`, sans bot).

### Doctrine « décrire, ne pas noter » et epoché

Principe transverse du produit : on décrit les sources et les médias par des **faits**, on ne les note pas par un score-verdict.

- **Au vivier.** `GET /api/ateliers/vivier` expose un bloc `facettes` factuel par source. Le tri par défaut est la **récence de soumission** ; le bloc `score` reste fourni pour un **tri optionnel** mais n'est plus présenté comme un verdict.
- **Epoché en atelier (carte nue).** En contexte atelier/projection, la source est présentée « à nu » (image + titre, sans attribution ni mécanismes pressentis). Le masquage est porté côté client (`SourceCard` prop `nue`), et garanti aussi côté API pour le parcours : `GET /api/parcours/:id` renvoie une carte-source nue, sans révéler le `mecanisme_attendu`.
- **Observatoire.** La propriété des médias est décrite (cartographie « qui possède quoi »), jamais notée.

## Client (`client/src/`)

SPA React 19, react-router-dom 7, pages en `lazy()`. State global zustand (`store/useAuth.ts`, `store/useUI.ts`). API via `api/client.ts`. Types dans `types/index.ts`.

### Navigation principale (refonte v3, refondue 21/06)

Le menu H1 comporte 8 entrées :

```
Accueil | Mon espace | À trier | À lire | Sujets | Activités | Apprendre | Observatoire
(+ Admin si admin)
```

Les libellés de la navigation (depuis le 27/06) :
- « **Inbox** » s'affiche « **À trier** » dans la barre de navigation (URL `/inbox` inchangée ; sous-titre `title` rappelle le terme technique).
- « **Veille** » s'affiche « **À lire** » dans la barre de navigation (URL `/veille` inchangée).

Changements par rapport à la v3 initiale :
- **Accueil** remplace Sujets en tête (pédagogique, point d'entrée).
- **Mon espace** juste après Accueil.
- **À trier (Inbox)** en H1 (le hub qualité) ; Archiver est retiré (fondu dans l'Inbox via filtres).
- **Parcours** retiré du hub Activités, vit désormais uniquement sous Apprendre (sous-nav H2).
- **Mécanismes** retiré d'Apprendre, vit désormais uniquement sous Observatoire (sous-nav H2).

Sous-navigation H2 (SUBNAV_CONFIG dans `Header.tsx`) :
- Activités : Ateliers · Dossiers · Débunkages
- Observatoire : Tableau de bord · Propriété · Couverture comparée · Fiches médias · Catalogue mécanismes
- Ateliers : Liste · Vivier
- Apprendre : Parcours · Manuel · Aide & Ressources
- Mon espace : Mon compte · Mes contributions · Mes lectures · Chaînes amies

### Socle glisser-déposer : `CorpusDnD`

`components/corpus/CorpusDnD.tsx` : composant réutilisable de composition de corpus (dnd-kit). Monté sur trois pages : Sujet, Dossier et Débunkage. La page Ateliers > Préparation garde son propre tableau dnd-kit (logique de curation animateur·ice spécifique). Parcours inverse : depuis Lire, une source peut être rangée directement dans un dossier existant.

### Routes (vocabulaire à jour)

| Route | Page | Rôle |
|---|---|---|
| `/` | -- | Redirige vers `/accueil` |
| `/accueil` | Accueil | Page pédagogique d'entrée : parcours d'une source, aide au survol, blocs repliables |
| `/sujets` | Sujets | Grille des thèmes durables (cartes) |
| `/sujets/:slug` | Sujet | Page thème : couverture + sources, glisser-déposer, section « Partager » |
| `/veille`, `/flux` | Flux | Veille collaborative de sources (substrat secondaire) |
| `/inbox` | Inbox | Hub de qualification des sources : jalons factuels, score, actions inline |
| `/lire/:id` | Lire | Reader + sidebar d'analyse (coeur) |
| `/observatoire` | Observatoire | Redirige vers `/observatoire/tableau-de-bord` |
| `/observatoire/:section` | Observatoire | Section : `tableau-de-bord`, `propriete`, `clusters`, `couverture`, `fiches`, `catalogue` |
| `/activites` | Activites | Hub des activités d'éducation populaire |
| `/debunkages[/:id]` | Debunkages, Debunkage | Activité débunkage |
| `/dossiers[/:id]` | Dossiers, Dossier | Activité dossier / décryptage à chaud |
| `/arpentages[/:id]` | Arpentages, Arpentage | Activité arpentage |
| `/parcours[/:id]` | Parcours, ParcoursSession | Cursus Apprendre : quiz de repérage (carte nue) |
| `/ateliers` | Ateliers | Liste de tous les ateliers (à venir/en cours, puis passés) + accès au vivier |
| `/ateliers/vivier` | Ateliers | Vivier de sources candidates |
| `/ateliers/:id` | Atelier | Page objet : stepper, onglets Préparation / Pilotage / Synthèse |
| `/perso[/:section]` | MonEspace | Espace personnel |
| `/apprendre[/:categorie[/:slug]]` | Mecanismes | Parcours/quiz, Manuel, Aide (sans catalogue mécanismes, déplacé sous Observatoire) |
| `/admin/:section` | AdminParametrage | Paramétrage (rôle admin) |
| `/projection/:atelierId` | Projection | Mode projection plein écran en atelier (cartes nues) |

Redirections de compatibilité : `/decrypter` vers `/observatoire`, `/becs-rouges` vers `/perso/chaines`, `/mecanismes[...]` vers `/apprendre`, `/aide` vers `/apprendre/aide`, `/admin` vers `/admin/parametrage`, `/projection` vers `/ateliers`, `/archiver`, `/archiver/:section` et `/a-archiver` vers `/inbox?manque=copie_locale`, `/ateliers/en-cours` et `/ateliers/preparation` et `/ateliers/archives` vers `/ateliers`.

## Diffusion hors appli

Route `partage.ts`, montée avant le fallback SPA :
- **Pages publiques OpenGraph** : `GET /partage/debunkage/:id`, `GET /partage/dossier/:id`, `GET /partage/sujet/:slug`. Pages HTML autoportantes (CSS inline), balises OpenGraph + `twitter:card`. Rendues uniquement si l'objet est publié. Ajouter une exception sans auth sur `/partage/` dans l'hôte NPM pour les rouvrir sans SSO.
- **Exports YesWiki** : `GET /api/debunkages/:id/yeswiki`, `GET /api/dossiers/:id/yeswiki`, `GET /api/sujets/:idOrSlug/yeswiki` (lib `yeswiki.ts`).

## Modules fonctionnels (rappel produit)

1. Accueil pédagogique : point d'entrée, explique le parcours d'une source.
2. Inbox-hub de qualification : tunnel à la carte, jalons factuels, score 0-100.
3. Sujets : thèmes durables, objet pivot éditorial.
4. Veille collaborative (substrat), URL-first, archivage anti-linkrot.
5. Lecture et analyse (Lire), reader + sidebar interactive.
6. Activités d'éducation populaire sur socle commun : atelier, dossier, décryptage, débunkage, parcours, arpentage.
7. Observatoire : référence critique des médias (propriété, couverture comparée, fiches, mécanismes).
8. Diffusion hors appli (pages publiques OpenGraph + exports YesWiki).

## Déploiement

Conteneur Docker sur l'infra PIAF (serveur Bomp4rd), `alasource.rouge-coquelicot.fr`, derrière Authentik forward-auth (via NPM), port interne 3033. En production, le serveur Express sert le build React (`client/dist`). Voir `docs/deploiement.md`.
