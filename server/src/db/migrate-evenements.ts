/**
 * Migration — Événements (Chantier C)
 *
 * Introduit la notion d'événement (un même fait d'actualité) à laquelle on
 * rattache plusieurs sources, pour comparer la couverture entre médias de
 * propriétés différentes. C'est le geste central de la veille multisourcée
 * (façon GroundNews « coverage »), sans aucune notation de biais : on met en
 * regard, on ne note pas.
 *
 * Idempotent. Utilise lib/db (surchargeable par A_LA_SOURCE_DB pour les tests).
 *
 * Usage : npx tsx server/src/db/migrate-evenements.ts
 */
import db from '../lib/db.js'

console.log('Migration événements — début')

db.exec(`
  CREATE TABLE IF NOT EXISTS evenements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL,
    description TEXT,
    date_evenement DATE,
    cree_par INTEGER REFERENCES utilisateurs(id),
    cree_le DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)
console.log('  table evenements OK')

const cols = (db.prepare('PRAGMA table_info(sources)').all() as { name: string }[]).map(c => c.name)
if (!cols.includes('evenement_id')) {
  db.exec('ALTER TABLE sources ADD COLUMN evenement_id INTEGER REFERENCES evenements(id);')
  console.log('  + sources.evenement_id')
}

db.exec('CREATE INDEX IF NOT EXISTS idx_sources_evenement ON sources(evenement_id);')
console.log('  index idx_sources_evenement OK')

console.log('Migration événements — terminée')
