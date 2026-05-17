import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', '..', '..', 'db', 'a-la-source.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

console.log('Migration ateliers v2 — debut...')

// Check if columns already exist before adding
const atelierCols = db.prepare("PRAGMA table_info(ateliers)").all() as Array<{ name: string }>
const existingCols = new Set(atelierCols.map(c => c.name))

if (!existingCols.has('heure')) {
  db.exec("ALTER TABLE ateliers ADD COLUMN heure TEXT")
  console.log('  + ateliers.heure')
}
if (!existingCols.has('facilitateur_id')) {
  db.exec("ALTER TABLE ateliers ADD COLUMN facilitateur_id INTEGER REFERENCES utilisateurs(id)")
  console.log('  + ateliers.facilitateur_id')
}
if (!existingCols.has('observations_surprise')) {
  db.exec("ALTER TABLE ateliers ADD COLUMN observations_surprise TEXT")
  console.log('  + ateliers.observations_surprise')
}
if (!existingCols.has('questions_restantes')) {
  db.exec("ALTER TABLE ateliers ADD COLUMN questions_restantes TEXT")
  console.log('  + ateliers.questions_restantes')
}

// Check atelier_sources for ordre column
const asCols = db.prepare("PRAGMA table_info(atelier_sources)").all() as Array<{ name: string }>
const asExisting = new Set(asCols.map(c => c.name))

if (!asExisting.has('ordre')) {
  db.exec("ALTER TABLE atelier_sources ADD COLUMN ordre INTEGER DEFAULT 0")
  console.log('  + atelier_sources.ordre')
}

// Create atelier_mecanismes table
db.exec(`
  CREATE TABLE IF NOT EXISTS atelier_mecanismes (
    atelier_id INTEGER REFERENCES ateliers(id) ON DELETE CASCADE,
    mecanisme_id INTEGER REFERENCES mecanismes_reference(id),
    PRIMARY KEY (atelier_id, mecanisme_id)
  )
`)
console.log('  + table atelier_mecanismes')

// Fix source statuts: sources currently at 'atelier' should go back to 'vivier'
// (new model: sources stay at vivier, tracked via atelier_sources join)
const fixed = db.prepare("UPDATE sources SET statut = 'vivier' WHERE statut = 'atelier'").run()
if (fixed.changes > 0) {
  console.log(`  ~ ${fixed.changes} source(s) remises au vivier (nouveau modele: pas de changement de statut)`)
}

console.log('Migration ateliers v2 terminee.')
db.close()
