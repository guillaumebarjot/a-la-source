# Changelog — À la source

Doc vivante des évolutions notables. À jour de ce qui est réellement fait.

## 2026-06-06 — Lisibilité sombre + Chantier N (pages Sujets)

- **Correctif lisibilité (important).** Les titres de cartes (qui sont des liens) s'affichaient en **rouge sur fond sombre** en mode sombre, à cause de la règle globale `.dark a` qui peint tous les liens en rouge. Garde-fou posé : les **liens structurels** (titres de cartes, cartes-liens) prennent la couleur de texte normale en sombre ; le rouge reste pour les vrais liens de prose. Vérifié : zéro texte rouge sur fond sombre sur toute la page.
- **Chantier N (refonte par sujets, frontend).** Page d'accueil **Sujets** (grille de cartes-thèmes depuis `/api/sujets`), page **Sujet** (détail : couverture + sources). Navigation : « Sujets » en tête, « Flux » renommé « Veille ». Routes : `/` redirige vers `/sujets`. CSS en tokens de thème (lisible clair et sombre par construction).

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
