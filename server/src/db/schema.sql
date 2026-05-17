-- =============================================================================
-- Schema « A la source » v2.0
-- Base SQLite pour l'outil d'education populaire sur l'information
-- Rouge Coquelicot — rouge-coquelicot.fr
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
);

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
  statut TEXT DEFAULT 'veille' CHECK(statut IN ('veille','vivier','atelier','archive')),
  origine TEXT DEFAULT 'web' CHECK(origine IN ('web', 'discord', 'import')),
  origine_meta JSON,
  duree_estimee REAL,
  viralite_qualitative TEXT CHECK(viralite_qualitative IN ('confidentiel', 'circule', 'viral', 'tres_viral')),
  viralite_chiffre INTEGER,
  timing_override TEXT CHECK(timing_override IN ('A', 'B', 'C', 'D'))
);

CREATE TABLE IF NOT EXISTS archives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('readability','markdown','pdf','html')),
  contenu TEXT,
  chemin TEXT,
  cree_par INTEGER REFERENCES utilisateurs(id),
  cree_le DATETIME DEFAULT CURRENT_TIMESTAMP
);

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
);

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
  evaluee_le DATETIME DEFAULT CURRENT_TIMESTAMP,
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
);

CREATE TABLE IF NOT EXISTS atelier_sources (
  atelier_id INTEGER REFERENCES ateliers(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE,
  ajoutee_le DATETIME DEFAULT CURRENT_TIMESTAMP,
  retiree_le DATETIME,
  PRIMARY KEY (atelier_id, source_id)
);

CREATE TABLE IF NOT EXISTS contenus (
  cle TEXT PRIMARY KEY,
  titre TEXT,
  contenu TEXT,
  modifie_le DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

-- Index
CREATE INDEX IF NOT EXISTS idx_sources_media ON sources(media_id);
CREATE INDEX IF NOT EXISTS idx_sources_statut ON sources(statut);
CREATE INDEX IF NOT EXISTS idx_archives_source ON archives(source_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_source ON evaluations(source_id);
CREATE INDEX IF NOT EXISTS idx_commentaires_source ON commentaires(source_id);
CREATE INDEX IF NOT EXISTS idx_source_mecanismes_source ON source_mecanismes(source_id);
CREATE INDEX IF NOT EXISTS idx_source_tags_source ON source_tags(source_id);
CREATE INDEX IF NOT EXISTS idx_mots_cles_source ON mots_cles(source_id);
