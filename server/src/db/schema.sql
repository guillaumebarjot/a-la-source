-- =============================================================================
-- Schema « A la source » v3
-- Base SQLite pour l'outil d'education populaire aux medias
-- Rouge Coquelicot — rouge-coquelicot.fr
--
-- Genere depuis la base canonique (OneDrive 00_PERSO/A la source/a-la-source.db),
-- modele v3 (refonte par sujets : socle commun + activites-pipelines).
-- Idempotent (CREATE ... IF NOT EXISTS). Au runtime, auto-migrate.ts applique
-- en plus les evolutions additives a chaque boot.
-- =============================================================================

CREATE TABLE IF NOT EXISTS utilisateurs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL UNIQUE,
  role TEXT DEFAULT 'membre' CHECK(role IN ('membre', 'animateur', 'admin')),
  actif INTEGER DEFAULT 1,
  cree_le DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS medias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL UNIQUE COLLATE NOCASE,
  type TEXT,
  url_site TEXT
, description TEXT, proprietaire TEXT, actionnaire_ultime TEXT, type_propriete TEXT, financement TEXT, annee_creation INTEGER, ligne_revendiquee TEXT, groupe_proprietaire TEXT, famille TEXT);
CREATE TABLE IF NOT EXISTS auteurs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  media_id INTEGER REFERENCES medias(id),
  UNIQUE(nom, media_id)
);
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titre TEXT NOT NULL,
  url TEXT,
  auteur_id INTEGER REFERENCES auteurs(id),
  media_id INTEGER REFERENCES medias(id),
  type_source TEXT CHECK(type_source IN (
    'presse mainstream','PQR','pure player','video','radio',
    'rapport','lobby','associatif','officiel','tribune'
  )),
  date_publication DATE,
  paywall INTEGER DEFAULT 0,
  duree_minutes REAL,
  accroche TEXT,
  image_url TEXT,
  soumis_par INTEGER REFERENCES utilisateurs(id),
  soumis_le DATETIME DEFAULT CURRENT_TIMESTAMP,
  statut TEXT DEFAULT 'veille' CHECK(statut IN ('veille','vivier','atelier','archive'))
, origine TEXT DEFAULT 'web' CHECK(origine IN ('web', 'discord', 'import')), origine_meta JSON, duree_estimee REAL, viralite_qualitative TEXT CHECK(viralite_qualitative IN ('confidentiel', 'circule', 'viral', 'tres_viral')), viralite_chiffre INTEGER, timing_override TEXT CHECK(timing_override IN ('A', 'B', 'C', 'D')), mots_cles TEXT, evenement_id INTEGER REFERENCES evenements(id), completude TEXT, a_qualifier INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS archives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('readability','markdown','pdf','html')),
  contenu TEXT,
  chemin TEXT,
  cree_par INTEGER REFERENCES utilisateurs(id),
  cree_le DATETIME DEFAULT CURRENT_TIMESTAMP
, statut TEXT DEFAULT 'complete' CHECK(statut IN ('complete','partielle','echouee')), nb_mots INTEGER);
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL UNIQUE COLLATE NOCASE,
  couleur TEXT,
  categorie TEXT DEFAULT 'libre' CHECK(categorie IN ('thematique','mecanisme','media','libre'))
);
CREATE TABLE IF NOT EXISTS source_tags (
  source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  ajoute_par INTEGER REFERENCES utilisateurs(id),
  ajoute_le DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (source_id, tag_id)
);
CREATE TABLE IF NOT EXISTS mecanismes_reference (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL UNIQUE,
  description TEXT,
  exemple TEXT,
  questions_guidees TEXT
, categorie TEXT DEFAULT 'manipulation', sources_reference TEXT, slug TEXT, definition_longue TEXT, categorie_label TEXT, categorie_description TEXT);
CREATE TABLE IF NOT EXISTS source_mecanismes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  mecanisme_id INTEGER NOT NULL REFERENCES mecanismes_reference(id),
  identifie_par INTEGER REFERENCES utilisateurs(id),
  justification TEXT,
  extrait TEXT,
  identifie_le DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  evaluateur_id INTEGER NOT NULL REFERENCES utilisateurs(id),
  score_echo INTEGER DEFAULT 0 CHECK(score_echo BETWEEN 0 AND 40),
  score_pedagogie INTEGER DEFAULT 0 CHECK(score_pedagogie BETWEEN 0 AND 50),
  commentaire TEXT,
  evaluee_le DATETIME DEFAULT CURRENT_TIMESTAMP, complexite INTEGER DEFAULT 0 CHECK(complexite BETWEEN 0 AND 10), bonus_expert INTEGER DEFAULT 0 CHECK(bonus_expert BETWEEN 0 AND 10), resonance INTEGER DEFAULT 0 CHECK(resonance BETWEEN 0 AND 10), sourcing INTEGER DEFAULT 0 CHECK(sourcing BETWEEN 0 AND 10),
  UNIQUE(source_id, evaluateur_id)
);
CREATE TABLE IF NOT EXISTS commentaires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  auteur_id INTEGER NOT NULL REFERENCES utilisateurs(id),
  type TEXT DEFAULT 'commentaire' CHECK(type IN ('commentaire','analyse','question','lien')),
  contenu TEXT NOT NULL,
  url TEXT,
  cree_le DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS lectures (
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id),
  statut TEXT NOT NULL CHECK(statut IN ('a_lire','lu','recommande')),
  recommande_a INTEGER REFERENCES utilisateurs(id),
  date_maj DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (source_id, utilisateur_id)
);
CREATE TABLE IF NOT EXISTS ateliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero INTEGER NOT NULL UNIQUE,
  date_atelier DATE,
  lieu TEXT,
  statut TEXT DEFAULT 'preparation' CHECK(statut IN ('preparation','pret','en_cours','termine')),
  source_choisie_id INTEGER REFERENCES sources(id),
  nb_participants INTEGER,
  compte_rendu TEXT,
  observations TEXT,
  mecanisme_identifie TEXT,
  cree_le DATETIME DEFAULT CURRENT_TIMESTAMP
, heure TEXT, facilitateur_id INTEGER REFERENCES utilisateurs(id), observations_surprise TEXT, questions_restantes TEXT);
CREATE TABLE IF NOT EXISTS atelier_sources (
  atelier_id INTEGER REFERENCES ateliers(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE,
  ajoutee_le DATETIME DEFAULT CURRENT_TIMESTAMP,
  retiree_le DATETIME, ordre INTEGER DEFAULT 0,
  PRIMARY KEY (atelier_id, source_id)
);
CREATE TABLE IF NOT EXISTS contenus (
  cle TEXT PRIMARY KEY,
  titre TEXT,
  contenu TEXT,
  modifie_le DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sources_media ON sources(media_id);
CREATE INDEX IF NOT EXISTS idx_sources_statut ON sources(statut);
CREATE INDEX IF NOT EXISTS idx_archives_source ON archives(source_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_source ON evaluations(source_id);
CREATE INDEX IF NOT EXISTS idx_commentaires_source ON commentaires(source_id);
CREATE INDEX IF NOT EXISTS idx_source_mecanismes_source ON source_mecanismes(source_id);
CREATE INDEX IF NOT EXISTS idx_source_tags_source ON source_tags(source_id);
CREATE TABLE IF NOT EXISTS parametres (
    cle TEXT PRIMARY KEY,
    valeur JSON NOT NULL DEFAULT '{}',
    modifie_le DATETIME DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE IF NOT EXISTS mots_cles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    mot TEXT NOT NULL,
    score_tfidf REAL DEFAULT 0,
    origine TEXT DEFAULT 'meta' CHECK(origine IN ('meta', 'tfidf')),
    UNIQUE(source_id, mot)
  );
CREATE INDEX IF NOT EXISTS idx_mots_cles_source ON mots_cles(source_id);
CREATE TABLE IF NOT EXISTS media_confiance_historique (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER NOT NULL REFERENCES medias(id) ON DELETE CASCADE,
    mois TEXT NOT NULL,
    score_confiance REAL NOT NULL,
    nb_sources INTEGER NOT NULL,
    nb_mecanismes_moyen REAL,
    diversite_mecanismes REAL,
    calcule_le DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(media_id, mois)
  );
CREATE VIRTUAL TABLE IF NOT EXISTS sources_fts USING fts5(
    titre,
    accroche,
    contenu_archive,
    mots_cles,
    content='',
    tokenize='unicode61 remove_diacritics 2'
  )
/* sources_fts(titre,accroche,contenu_archive,mots_cles) */;
CREATE TABLE IF NOT EXISTS IF NOT EXISTS 'sources_fts_data'(id INTEGER PRIMARY KEY, block BLOB);
CREATE TABLE IF NOT EXISTS IF NOT EXISTS 'sources_fts_idx'(segid, term, pgno, PRIMARY KEY(segid, term)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS IF NOT EXISTS 'sources_fts_docsize'(id INTEGER PRIMARY KEY, sz BLOB);
CREATE TABLE IF NOT EXISTS IF NOT EXISTS 'sources_fts_config'(k PRIMARY KEY, v) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS archive_signalements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      archive_id INTEGER NOT NULL REFERENCES archives(id) ON DELETE CASCADE,
      signale_par INTEGER REFERENCES utilisateurs(id),
      raison TEXT,
      cree_le DATETIME DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE IF NOT EXISTS atelier_mecanismes (
    atelier_id INTEGER REFERENCES ateliers(id) ON DELETE CASCADE,
    mecanisme_id INTEGER REFERENCES mecanismes_reference(id),
    PRIMARY KEY (atelier_id, mecanisme_id)
  );
CREATE TABLE IF NOT EXISTS evenements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titre TEXT NOT NULL,
      description TEXT,
      date_evenement DATE,
      cree_par INTEGER REFERENCES utilisateurs(id),
      cree_le DATETIME DEFAULT CURRENT_TIMESTAMP
    );
CREATE INDEX IF NOT EXISTS idx_sources_evenement ON sources(evenement_id);
CREATE TABLE IF NOT EXISTS media_transparence (
      media_id INTEGER PRIMARY KEY REFERENCES medias(id) ON DELETE CASCADE,
      distingue_info_opinion INTEGER,
      publie_corrections INTEGER,
      divulgue_propriete INTEGER,
      divulgue_financement INTEGER,
      sans_publicite INTEGER,
      credite_auteurs INTEGER,
      charte_deontologique INTEGER,
      source_observation TEXT,
      maj_le DATETIME DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE IF NOT EXISTS sujets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      titre TEXT NOT NULL,
      accroche TEXT,
      description_md TEXT,
      image_url TEXT,
      couleur TEXT,
      statut TEXT NOT NULL DEFAULT 'propose' CHECK(statut IN ('propose','publie','archive')),
      provenance TEXT,
      cree_par INTEGER REFERENCES utilisateurs(id),
      valide_par INTEGER REFERENCES utilisateurs(id),
      cree_le DATETIME DEFAULT CURRENT_TIMESTAMP,
      maj_le DATETIME DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE IF NOT EXISTS sujet_sources (
      sujet_id INTEGER NOT NULL REFERENCES sujets(id) ON DELETE CASCADE,
      source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      PRIMARY KEY (sujet_id, source_id)
    );
CREATE TABLE IF NOT EXISTS sujet_evenements (
      sujet_id INTEGER NOT NULL REFERENCES sujets(id) ON DELETE CASCADE,
      evenement_id INTEGER NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,
      PRIMARY KEY (sujet_id, evenement_id)
    );
CREATE TABLE IF NOT EXISTS activites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('atelier','dossier','decryptage','debunkage','parcours','arpentage')),
      sujet_id INTEGER REFERENCES sujets(id) ON DELETE SET NULL,
      titre TEXT NOT NULL,
      statut TEXT NOT NULL DEFAULT 'brouillon',
      anime_par INTEGER REFERENCES utilisateurs(id),
      cree_par INTEGER REFERENCES utilisateurs(id),
      legacy_atelier_id INTEGER,
      cree_le DATETIME DEFAULT CURRENT_TIMESTAMP,
      maj_le DATETIME DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE IF NOT EXISTS activite_sources (
      activite_id INTEGER NOT NULL REFERENCES activites(id) ON DELETE CASCADE,
      source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      ordre INTEGER DEFAULT 0,
      note TEXT, role TEXT,
      PRIMARY KEY (activite_id, source_id)
    );
CREATE TABLE IF NOT EXISTS atelier_pipeline (
      activite_id INTEGER PRIMARY KEY REFERENCES activites(id) ON DELETE CASCADE,
      numero INTEGER,
      date_atelier DATE,
      heure TEXT,
      lieu TEXT,
      facilitateur_id INTEGER REFERENCES utilisateurs(id),
      source_choisie_id INTEGER REFERENCES sources(id),
      nb_participants INTEGER,
      compte_rendu TEXT,
      observations TEXT,
      observations_surprise TEXT,
      questions_restantes TEXT,
      mecanisme_identifie TEXT
    );
CREATE INDEX IF NOT EXISTS idx_activites_type ON activites(type);
CREATE INDEX IF NOT EXISTS idx_activites_sujet ON activites(sujet_id);
CREATE TABLE IF NOT EXISTS debunkage_pipeline (
      activite_id INTEGER PRIMARY KEY REFERENCES activites(id) ON DELETE CASCADE,
      affirmation_visee_md TEXT,
      demonstration_md TEXT,
      statut TEXT DEFAULT 'brouillon',
      relaye_site INTEGER DEFAULT 0
    );
CREATE TABLE IF NOT EXISTS debunkage_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activite_id INTEGER NOT NULL REFERENCES activites(id) ON DELETE CASCADE,
      reseau TEXT CHECK(reseau IN ('instagram','facebook','autre')),
      url TEXT NOT NULL,
      publie_le DATETIME DEFAULT CURRENT_TIMESTAMP
    );
CREATE INDEX IF NOT EXISTS idx_debunkage_posts_activite ON debunkage_posts(activite_id);
CREATE TABLE IF NOT EXISTS parcours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titre TEXT NOT NULL,
      description TEXT,
      cree_par INTEGER REFERENCES utilisateurs(id),
      cree_le DATETIME DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE IF NOT EXISTS parcours_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parcours_id INTEGER NOT NULL REFERENCES parcours(id) ON DELETE CASCADE,
      ordre INTEGER NOT NULL DEFAULT 0,
      source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      mecanisme_attendu_id INTEGER NOT NULL REFERENCES mecanismes_reference(id),
      explication TEXT
    );
CREATE INDEX IF NOT EXISTS idx_parcours_questions_parcours ON parcours_questions(parcours_id);
CREATE TABLE IF NOT EXISTS parcours_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parcours_id INTEGER NOT NULL REFERENCES parcours(id) ON DELETE CASCADE,
      utilisateur_id INTEGER REFERENCES utilisateurs(id),
      score INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      commence_le DATETIME DEFAULT CURRENT_TIMESTAMP,
      termine_le DATETIME
    );
CREATE INDEX IF NOT EXISTS idx_parcours_sessions_parcours ON parcours_sessions(parcours_id);
CREATE TABLE IF NOT EXISTS parcours_reponses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES parcours_sessions(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES parcours_questions(id) ON DELETE CASCADE,
      mecanisme_choisi_id INTEGER REFERENCES mecanismes_reference(id),
      correct INTEGER DEFAULT 0,
      repondu_le DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, question_id)
    );
CREATE INDEX IF NOT EXISTS idx_parcours_reponses_session ON parcours_reponses(session_id);
CREATE TABLE IF NOT EXISTS dossier_contenu (
      activite_id INTEGER PRIMARY KEY REFERENCES activites(id) ON DELETE CASCADE,
      contenu_md TEXT,
      mise_en_perspective_md TEXT,
      a_chaud INTEGER DEFAULT 0,
      evenement_id INTEGER REFERENCES evenements(id)
    );
CREATE INDEX IF NOT EXISTS idx_dossier_contenu_evenement ON dossier_contenu(evenement_id);
CREATE TABLE IF NOT EXISTS arpentage_pipeline (
      activite_id INTEGER PRIMARY KEY REFERENCES activites(id) ON DELETE CASCADE,
      source_id INTEGER REFERENCES sources(id),
      mode_decoupage TEXT,
      synthese_md TEXT
    );
CREATE TABLE IF NOT EXISTS arpentage_fragments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activite_id INTEGER NOT NULL REFERENCES activites(id) ON DELETE CASCADE,
      ordre INTEGER DEFAULT 0,
      titre TEXT,
      reference TEXT,
      contenu_md TEXT,
      attribue_a INTEGER REFERENCES utilisateurs(id)
    );
CREATE INDEX IF NOT EXISTS idx_arpentage_fragments_activite ON arpentage_fragments(activite_id);
CREATE TABLE IF NOT EXISTS arpentage_restitutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fragment_id INTEGER NOT NULL REFERENCES arpentage_fragments(id) ON DELETE CASCADE,
      par INTEGER REFERENCES utilisateurs(id),
      points_cles_md TEXT,
      citation TEXT,
      question_md TEXT,
      mecanisme_id INTEGER REFERENCES mecanismes_reference(id),
      cree_le DATETIME DEFAULT CURRENT_TIMESTAMP
    );
CREATE INDEX IF NOT EXISTS idx_arpentage_restitutions_fragment ON arpentage_restitutions(fragment_id);
CREATE TABLE IF NOT EXISTS activite_mecanismes (
      activite_id INTEGER NOT NULL REFERENCES activites(id) ON DELETE CASCADE,
      mecanisme_id INTEGER NOT NULL REFERENCES mecanismes_reference(id),
      PRIMARY KEY (activite_id, mecanisme_id)
    );
