# Changelog — À la source

Doc vivante des évolutions notables. À jour de ce qui est réellement fait.

## 2026-06-20 — Déploiement PIAF (Docker + Authentik) et espace personnel

Mise en production sur l'infra PIAF (serveur Bomp4rd), sur le modèle de Prisme, et premier bloc de finition « espace perso ».

- **Conteneurisation** : `Dockerfile` multi-étapes (Node 22, build des deux workspaces, runtime servant l'API + le build client sur le port 3033), `.dockerignore`, compose de référence dans `deploy/`. Conteneur `a-la-source` sur le réseau Docker `web`, base montée en lecture-écriture (`A_LA_SOURCE_DB=/data/a-la-source.db`), volumes `uploads/` et `image-cache/`.
- **Authentification Authentik forward-auth** : `server/src/lib/auth.ts` lit désormais `X-authentik-username` / `X-authentik-groups` (repli `Remote-User`, puis `?_user=` en dev). Rôle dérivé des groupes (`admins`/`sso-admins`/`rc-admins` → admin, sinon membre), le rôle en base pouvant l'élever (animateur). Cf `docs/acces-identite.md`.
- **Cible** : `alasource.barjot.net` (brand PIAF) derrière Authentik, hôte NPM managé, cert `*.barjot.net`. Bascule `rouge-coquelicot.fr` ultérieure.
- **Espace personnel** : nouvelles sections « Mon compte » (identité SSO, rôle, **pseudo Discord** éditable) et « Mes contributions » (sources proposées, évaluations, mécanismes, commentaires, activités créées ou animées, sujets créés). API `GET /api/auth/me` enrichi (email, pseudo Discord), `POST /api/auth/profil`, `GET /api/auth/contributions`.
- **Identité Discord** : colonnes `utilisateurs.discord_pseudo` et `discord_id` (auto-migration). Le bot d'ingestion rapproche désormais l'auteur Discord d'un compte membre (par `discord_id`, sinon `discord_pseudo` qu'il mémorise) et **crédite la source** au bon membre (`sources.soumis_par`) au lieu de la laisser anonyme.
- **Notifications App→Discord (webhook)** : nouveau `server/src/discord/notify.ts`. À la publication d'un **sujet**, **dossier/décryptage** ou **débunkage**, un message est posté dans le salon dédié (webhook `DISCORD_WEBHOOK_URL`, sans bot). Garde anti-doublon (seule la transition vers `publie` notifie). Le **bot** (token) reste requis pour le sens entrant (ingestion + commandes).
- **Correctifs post-déploiement** : PWA durcie (`cleanupOutdatedCaches`, `clientsClaim`, `skipWaiting`, rechargement auto sur chunk périmé via `vite:preloadError`) pour ne plus rester bloqué sur « Chargement » après un redéploiement ; **`navigateFallbackDenylist`** sur `/uploads /api /images /partage` (sinon l'iframe d'un PDF recevait la SPA au lieu du fichier) ; nav : liens **visités** remis en blanc (la règle globale `a:visited` bordeaux repeignait Sujets/Mon espace en rouge sur noir). Veille : **filtre « commentées / non commentées »** (l'inbox partagée), backend `?commentees=oui|non`.
- **Bot Discord — consultation et manuel** : `!source <id>` / `!fiche <id>` renvoient une fiche (commentaires avec id, débunkages liés, présence de texte) ; `!texte <id>` envoie le **texte intégral** découpé en blocs (≤1800 c, plafonné à 8 messages + lien app) ; `!editcom <id> <texte>` modifie un commentaire (auteur ou admin) ; `!aide`/`!manuel`/`!guide` renvoient le manuel. Chaque réponse de commande invite à « faire encore mieux dans l'app ». Les commentaires créés via le bot sont attribués au membre rapproché.
- **Ingestion Discord v2** (`server/src/discord/ingestion.ts`, table `discord_messages`) : le bot **répond** avec le lien vers l'article dans l'app ; **PDF joint** → copie intégrale hors-ligne (`integral_offline`) **lisible dans l'app** ; **.ris joint** → métadonnées (titre, média, date, résumé) ; **texte** en plus du lien → commentaire ; **éditions** et **réponses** Discord rattachées à la bonne source (mapping message↔source) ; **version sans paywall** ajoutée par édition = lien alternatif (pas un doublon) ; **commandes** `!aide`/`!vivier`/`!atelier`/`!analyser`… branchées ; dédup par URL et par message. Correctif : `PdfReader` (double préfixe `uploads/` qui empêchait l'affichage). Attribution par handle, nom global ou surnom de serveur (insensible à la casse).

## 2026-06-07 — Une seule base : chemin centralisé + schema.sql v3

Fin de l'ambiguïté « deux bases ». La base est canonique et unique : celle d'OneDrive (`00_PERSO/A la source/a-la-source.db`). Le code vit dans le repo git ; la donnée dans OneDrive.

- **Copie figée supprimée** : `db/a-la-source.db` (vestige du 05/06, suivi par git, 18 Mo) retirée du dépôt ; `db/*.db` ajouté au `.gitignore`. La structure `db/image-cache/` est préservée via un `.gitkeep`.
- **Résolution unique du chemin** : nouveau `server/src/db/dbPath.ts` (exporte `DB_PATH`, détection plateforme PRO/PERSO, surcharges `ONEDRIVE_ROOT` / `A_LA_SOURCE_DB`). `lib/db.ts` et les scripts seed s'y réfèrent désormais, pour qu'aucune base divergente ne puisse renaître dans le repo.
- **Seeds rebranchés et idempotents** : `seed.ts` (init-db), `seed-medias.ts`, `seed-ateliers-evals.ts` visent la base canonique. `seed.ts` passe ses `contenus` en `INSERT OR IGNORE` (ne jamais écraser un contenu édité) : il est relançable sans risque.
- **`schema.sql` régénéré en v3** depuis la base réelle (44 tables, FTS, index), idempotent (`IF NOT EXISTS`). L'ancien `schema.sql` était resté en v2. Au runtime, `auto-migrate.ts` applique en plus les évolutions additives à chaque boot.
- Les migrations historiques one-off (`migrate-phase*`, `migrate-v1`, `migrate-mecanismes*`, `migrate-ateliers-v2`) restent des artefacts inertes (déjà appliqués) et ne sont pas rebranchées, pour ne pas risquer de rejouer une vieille migration sur la base unique.

## 2026-06-07 — Méthode de sélection des sources : le profil de diversité du corpus

On « refait la notation » de la sélection d'atelier sans réintroduire de verdict. La qualité d'un atelier est une **propriété d'ensemble** (diversité, contraste), pas une somme de notes de sources. On décrit le **corpus**, on ne note pas les sources. Note de conception dans le vault (« À la source — Conception — Méthode de sélection des sources »).

- **`server/src/lib/diversite.ts`** (nouveau). `profilDiversiteCorpus(sourceIds)` : fonction pure (lecture seule) qui décrit un corpus par axes factuels (médias, type de propriété, type de source, sujets, mécanismes) + profil de durée (zone atelier 5-10 min) + complétude agrégée + **alertes douces** (observations, jamais des fautes). `suggestionsDiversite(corpusIds)` : propose des cartes du vivier comblant un axe faible (valeur absente du corpus), sans rien imposer. Cibles paramétrables (table `parametres`, clé `diversite_cibles`).
- **`GET /api/ateliers/:id/diversite`** (+ `?suggestions=1`) : renvoie le profil du corpus de l'atelier et, en option, les suggestions de complément. Aucun effet de bord.
- **Préparation (`Ateliers.tsx`)** : panneau « Profil du corpus » au-dessus du tableau 2 colonnes. Jauges sobres par axe (nb de valeurs distinctes vs cible indicative), alertes douces, complétude « N/M prêtes à projeter », et suggestions de diversification (cartes à retenir). Recalcul à chaque ajout/retrait. Aucun gros nombre-verdict. Tokens de thème (dark-safe).
- **`lib/score.ts` conservé** (tri optionnel + rétrocompat), non supprimé, mais relégué : la sélection passe désormais par le profil de diversité. Aucun signal d'écho social (lectures, commentaires, viralité) n'entre dans la sélection (respect anticipé de l'epoché). Le panneau est un outil de coulisse animateur : il ne fuite jamais vers la projection (carte nue inchangée).
- Typecheck client + serveur OK.

## 2026-06-07 — Vivier : « décrire, ne pas noter » (facettes au lieu du score-verdict)

Le vivier rejoint la doctrine de l'Observatoire et de l'atelier : on décrit les sources par des **faits**, on ne les note pas par un score-verdict.

- **API `/ateliers/vivier`** : ajout d'un bloc `facettes` factuel par source (`nbEvaluations`, `archiveStatut`, `completude`, `datePublication`, `nbMecanismes`, `fraicheur`). Tri par défaut = **récence de soumission** (`ORDER BY soumis_le DESC`), plus le score. Le bloc `score` reste fourni pour un **tri optionnel** et la rétrocompatibilité, il n'est plus présenté.
- **`SourceCard`** : nouvelle prop `facettes`. En contexte vivier, l'overlay du gros score-verdict est remplacé par une **facette discrète** (fraîcheur, ancienneté relative) ; badges factuels en pied (nombre d'évaluations, nombre de mécanismes pressentis). La carte nue d'atelier (epoché) est inchangée.
- **Vivier (`Ateliers.tsx`)** : le filtre « score min » disparaît au profit d'un **sélecteur de tri** (Récence / Fraîcheur / Score optionnel). La checklist « prêtes pour atelier » (évaluée + archivée + accroche) est conservée : c'est une **complétude factuelle**, pas un score. Même traitement dans le tableau de préparation 2 colonnes (carte de prépa : fraîcheur, plus le score).
- Garde-fous tenus : zéro texte rouge sur fond sombre (vérifié, 43/43 cartes), CSS en tokens de thème (dark-safe), typecheck client + serveur OK.

## 2026-06-06 — Lisibilité sombre + Chantier N (pages Sujets)

- **Correctif lisibilité (important).** Les titres de cartes (qui sont des liens) s'affichaient en **rouge sur fond sombre** en mode sombre, à cause de la règle globale `.dark a` qui peint tous les liens en rouge. Garde-fou posé : les **liens structurels** (titres de cartes, cartes-liens) prennent la couleur de texte normale en sombre ; le rouge reste pour les vrais liens de prose. Vérifié : zéro texte rouge sur fond sombre sur toute la page.
- **Chantier N (refonte par sujets, frontend).** Page d'accueil **Sujets** (grille de cartes-thèmes depuis `/api/sujets`), page **Sujet** (détail : couverture + sources). Navigation : « Sujets » en tête, « Flux » renommé « Veille ». Routes : `/` redirige vers `/sujets`. CSS en tokens de thème (lisible clair et sombre par construction).

## 2026-06-06 — A1 : bascule de l'atelier sur le socle `activites`

L'atelier rejoint le modèle commun. **Forme d'API inchangée**, le client ne bouge pas.

- `routes/ateliers.ts` lit et écrit désormais depuis `activites` (type='atelier', identité + statut), `atelier_pipeline` (logistique + déroulé), `activite_sources` (corpus, suppression dure) et `activite_mecanismes` (mécanismes de synthèse). L'id atelier = `activites.id`.
- Table `activite_mecanismes` ajoutée (+ backfill depuis `atelier_mecanismes`). Création, ajout/retrait de sources, réordonnancement, synthèse, transitions de statut, détail, vivier, en-cours, impression : tous rebranchés et vérifiés de bout en bout (création n°3, source, synthèse, statut, relecture).
- Tables legacy `ateliers` / `atelier_sources` / `atelier_mecanismes` **conservées en filet** (non lues), suppression possible plus tard une fois la confiance établie. Sauvegarde de la base prise avant bascule.

## 2026-06-06 — « Créer une activité » sur le hub + diffusion publique étendue

- **« Créer une activité »** : section en tête du hub `/activites` avec les 6 formats (atelier, dossier, décryptage à chaud, débunkage, parcours, arpentage), chacun décrit et menant à sa page de création. Point d'entrée unifié.
- **Diffusion publique + YesWiki étendue** aux **dossiers/décryptages** et aux **thèmes** (sur le modèle du débunk) : pages publiques `GET /partage/dossier/:id` et `GET /partage/sujet/:slug` (OpenGraph pour l'unfurl Discord, rendues si publiées), exports `GET /api/dossiers/:id/yeswiki` et `GET /api/sujets/:idOrSlug/yeswiki`, et section « Partager » dans les pages Dossier et Sujet.

## 2026-06-06 — Ingestion Discord vers une Inbox à qualifier

- **Inbox à qualifier** : colonne `sources.a_qualifier`. API `GET /sources/inbox`, `POST /sources/:id/qualifier` (→ veille/vivier), `POST /sources/:id/rejeter` (→ archive, non destructif). Page `/inbox` (cartes + Qualifier/Rejeter) et lien discret « Inbox à qualifier (N) » en tête de la Veille.
- **Watcher Discord** (`discord/client.ts`, discord.js 14) : `startDiscordBot()` lancé après le boot, **gated** sur `getDiscordConfig()` et entièrement try/catché (ne casse jamais le démarrage ; sans token : « Discord non configuré, ingestion inactive »). Sur message dans les canaux surveillés, détecte les URLs d'articles et crée une source en inbox (`origine='discord'`, `a_qualifier=1`), anti-doublon.
- **Activation** : définir `DISCORD_TOKEN` + `DISCORD_CHANNEL_VEILLE` et/ou `DISCORD_GUILD_IDS` (env ou paramètre BDD `discord`).

## 2026-06-06 — Arpentage, complétude des sources, consolidation nav, refonte « Atelier en cours »

- **Activité Arpentage** (lecture collective fragmentée) : tables `arpentage_pipeline` + `arpentage_fragments` + `arpentage_restitutions`, API `/api/arpentages`. Pages : découpage d'un document en fragments, attribution aux participant·es, restitutions par fragment, synthèse. Ajoutée au hub Activités.
- **Marqueur de complétude des sources** : colonne `sources.completude` (`libre` / `partiel` / `integral_offline`). Badge discret sur la carte (masqué en carte nue d'atelier, epoché), sélecteur dans le panneau métadonnées. Sécurise la veille (texte intégral en accès libre vs partiel vs consulté hors-ligne type Europresse/BnF).
- **Consolidation de la navigation** : menu principal ramené de 10 à 8 entrées (Ateliers et Débunkages retirés du haut, accessibles via le hub Activités + une sous-nav `/activites`).
- **Refonte « Atelier en cours »** : table de pilotage sur un écran (carte d'identité, transitions de statut prêt→en cours→terminé, gros bouton Projection, corpus en cartes nues, synthèse compacte branchée sur `/synthese`).

## 2026-06-06 — Diffusion d'un débunk hors appli (page publique + YesWiki)

Partager un débunkage publié sans se connecter à l'appli.

- **Page HTML publique** `GET /partage/debunkage/:id` (route `partage.ts`, montée avant le fallback SPA) : page autoportante, CSS inline, balises **OpenGraph** (titre, description, url, image de la 1re source) + `twitter:card`, pour que **Discord affiche une carte**. Rendue seulement si le débunk est publié, sinon page « non disponible ». Au déploiement YunoHost, déclarer `/partage/` en accès public (skipped_uris).
- **Export YesWiki** `GET /api/debunkages/:id/yeswiki` (lib `yeswiki.ts`) : conversion en syntaxe YesWiki (titres, gras, listes, liens) à coller dans becs-rouges.fr / rouge-coquelicot.fr.
- **Section « Partager »** dans la page débunkage : lien public (copier / ouvrir) + bouton « Exporter en YesWiki ».

## 2026-06-06 — Dossier/décryptage, hub Activités, accueil vivant, polish

- **Activité Dossier (+ mode Décryptage à chaud).** Table `dossier_contenu` (mise en perspective, contenu, flag `a_chaud`, lien événement). API `/api/dossiers`. Le décryptage est un dossier `a_chaud=1` rattaché à un événement, pas un type distinct. Pages liste (filtre fond / à chaud) et édition (sources en cartes).
- **Hub Activités** (`/activites`) : la vitrine d'éducation populaire, qui réunit Ateliers, Dossiers & décryptages, Débunkages, Parcours avec compteurs. Entrée de nav « Activités ».
- **Accueil « mix vivant »** (`/sujets`) : intro éduc pop, une « décryptage à chaud », activité récente (débunkages + ateliers), puis la grille de thèmes. Robuste aux API vides.
- **Polish** : convention slider doublé d'une saisie numérique liée (vivier, évaluation écho/pédagogie). Lisibilité sombre vérifiée sur toutes les nouvelles pages (0 texte rouge sur fond sombre).

## 2026-06-06 — Préparation atelier en glisser-déposer + cursus Parcours/quiz

- **Préparation atelier refondue.** Tableau 2 colonnes glisser-déposer : vivier (cartes avec score, contexte animateur) à gauche, corpus de l'atelier à droite, cartes promenées et réordonnables (poignée), zone de dépôt en surbrillance, fallbacks boutons conservés. Plus de grand écran à scroller. Sur l'API atelier existante (pas de cutover destructif).
- **Cursus Apprendre : Parcours / quiz.** Tables `parcours*`, API `/api/parcours` (liste, session, réponses notées, score). Un parcours « Découverte des mécanismes » est auto-généré à partir des analyses réelles (`source_mecanismes`). Page de jeu : carte-source nue (aucun indice, anti-biais), question « Quel mécanisme est à l'œuvre ? », feedback + explication, score. Accessible depuis Apprendre.
- Nettoyage : règles CSS de l'ancienne préparation retirées.

## 2026-06-06 — Débunkage, attribution visible, glisser-déposer (3 chantiers)

Trois chantiers menés en parallèle.

- **Activité Débunkage.** Un adhérent démonte une infox sur un thème ; la sortie est un post réseau social, dont on consigne les liens. Tables `debunkage_pipeline`, `debunkage_posts`, colonne `activite_sources.role` (pour/contre). API `/api/debunkages` (CRUD, posts, sources pour/contre, publier). Pages Débunkages (liste) et Débunkage (affirmation, démonstration, sources en cartes, liens de posts). Nav « Débunkages ».
- **Attribution visible (Chantier U).** « proposé par X » sur les cartes-sources (hors carte nue d'atelier, pour préserver l'epoché), « par X » sur les commentaires. Les requêtes joignent les noms.
- **Glisser-déposer (dnd-kit).** On promène une carte-source candidate et on la dépose sur le sujet pour la rattacher (DragOverlay, zone de dépôt en surbrillance) ; le bouton « + Rattacher » reste en fallback.
- Lisibilité : titres de cartes neutralisés en sombre partout (jamais de rouge sur fond sombre, vérifié).

## 2026-06-06 — Apprendre vivant : exemples réels dans les fiches mécanismes

La documentation s'auto-alimente : chaque fiche de mécanisme affiche désormais les **exemples réels** tirés des analyses (sources où ce mécanisme a été identifié), en cartes, avec l'extrait, le média et le contributeur. La section grandit à chaque identification.

- `GET /api/mecanismes/fiche/:slug` renvoie un champ `exemples` (jointure `source_mecanismes` + sources + médias + utilisateurs, 12 derniers).
- Page Apprendre : section « Exemples repérés » en cartes, titres en couleur de texte (lisibles clair et sombre).

## 2026-06-06 — Page Sujet : couverture + rattachement de la veille

- **Couverture (geste GroundNews).** `/api/sujets/:id` renvoie, par événement, le nombre de médias et la diversité de propriété. La page Sujet affiche cet indicateur par événement.
- **Rattacher la veille au sujet.** Panneau « Ajouter des sources » : on rattache (et détache) des cartes-sources de la veille au sujet (`POST`/`DELETE /api/sujets/:id/sources`). Donne vie aux thèmes. Le glisser-déposer (dnd-kit, « promener la carte ») reste le raffinement UX prévu.

## 2026-06-06 — Chantier A (socle) : table activites + backfill des ateliers

Colonne vertébrale des activités d'éducation populaire, **additive et non destructive**.

- **Tables `activites` (socle), `activite_sources`, `atelier_pipeline` (extension).** Une activité (atelier, dossier, décryptage, débunkage, parcours, arpentage) est un pipeline-outil posé sur les données communes.
- **Backfill** des ateliers existants dans `activites` (+ `atelier_pipeline` + `activite_sources`), tracé par `legacy_atelier_id` (idempotent). Les tables `ateliers*` et les routes actuelles sont **intactes** : la bascule des lectures viendra plus tard, une fois ce socle éprouvé. Sauvegarde de la base faite avant migration.
- Migration auto au boot (`auto-migrate.ts`) + standalone (`migrate-activites.ts`).

## 2026-06-06 — Chantier S : socle des Sujets

Première brique de code de la refonte par sujets (additive, sans risque).

- **Tables `sujets`, `sujet_sources`, `sujet_evenements`.** Le Sujet est l'objet pivot éditorial (thème durable) qui agrège veille (sources) et couverture (événements). Distinct de l'événement (fait ponctuel). Gouvernance : tout membre propose (`statut='propose'`), un·e animateur·ice publie (`statut='publie'`, `valide_par`).
  - Migration auto au boot (`auto-migrate.ts`) + standalone (`migrate-sujets.ts`).
  - Seed `seed-sujets.ts` : 8 thèmes amorces (lithium en Alsace + 7 dossiers locaux Becs Rouges validés), provenance tracée.
  - API `/api/sujets` : liste (avec nb sources/événements), détail (idOrSlug) + sources + événements, créer (membre), éditer, publier (animateur), supprimer (animateur), rattacher/détacher sources et événements.

## 2026-06-06 — Reprise v3 : conception refonte par sujets + Chantier T

Reprise du développement sur critique des camarades (perçu trop proche d'un Linkwarden). Phase de conception posée dans le vault, puis deux corrections tactiques.

- **Conception v3 (vault, hors repo).** Bascule de la navigation par sujets (façon GroundNews), modèle « socle commun + activités-pipelines », activités d'éduc pop (atelier, dossier, décryptage, parcours, arpentage), multi-utilisateur mono-collectif à attribution durcie. Notes de conception : refonte par sujets, cycle de vie de l'atelier, arpentage.
- **Paywall : lien original ou PDF.** À la soumission, quand un paywall est détecté, l'étape de prévisualisation propose un accès complet : un lien original accessible (archivé à sa place) ou un PDF de l'article (uploadé comme archive complète).
  - Backend : `POST /api/sources/:id/archiver` accepte désormais une `url` alternative (archive depuis le lien fourni, contenu réputé complet). Le PDF passe par `POST /api/sources/:id/archive-fichier` (déjà présent).
  - Client : helper `api.upload` (multipart) ; `SubmitSource.tsx` gagne un bloc de résolution paywall (radio lien / PDF).
- **Lisibilité de la navigation, clair et sombre.** L'état actif des deux niveaux de nav est unifié sur la pastille rouge de marque (l'actif principal était illisible à 15 % de blanc). En mode sombre, les liens de nav inactifs étaient tous teintés en rouge par la règle générique `.dark a` : neutralisés (blanc 0.82 pour la nav, gris clair pour la sous-nav). Vérifié dans les deux thèmes.

## 2026-06-05 — Observatoire, propriété des médias (Chantier A)

Refonte de l'Observatoire vers une posture d'éducation populaire (décrire, pas noter), suite à la recherche sur GroundNews et le paysage des outils de notation des médias.

- **Propriété structurée des médias.** La table `medias` gagne six champs : `proprietaire`, `actionnaire_ultime`, `type_propriete`, `financement`, `annee_creation`, `ligne_revendiquee`. La propriété, jusqu'ici en texte libre dans `description`, devient requêtable, pour une vraie cartographie française « qui possède quoi » (modèle Acrimed / Le Monde diplomatique).
  - Migration : `server/src/db/migrate-medias-propriete.ts` (idempotente).
  - Données initiales : `server/src/db/seed-medias-propriete.ts` (à valider sur la carte Acrimed).
  - API : `PUT /api/medias/:id/propriete` pour éditer depuis l'app.
  - UI : bloc « Propriété et financement » dans la fiche média (`FichesMedias`).

## 2026-06-05 — Couverture multisource (Chantier C)

Notion d'événement pour la veille multisourcée (objet 2 de l'app), façon GroundNews « coverage », sans aucune notation.

- **Table `evenements`** + colonne `sources.evenement_id`. Migration `migrate-evenements.ts`.
- **API `/api/evenements`** : liste (avec diversité de propriété), détail couverture (sources d'un fait avec média + propriété), création, rattacher/détacher une source.
- **UI** : section « Couverture » de l'Observatoire (`Couverture.tsx`) : liste des événements, vue d'un fait avec ses traitements côte à côte par média et propriété, création et rattachement depuis l'app.

### À venir

- Chantier B : remplacer l'indice de confiance média (verdict bon/mauvais, piège Decodex) par un profil de transparence descriptif.
- Brancher les skills de sourcing (`/preparer-atelier-source`, `/ingerer-source-atelier`) sur l'API.
