# Changelog — À la source

Doc vivante des évolutions notables. À jour de ce qui est réellement fait.

## 2026-06-06 — Lisibilité sombre + Chantier N (pages Sujets)

- **Correctif lisibilité (important).** Les titres de cartes (qui sont des liens) s'affichaient en **rouge sur fond sombre** en mode sombre, à cause de la règle globale `.dark a` qui peint tous les liens en rouge. Garde-fou posé : les **liens structurels** (titres de cartes, cartes-liens) prennent la couleur de texte normale en sombre ; le rouge reste pour les vrais liens de prose. Vérifié : zéro texte rouge sur fond sombre sur toute la page.
- **Chantier N (refonte par sujets, frontend).** Page d'accueil **Sujets** (grille de cartes-thèmes depuis `/api/sujets`), page **Sujet** (détail : couverture + sources). Navigation : « Sujets » en tête, « Flux » renommé « Veille ». Routes : `/` redirige vers `/sujets`. CSS en tokens de thème (lisible clair et sombre par construction).

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
