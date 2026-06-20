# Architecture — À la source v3

> Documentation canonique de l'architecture, à jour de ce qui est réellement codé.
> Dernière mise à jour : 2026-06-07.

## Vue d'ensemble

Monorepo npm workspaces (`server/`, `client/`). Outil web d'éducation populaire aux médias de Rouge Coquelicot. Déployé en conteneur Docker sur l'infra PIAF (serveur Bomp4rd), derrière Authentik forward-auth.

**Refonte v3, par sujets.** L'entrée du produit est désormais le **Sujet** (thème durable, ex. lithium en Alsace), pas le flux de liens. La page d'accueil est `/sujets` ; la veille collaborative (ex `/flux`, renommée « Veille ») devient un **substrat secondaire** qui alimente les sujets et les activités. Autour des données communes (sources, événements, médias, mécanismes, sujets), une famille d'**activités** d'éducation populaire (atelier, dossier, décryptage, débunkage, parcours, arpentage) se branche, chacune posée comme un pipeline-outil sur ce socle.

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
| `/api/ateliers` | ateliers.ts | pipeline atelier (vivier, préparation, en-cours, synthèse, impression). **A1 terminée** : lit/écrit exclusivement depuis `activites` + `atelier_pipeline` + `activite_sources` + `activite_mecanismes` ; forme d'API inchangée ; tables `ateliers*` legacy conservées en filet **non lu**. `GET /vivier` expose un bloc `facettes` factuel (cf. doctrine « décrire, ne pas noter ») et trie par récence de soumission par défaut, plus par le score |
| `/api/sujets` | sujets.ts | sujets (thèmes durables, refonte par sujets) : CRUD, publication, rattachement sources/événements |
| `/api/debunkages` | debunkages.ts | activité débunkage (adhérent) : démonstration, sources pour/contre, liens de posts réseaux, publier |
| `/api/parcours` | parcours.ts | cursus Apprendre : parcours/quiz de repérage des mécanismes, sessions, score |
| `/api/dossiers` | dossiers.ts | activité dossier (et décryptage à chaud = flag `a_chaud` + événement) : contenu, mise en perspective, sources |
| `/api/arpentages` | arpentage.ts | activité arpentage : fragments d'un document, attribution, restitutions, synthèse |
| `/partage/{debunkage,dossier}/:id`, `/partage/sujet/:slug` | partage.ts | **pages HTML publiques** (sans login) des débunks, dossiers/décryptages et thèmes publiés, avec OpenGraph (unfurl Discord). Pour les rouvrir sans SSO : exception sans auth sur `/partage/` dans l'hôte NPM |
| `/api/{debunkages,dossiers}/:id/yeswiki`, `/api/sujets/:idOrSlug/yeswiki` | (resp. routes) | export en syntaxe YesWiki (lib `yeswiki.ts`) |
| `/api/auth` | auth.ts | authentification (rôles membre/animateur/admin) |
| `/api/mecanismes` | mecanismes.ts | 25 mécanismes de référence (fiches pédagogiques) |
| `/api/contenus` | contenus.ts | pages éditables (clé/valeur) |
| `/api/parametres` | parametres.ts | paramètres admin (courbes de fraîcheur, poids scores, formule confiance) |
| `/api/recherche` | recherche.ts | recherche plein texte |
| `/api/becs-rouges` | becsrouges.ts | suivi de chaînes/médias (intégré à l'espace perso) |

### Bibliothèques (`server/src/lib/`)

- `db.ts` : connexion better-sqlite3.
- `auth.ts` : middleware d'authentification (Authentik forward-auth : lit `X-authentik-username` / `X-authentik-groups`, repli `Remote-User` puis `?_user=` en dev ; rôle dérivé des groupes, élevable en base).
- `readability.ts` + `opengraph.ts` : extraction d'articles (Mozilla Readability, OpenGraph).
- `ftr-site-config.ts` : règles FullTextRSS par site (65 sites configurés).
- `score.ts` : calcul du score atelier (écho/pédagogie/fraîcheur/timing) et de la confiance média.

### Base de données (`server/src/db/`)

`schema.sql` définit les tables ; des scripts `migrate-*.ts` appliquent les évolutions (phases 1-3, mécanismes v2, ateliers v2, archives v2) ; des `seed-*.ts` peuplent (médias, descriptions médias, évaluations d'ateliers).

Tables principales : `utilisateurs`, `medias`, `auteurs`, `sources`, `archives`, `tags` + `source_tags`, `mecanismes_reference` + `source_mecanismes`, `evaluations`, `commentaires`, `lectures`, `ateliers` + `atelier_sources` + `atelier_mecanismes`, `contenus`, `parametres`, `mots_cles`.

Refonte v3 (par sujets), tables additives (auto-migrate au boot, idempotent) :
- `sujets` + `sujet_sources` + `sujet_evenements` : le Sujet, thème durable, objet pivot éditorial (création membre, publication animateur). Seed : lithium en Alsace + 7 dossiers locaux Becs Rouges.

#### Socle commun des activités : `activites`

`migrate-activites.ts` pose la colonne vertébrale de l'éducation populaire : une table **unique** `activites` (socle commun) + une **extension par type**. Schéma réel :

- `activites` : `id`, `type` (CHECK : `atelier` / `dossier` / `decryptage` / `debunkage` / `parcours` / `arpentage`), `sujet_id` (rattachement au thème), `titre`, `statut` (défaut `brouillon`), `anime_par`, `cree_par`, `legacy_atelier_id` (trace du backfill), `cree_le`, `maj_le`. Index sur `type` et `sujet_id`.
- `activite_sources` : corpus de l'activité (`activite_id`, `source_id`, `ordre`, `note`, PK composite). Le rôle pour/contre est porté côté débunkage.
- `activite_mecanismes` : mécanismes de synthèse rattachés à l'activité (`activite_id`, `mecanisme_id`).
- Extensions par type : `atelier_pipeline` (logistique + déroulé : `numero`, `date_atelier`, `heure`, `lieu`, `facilitateur_id`, `source_choisie_id`, `nb_participants`, `compte_rendu`, `observations`, `observations_surprise`, `questions_restantes`, `mecanisme_identifie`), `debunkage_pipeline` + `debunkage_posts`, `dossier_contenu` (dossier + décryptage à chaud, flag `a_chaud` + `evenement_id`), `arpentage_pipeline` + `arpentage_fragments` + `arpentage_restitutions`.

**Types branchés sur `activites` aujourd'hui : atelier, débunkage, dossier (et décryptage = dossier `a_chaud=1`), arpentage.** Le **parcours** est listé dans le CHECK mais vit en tables propres (`parcours` + `parcours_questions` + `parcours_sessions` + `parcours_reponses`), structurellement distinct (cursus/quiz, pas un pipeline éditorial). Parcours « Découverte des mécanismes » auto-généré depuis `source_mecanismes`.

#### Bascule A1 (terminée)

La bascule de l'atelier sur le socle est **terminée**. `routes/ateliers.ts` lit et écrit **exclusivement** depuis `activites` (identité + statut), `atelier_pipeline` (logistique + déroulé), `activite_sources` (corpus) et `activite_mecanismes` (synthèse) ; l'`id` atelier = `activites.id`. Le backfill des ateliers existants (et de leurs mécanismes de synthèse) est non destructif et idempotent (tracé par `legacy_atelier_id`).

Les tables **legacy** `ateliers` / `atelier_sources` / `atelier_mecanismes` sont **conservées en filet** mais ne sont **plus lues par aucun code applicatif** (vérifié : la requête `migrate-activites.ts` y accède uniquement pour le backfill ; aucune route ni lib ni le bot Discord ne les interroge). Le compteur `nb_ateliers` et le bot Discord lisent désormais `activites`. Suppression du filet possible plus tard, une fois la confiance établie.

#### Autres tables additives

- `sources.completude` : `libre` / `partiel` / `integral_offline` (intégralité consultée hors-ligne, ex. Europresse/BnF, sans copie du texte).
- Migrations : `migrate-sujets.ts`, `migrate-activites.ts`, `migrate-debunkage.ts`, `migrate-parcours.ts`, `migrate-dossiers.ts`, `migrate-arpentage.ts`, `migrate-evenements.ts` ; seed `seed-sujets.ts`. Toutes appliquées au boot par `auto-migrate.ts`.

Table `medias` : `id, nom, type, url_site, description` + propriété structurée (Chantier A) `proprietaire, actionnaire_ultime, type_propriete, financement, annee_creation, ligne_revendiquee`. La propriété est désormais requêtable (cartographie « qui possède quoi »), plus seulement en texte libre. Migration `migrate-medias-propriete.ts`, données `seed-medias-propriete.ts` (à valider sur la carte Acrimed). Édition via `PUT /api/medias/:id/propriete`. Affichage dans la fiche média de l'Observatoire (`FichesMedias`). Principe : on décrit la propriété, on ne note pas le média. Cf. note vault `2026-06-05 — Refonte Observatoire et propriété des médias`.

### Inbox à qualifier (ingestion Discord)

`sources.a_qualifier` (flag) marque les sources entrantes en attente de tri. API `GET /api/sources/inbox`, `POST /api/sources/:id/qualifier` (→ veille/vivier), `POST /api/sources/:id/rejeter` (→ archive, non destructif : la source sort de l'inbox et passe en `archive`). Page client `/inbox`, plus un lien discret « Inbox à qualifier (N) » en tête de la Veille. La veille autonome (dépôt `from-url`) peut elle aussi déposer en Inbox (`a_qualifier`) et porter une `completude`.

### Intégration Discord

`server/src/discord/bot.ts` + `server/src/discord/client.ts` (discord.js 14). Tout message entrant repéré dans un canal surveillé crée une **source en Inbox** (`origine='discord'`, `a_qualifier=1`), à qualifier ensuite dans l'appli (anti-doublon).

**Gated sur le token.** `startDiscordBot()` est lancé après le boot du serveur, mais uniquement si `getDiscordConfig()` renvoie une config avec un `token` (variable `DISCORD_TOKEN` ou paramètre BDD `discord`). Sans token, le bot logge « Discord non configuré, ingestion inactive » et ne fait rien. L'appel est entièrement try/catché : un échec Discord ne casse jamais le démarrage. Activation : `DISCORD_TOKEN` + (`DISCORD_CHANNEL_VEILLE` et/ou `DISCORD_GUILD_IDS`).

### Doctrine « décrire, ne pas noter » et epoché

Principe transverse du produit : on décrit les sources et les médias par des **faits**, on ne les note pas par un score-verdict.

- **Au vivier (07/06).** `GET /api/ateliers/vivier` expose un bloc `facettes` factuel par source (`nbEvaluations`, `archiveStatut`, `completude`, `datePublication`, `nbMecanismes`, `fraicheur`). Le tri par défaut est la **récence de soumission** ; le bloc `score` reste fourni pour un **tri optionnel** et la rétrocompatibilité, mais n'est plus présenté comme un verdict. Côté Observatoire, la propriété des médias est décrite (cartographie « qui possède quoi »), pas notée.
- **Epoché en atelier (carte nue).** En contexte atelier/projection, la source est présentée « à nu » (image + titre, sans attribution ni mécanismes pressentis, pour ne pas biaiser le groupe). Le masquage est porté côté client (`SourceCard` prop `nue`), et **garanti aussi côté API** pour le parcours : `GET /api/parcours/:id` renvoie une carte-source nue, **sans** révéler le `mecanisme_attendu` ni l'explication, le bon mécanisme étant noyé dans la liste complète des mécanismes proposés.

## Client (`client/src/`)

SPA React 19, react-router-dom 7, pages en `lazy()`. State global zustand (`store/useAuth.ts`, `store/useUI.ts`). API via `api/client.ts`. Types dans `types/index.ts`.

### Navigation principale (refonte v3)

Le menu de tête comporte 8 entrées, **Sujets en premier**, la Veille reléguée en substrat :

```
Sujets | Activités | Veille | Observatoire | Archiver | Apprendre | Mon espace | [Admin]
```

### Routes (vocabulaire à jour)

| Route | Page | Rôle |
|---|---|---|
| `/sujets` | Sujets | accueil (refonte v3) : grille de thèmes (cartes) ; `/` redirige ici |
| `/sujets/:slug` | Sujet | page thème : couverture (événements) + sources, rattachement par glisser-déposer ; section « Partager » |
| `/veille`, `/flux` | Flux | veille collaborative de sources (substrat secondaire) ; lien « Inbox à qualifier (N) » |
| `/inbox` | Inbox | Inbox à qualifier (sources entrantes, dont Discord) : Qualifier / Rejeter |
| `/activites` | Activites | hub : toutes les activités d'éducation populaire (atelier, dossier, décryptage, débunkage, parcours, arpentage) + « Créer une activité » |
| `/debunkages[/:id]` | Debunkages, Debunkage | activité débunkage, liens de posts réseaux, section « Partager » |
| `/dossiers[/:id]` | Dossiers, Dossier | activité dossier / décryptage à chaud, section « Partager » |
| `/arpentages[/:id]` | Arpentages, Arpentage | activité arpentage (lecture collective fragmentée) |
| `/parcours[/:id]` | Parcours, ParcoursSession | cursus Apprendre : quiz de repérage des mécanismes (carte nue) |
| `/lire/:id` | Lire | reader + sidebar d'analyse (cœur) |
| `/observatoire[/:section]` | Observatoire | visualisations : mécanismes, médias, fiches médias, couverture, sources |
| `/ateliers[/:section]` | Ateliers | pipeline atelier : vivier, préparation, en cours, archives |
| `/archiver[/:section]` | Archiver | archivage collaboratif |
| `/perso[/:section]` | MonEspace | espace personnel (dont chaînes suivies, ex Becs Rouges) |
| `/apprendre[/:categorie[/:slug]]` | Mecanismes | fiches des 25 mécanismes + manuel + aide |
| `/admin/:section` | AdminParametrage | paramétrage (rôle admin) |
| `/projection/:atelierId` | Projection | mode projection plein écran en atelier (cartes nues) |

Redirections de compatibilité : `/`→`/sujets`, `/decrypter`→`/observatoire`, `/becs-rouges`→`/perso/chaines`, `/mecanismes[...]`→`/apprendre`, `/aide`→`/apprendre/aide`, `/admin`→`/admin/parametrage`, `/projection`→`/ateliers/en-cours`. `/veille` et `/flux` rendent tous deux la page Flux.

## Diffusion hors appli

Deux canaux pour partager le contenu publié sans connexion à l'appli (route `partage.ts`, montée avant le fallback SPA) :

- **Pages publiques OpenGraph** : `GET /partage/debunkage/:id`, `GET /partage/dossier/:id`, `GET /partage/sujet/:slug`. Pages HTML autoportantes (CSS inline, aucune dépendance React), balises OpenGraph + `twitter:card` (titre, description, url, image de la 1re source) pour l'unfurl Discord. Rendues seulement si l'objet est publié, sinon page « non disponible ». **Pour les rouvrir sans SSO : ajouter une exception sans auth sur `/partage/` dans l'hôte NPM** (équivalent des `skipped_uris` de l'ancien SSO), sans quoi Authentik intercepte la requête.
- **Exports YesWiki** : `GET /api/debunkages/:id/yeswiki`, `GET /api/dossiers/:id/yeswiki`, `GET /api/sujets/:idOrSlug/yeswiki` (lib `yeswiki.ts`). Conversion en syntaxe YesWiki à coller dans becs-rouges.fr / rouge-coquelicot.fr.

## Modules fonctionnels (rappel produit)

1. Sujets (refonte v3) : thèmes durables, objet pivot éditorial, couverture multisource, publication.
2. Veille collaborative (substrat), URL-first avec auto-fetch et archivage anti-linkrot ; Inbox à qualifier (dont Discord).
3. Lecture et analyse (Lire), reader + sidebar interactive.
4. Activités d'éducation populaire sur socle commun : atelier, dossier, décryptage, débunkage, parcours, arpentage.
5. Identification des mécanismes (25 mécanismes de référence, fiches dans Apprendre).
6. Observatoire (matrice média x mécanisme, confiance, fiches et propriété des médias).
7. Diffusion hors appli (pages publiques OpenGraph + exports YesWiki).

## Déploiement

Conteneur Docker sur l'infra PIAF (serveur Bomp4rd), `alasource.barjot.net`, derrière Authentik forward-auth (via NPM), port interne 3033. En production, le serveur Express sert le build React (`client/dist`). Voir `docs/deploiement.md`.
