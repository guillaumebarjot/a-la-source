/**
 * Migration Phase 3 — Recherche FTS5
 */
import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', '..', '..', 'db', 'a-la-source.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

console.log('Migration Phase 3 — debut')

// FTS5 virtual table for full-text search
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS sources_fts USING fts5(
    titre,
    accroche,
    contenu_archive,
    mots_cles,
    content='',
    tokenize='unicode61 remove_diacritics 2'
  );
`)

// Populate FTS from existing data
const sources = db.prepare(`
  SELECT s.id, s.titre, s.accroche,
    (SELECT ar.contenu FROM archives ar WHERE ar.source_id = s.id LIMIT 1) as contenu_archive
  FROM sources s
`).all() as { id: number; titre: string; accroche: string | null; contenu_archive: string | null }[]

const insertFts = db.prepare(`
  INSERT INTO sources_fts(rowid, titre, accroche, contenu_archive, mots_cles)
  VALUES (?, ?, ?, ?, ?)
`)

const getMotsCles = db.prepare("SELECT GROUP_CONCAT(mot, ' ') as mots FROM mots_cles WHERE source_id = ?")

let count = 0
for (const s of sources) {
  const mots = (getMotsCles.get(s.id) as { mots: string | null })?.mots || ''
  // Strip HTML from contenu_archive for indexing
  const contenuClean = s.contenu_archive?.replace(/<[^>]+>/g, ' ').substring(0, 5000) || ''
  insertFts.run(s.id, s.titre || '', s.accroche || '', contenuClean, mots)
  count++
}

console.log(`  FTS5 indexe : ${count} sources`)
console.log('Migration Phase 3 — terminee')
db.close()
