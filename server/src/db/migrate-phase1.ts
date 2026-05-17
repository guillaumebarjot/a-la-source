/**
 * Migration Phase 1 — Schema enrichi
 * Ajout : table parametres, table mots_cles, colonnes sources.*
 */
import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', '..', '..', 'db', 'a-la-source.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

console.log('Migration Phase 1 — debut')

// Table parametres (cle/valeur JSON)
db.exec(`
  CREATE TABLE IF NOT EXISTS parametres (
    cle TEXT PRIMARY KEY,
    valeur JSON NOT NULL DEFAULT '{}',
    modifie_le DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

// Table mots_cles (extraction automatique)
db.exec(`
  CREATE TABLE IF NOT EXISTS mots_cles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    mot TEXT NOT NULL,
    score_tfidf REAL DEFAULT 0,
    origine TEXT DEFAULT 'meta' CHECK(origine IN ('meta', 'tfidf')),
    UNIQUE(source_id, mot)
  );
  CREATE INDEX IF NOT EXISTS idx_mots_cles_source ON mots_cles(source_id);
`)

// Colonnes sources — ajout conditionnel (SQLite n'a pas IF NOT EXISTS pour ALTER)
const cols = db.prepare("PRAGMA table_info(sources)").all() as { name: string }[]
const colNames = cols.map((c) => c.name)

if (!colNames.includes('origine')) {
  db.exec(`ALTER TABLE sources ADD COLUMN origine TEXT DEFAULT 'web' CHECK(origine IN ('web', 'discord', 'import'));`)
  console.log('  + sources.origine')
}

if (!colNames.includes('origine_meta')) {
  db.exec(`ALTER TABLE sources ADD COLUMN origine_meta JSON;`)
  console.log('  + sources.origine_meta')
}

if (!colNames.includes('duree_estimee')) {
  db.exec(`ALTER TABLE sources ADD COLUMN duree_estimee REAL;`)
  console.log('  + sources.duree_estimee')
}

if (!colNames.includes('viralite_qualitative')) {
  db.exec(`ALTER TABLE sources ADD COLUMN viralite_qualitative TEXT CHECK(viralite_qualitative IN ('confidentiel', 'circule', 'viral', 'tres_viral'));`)
  console.log('  + sources.viralite_qualitative')
}

if (!colNames.includes('viralite_chiffre')) {
  db.exec(`ALTER TABLE sources ADD COLUMN viralite_chiffre INTEGER;`)
  console.log('  + sources.viralite_chiffre')
}

if (!colNames.includes('timing_override')) {
  db.exec(`ALTER TABLE sources ADD COLUMN timing_override TEXT CHECK(timing_override IN ('A', 'B', 'C', 'D'));`)
  console.log('  + sources.timing_override')
}

// Parametres par defaut
const insertParam = db.prepare('INSERT OR IGNORE INTO parametres (cle, valeur) VALUES (?, ?)')

insertParam.run('fraicheur_courbes', JSON.stringify({
  'presse mainstream': { demi_vie_jours: 30 },
  'PQR': { demi_vie_jours: 14 },
  'pure player': { demi_vie_jours: 45 },
  'video': { demi_vie_jours: 90 },
  'radio': { demi_vie_jours: 21 },
  'rapport': { demi_vie_jours: 365 },
  'lobby': { demi_vie_jours: 180 },
  'associatif': { demi_vie_jours: 120 },
  'officiel': { demi_vie_jours: 365 },
  'tribune': { demi_vie_jours: 60 }
}))

insertParam.run('score_poids', JSON.stringify({
  pedagogie: 50,
  echo: 50
}))

insertParam.run('confiance_media', JSON.stringify({
  coefficient_k: 1.0,
  formule: 'inverse_score_atelier'
}))

console.log('Migration Phase 1 — terminee')
db.close()
