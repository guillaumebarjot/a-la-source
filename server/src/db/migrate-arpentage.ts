/**
 * Migration — Arpentage (lecture collective fragmentee)
 *
 * L'arpentage est une activite d'education populaire : un document long est
 * decoupe en fragments, chaque participant lit un fragment, puis on met en
 * commun et on synthetise collectivement. Trois operations : decouper,
 * attribuer, collecter les restitutions.
 *
 * Adosse au socle `activites` (type 'arpentage') + extension par tables :
 *   - arpentage_pipeline      : 1 ligne par activite (document source, mode de
 *                               decoupage, synthese collective)
 *   - arpentage_fragments     : les morceaux du document, attribuables a un
 *                               participant
 *   - arpentage_restitutions  : ce que chaque lecteur rapporte de son fragment
 *                               (points cles, citation, question, mecanisme)
 *
 * ADDITIF, NON DESTRUCTIF, IDEMPOTENT (CREATE TABLE IF NOT EXISTS).
 */
import db from '../lib/db.js'

export function migrateArpentage(): void {
  db.exec(`
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
  `)
}

// Execution directe
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateArpentage()
  console.log('Migration arpentage : schema a jour.')
}
