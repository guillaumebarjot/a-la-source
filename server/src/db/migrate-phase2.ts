/**
 * Migration Phase 2 — Score atelier /100, evaluations enrichies, confiance media
 */
import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', '..', '..', 'db', 'a-la-source.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

console.log('Migration Phase 2 — debut')

// Enrichir la table evaluations avec les nouveaux sliders
const evalCols = (db.prepare("PRAGMA table_info(evaluations)").all() as { name: string }[]).map(c => c.name)

if (!evalCols.includes('complexite')) {
  db.exec(`ALTER TABLE evaluations ADD COLUMN complexite INTEGER DEFAULT 0 CHECK(complexite BETWEEN 0 AND 10);`)
  console.log('  + evaluations.complexite')
}

if (!evalCols.includes('bonus_expert')) {
  db.exec(`ALTER TABLE evaluations ADD COLUMN bonus_expert INTEGER DEFAULT 0 CHECK(bonus_expert BETWEEN 0 AND 10);`)
  console.log('  + evaluations.bonus_expert')
}

if (!evalCols.includes('resonance')) {
  db.exec(`ALTER TABLE evaluations ADD COLUMN resonance INTEGER DEFAULT 0 CHECK(resonance BETWEEN 0 AND 10);`)
  console.log('  + evaluations.resonance')
}

// Table historique confiance media
db.exec(`
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
`)

console.log('Migration Phase 2 — terminee')
db.close()
