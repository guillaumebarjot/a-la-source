# Schema de la base `a-la-source.db`

Carte lisible du schema SQLite (mode WAL). La reference technique reste
`server/src/db/schema.sql` ; les evolutions additives sont appliquees au boot
par `server/src/db/auto-migrate.ts` (idempotent). Etat verifie le 11/06/2026
(modele v3, refonte par sujets).

> Le `schema.sql` est un dump : ses dernieres lignes recreent a tort les tables
> shadow FTS5 (`sources_fts_*`) avec un double `IF NOT EXISTS`. Ces tables sont
> gerees automatiquement par le module FTS5 a partir de `CREATE VIRTUAL TABLE
> sources_fts` ; ne pas les recreer a la main (cf. `docs/audit-2026-06-11.md`).

---

## Familles de tables

### Utilisateurs et lecture
- `utilisateurs` : `nom` (= identifiant SSO YunoHost), `role`
  (`membre`/`animateur`/`admin`), `actif`. Voir `docs/acces-identite.md`.
- `lectures` : etat de lecture par (source, utilisateur) :
  `a_lire`/`lu`/`recommande`, avec `recommande_a` pour les recommandations.

### Socle documentaire (la matiere)
- `sources` : l'unite de base (article, video, rapport...). Metadonnees,
  `statut` (`veille`/`vivier`/`atelier`/`archive`), `origine`
  (`web`/`discord`/`import`), `a_qualifier` (Inbox), `completude`, viralite,
  rattachement `media_id`, `auteur_id`, `evenement_id`.
- `medias` : organes de presse, avec propriete structuree (`proprietaire`,
  `actionnaire_ultime`, `type_propriete`, `financement`, `ligne_revendiquee`).
- `auteurs` : signatures, rattachees a un media.
- `archives` : copies locales anti-linkrot (readability/markdown/pdf/html),
  `statut`, `nb_mots` ; `archive_signalements` pour les signalements.
- `tags` / `source_tags` : etiquetage libre ou categorise.
- `mots_cles` : mots-cles par source (meta ou TF-IDF).
- `sources_fts` (+ shadow `sources_fts_*`) : index FTS5 de recherche plein texte
  (titre, accroche, contenu archive, mots-cles).

### Sujets (entree v3, facon GroundNews)
- `sujets` : theme durable (slug, titre, accroche, `statut`
  `propose`/`publie`/`archive`).
- `sujet_sources`, `sujet_evenements` : rattachements d'un sujet a ses sources
  et evenements.
- `evenements` : faits d'actualite couverts par plusieurs sources.

### Mecanismes (pedagogie)
- `mecanismes_reference` : 25 mecanismes informationnels classes par categorie,
  avec definition, exemple, questions guidees, slug.
- `source_mecanismes` : mecanisme identifie sur une source (justification,
  extrait, auteur de l'identification).

### Evaluation et echange
- `evaluations` : score multi-criteres par evaluateur (echo, pedagogie,
  complexite, resonance, sourcing, bonus expert), unique par (source,
  evaluateur).
- `commentaires` : fil par source (commentaire/analyse/question/lien).
- `media_confiance_historique` : indice de confiance media calcule par mois.
- `media_transparence` : profil de transparence d'un media (criteres booleens).

### Activites d'education populaire (socle + pipelines)
Socle commun `activites` (`type` parmi atelier/dossier/decryptage/debunkage/
parcours/arpentage, `sujet_id`, `anime_par`, `statut`) +
`activite_sources` (sources rattachees, role, ordre) +
`activite_mecanismes`. Une extension par type :
- `atelier_pipeline` : prepa atelier (numero, date, lieu, facilitateur,
  source choisie, compte-rendu, observations).
- `dossier_contenu` : dossier/decryptage (contenu, mise en perspective,
  `a_chaud`, lien `evenement_id`).
- `debunkage_pipeline` (+ `debunkage_posts`) : affirmation visee, demonstration,
  liens de posts reseaux.
- `arpentage_pipeline` (+ `arpentage_fragments`, `arpentage_restitutions`) :
  lecture collective fragmentee, attribution, restitutions.

Tables legacy conservees (avant la bascule sur le socle) :
`ateliers`, `atelier_sources`, `atelier_mecanismes`. Le code lit desormais
`activites` ; le legacy est backfille par `migrate-activites.ts`.

### Parcours / quiz
- `parcours`, `parcours_questions` (source + mecanisme attendu),
  `parcours_sessions` (tentative d'un utilisateur), `parcours_reponses`
  (reponse par question, correct ou non).

### Divers
- `contenus` : contenus editoriaux stockes en base (manuel, fiches), rendus en
  markdown cote client (anti link-rot).
- `parametres` : reglages globaux cle/valeur JSON (admin uniquement).

---

## Volumetrie observee (base de dev, 11/06/2026)

157 sources, 136 medias, 27 sujets, 25 mecanismes, 3 utilisateurs, 3 activites.
Petite echelle : SQLite est largement suffisant (< 100 utilisateurs vises).

---

## Sauvegarde

Mode WAL : copie a chaud possible.

```bash
cp a-la-source.db backup-$(date +%Y%m%d).db
```

En prod, la base doit etre LOCALE au serveur YunoHost (pas OneDrive). Voir
`docs/acces-identite.md`, section risques.
