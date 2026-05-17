/**
 * Migration : ajout statut et nb_mots sur archives
 * + table archive_signalements pour signaler les archives incompletes
 */
import db from '../lib/db.js'

export function migrateArchivesV2() {
  // Ajout colonnes sur archives
  const cols = db.prepare(`PRAGMA table_info(archives)`).all() as { name: string }[]
  const colNames = cols.map((c) => c.name)

  if (!colNames.includes('statut')) {
    db.exec(`ALTER TABLE archives ADD COLUMN statut TEXT DEFAULT 'complete' CHECK(statut IN ('complete','partielle','echouee'))`)
  }
  if (!colNames.includes('nb_mots')) {
    db.exec(`ALTER TABLE archives ADD COLUMN nb_mots INTEGER`)
  }

  // Table signalements d'archives
  db.exec(`
    CREATE TABLE IF NOT EXISTS archive_signalements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      archive_id INTEGER NOT NULL REFERENCES archives(id) ON DELETE CASCADE,
      signale_par INTEGER REFERENCES utilisateurs(id),
      raison TEXT,
      cree_le DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Calculer nb_mots pour les archives existantes qui n'en ont pas
  const archives = db.prepare(`SELECT id, contenu FROM archives WHERE nb_mots IS NULL AND contenu IS NOT NULL`).all() as { id: number; contenu: string }[]
  for (const a of archives) {
    const nbMots = a.contenu.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length
    db.prepare(`UPDATE archives SET nb_mots = ? WHERE id = ?`).run(nbMots, a.id)
  }

  // Marquer comme partielles les archives courtes de sources paywall
  db.exec(`
    UPDATE archives SET statut = 'partielle'
    WHERE nb_mots < 150
    AND source_id IN (SELECT id FROM sources WHERE paywall = 1)
    AND statut = 'complete'
  `)

  console.log('[migrate-archives-v2] Done')
}
