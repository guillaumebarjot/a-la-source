# Schéma de la base `a-la-source.db`

Carte lisible du schéma SQLite (mode DELETE, pas WAL -- incompatible OneDrive). La référence technique reste `server/src/db/schema.sql` ; les évolutions additives sont appliquées au boot par `server/src/db/auto-migrate.ts` (idempotent). État vérifié le 21/06/2026 (modèle v3, refonte par sujets ; socle `activites` en place ; complétion BDD appliquée à la canonique : dédoublonnage, accroches, images, rattachement aux sujets, cf. `docs/audit-bdd-2026-06-21.md` et `docs/completion-bdd-plan.md`).

> Le `schema.sql` est un dump : ses dernières lignes recrèent à tort les tables
> shadow FTS5 (`sources_fts_*`) avec un double `IF NOT EXISTS`. Ces tables sont
> gérées automatiquement par le module FTS5 à partir de `CREATE VIRTUAL TABLE
> sources_fts` ; ne pas les recréer à la main (cf. `docs/audit-2026-06-11.md`).

---

## Familles de tables

### Utilisateurs et lecture

- `utilisateurs` : `nom` (= identifiant SSO Authentik, repli `Remote-User`), `role` (`membre`/`animateur`/`admin`), `actif`, `discord_pseudo` (pseudo éditable depuis Mon espace) et `discord_id` (identifiant stable, sert au rapprochement auteur Discord vers membre). Voir `docs/acces-identite.md`.
- `lectures` : état de lecture par (source, utilisateur) : `a_lire`/`lu`/`recommande`, avec `recommande_a` pour les recommandations.

### Socle documentaire (la matière)

- `sources` : l'unité de base (article, vidéo, rapport...). Métadonnées, `statut` (`veille`/`vivier`/`atelier`/`archive`), `origine` (`web`/`discord`/`import`), `a_qualifier` (Inbox), `completude` (`libre`/`partiel`/`integral_offline`), viralité, rattachement `media_id`, `auteur_id`, `evenement_id`.
- `medias` : organes de presse, avec propriété structurée (`proprietaire`, `actionnaire_ultime`, `type_propriete`, `financement`, `ligne_revendiquee`). Édition via `PUT /api/medias/:id/propriete`.
- `auteurs` : signatures, rattachées à un média.
- `archives` : copies locales anti-linkrot (readability/markdown/pdf/html), `statut`, `nb_mots` ; `archive_signalements` pour les signalements.
- `tags` / `source_tags` : étiquetage libre ou catégorisé (`thematique`/`mecanisme`/`media`/`libre`).
- `mots_cles` : mots-clés par source (meta ou TF-IDF).
- `sources_fts` (+ shadow `sources_fts_*`) : index FTS5 de recherche plein texte (titre, accroche, contenu archivé, mots-clés).

### Sujets (entrée v3, façon GroundNews)

- `sujets` : thème durable (slug, titre, accroche, `statut` `propose`/`publie`/`archive`).
- `sujet_sources`, `sujet_evenements` : rattachements d'un sujet à ses sources et événements.
- `evenements` : faits d'actualité couverts par plusieurs sources.

### Mécanismes (pédagogie)

- `mecanismes_reference` : 25 mécanismes informationnels classés par catégorie, avec définition, exemple, questions guidées, slug.
- `source_mecanismes` : mécanisme identifié sur une source (justification, extrait, `identifie_par` = clé étrangère vers `utilisateurs.id`, peut être `NULL` pour les analyses conservatrices anonymes posées par script).

### Évaluation et échange

- `evaluations` : score multi-critères par évaluateur (écho, pédagogie, complexité, résonance, sourcing, bonus expert), unique par (source, évaluateur).
- `commentaires` : fil par source (commentaire/analyse/question/lien).
- `media_confiance_historique` : indice de confiance média calculé par mois.
- `media_transparence` : profil de transparence d'un média (critères booléens).

### Activités d'éducation populaire (socle + pipelines)

Socle commun `activites` (`type` parmi `atelier`/`dossier`/`decryptage`/`debunkage`/`parcours`/`arpentage`, `sujet_id`, `anime_par`, `statut`) + `activite_sources` (sources rattachées, rôle, ordre) + `activite_mecanismes`. Une extension par type :

- `atelier_pipeline` : prépa atelier (numéro, date, lieu, facilitateur, source choisie, compte-rendu, observations).
- `dossier_contenu` : dossier/décryptage (contenu, mise en perspective, `a_chaud`, lien `evenement_id`).
- `debunkage_pipeline` (+ `debunkage_posts`) : affirmation visée, démonstration, liens de posts réseaux.
- `arpentage_pipeline` (+ `arpentage_fragments`, `arpentage_restitutions`) : lecture collective fragmentée, attribution, restitutions.

Tables legacy conservées (avant la bascule sur le socle) : `ateliers`, `atelier_sources`, `atelier_mecanismes`. Le code lit désormais `activites` ; le legacy est backfillé par `migrate-activites.ts`.

### Parcours / quiz

- `parcours`, `parcours_questions` (source + mécanisme attendu), `parcours_sessions` (tentative d'un utilisateur), `parcours_reponses` (réponse par question, correct ou non).

### Intégration Discord

- `discord_messages` : mapping message Discord vers source. Permet au bot de rattacher les **éditions** et **réponses** Discord à la bonne source, et la dédup par message en plus de la dédup par URL.

### Divers

- `contenus` : contenus éditoriaux stockés en base (manuel, fiches), rendus en markdown côté client (anti link-rot).
- `parametres` : réglages globaux clé/valeur JSON (admin uniquement).

---

## Volumétrie

Petite échelle : SQLite est largement suffisant (cible < 100 utilisateurs). Le catalogue de référence compte **25 mécanismes**. Les volumes de sources, médias, sujets et activités évoluent au fil de la veille et de la complétion BDD ; l'instantané chiffré de référence est tenu dans `docs/audit-bdd-2026-06-21.md` plutôt que recopié ici (pour éviter qu'il ne périsse).

---

## Mode journal

**Mode DELETE** (journal rollback classique). Le mode WAL est incompatible avec OneDrive (les fichiers sidecar `-wal`/`-shm` sont désynchronisés par la synchro cloud, ce qui provoque des erreurs « database disk image is malformed » et des régressions de données). Ne jamais repasser en WAL.

En production, la base est LOCALE au serveur (volume `/data` du conteneur, via `A_LA_SOURCE_DB`), jamais OneDrive.

---

## Sauvegarde

```bash
cp a-la-source.db backup-$(date +%Y%m%d).db
```

Voir `docs/acces-identite.md`, section risques, et `docs/workflow-git.md`, section 7 (règle copie + swap).
