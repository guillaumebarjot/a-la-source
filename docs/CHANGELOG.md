# Changelog — À la source

Doc vivante des évolutions notables. À jour de ce qui est réellement fait.

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
