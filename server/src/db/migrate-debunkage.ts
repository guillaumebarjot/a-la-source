/**
 * Migration — Débunkage (extension du socle Activités)
 *
 * Le débunkage est une activité menée par un adhérent sur un thème : on vise une
 * affirmation, on bâtit une démonstration appuyée sur des sources (rôle pour /
 * contre), et la sortie est un (ou plusieurs) post réseau social dont on consigne
 * a minima le lien. Cette migration pose :
 *   - debunkage_pipeline : l'extension de l'activité (affirmation, démonstration, statut, relai site)
 *   - debunkage_posts     : les liens de publications réseaux sociaux
 *   - activite_sources.role : rôle de la source dans la démonstration (pour / contre)
 *
 * ADDITIF, NON DESTRUCTIF, IDEMPOTENT (CREATE TABLE IF NOT EXISTS + PRAGMA pour la colonne).
 */
import db from '../lib/db.js'

function colonnes(table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name)
}

export function migrateDebunkage(): void {
  db.exec(`
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
  `)

  // Rôle de la source dans la démonstration (pour / contre). Idempotent via PRAGMA.
  if (!colonnes('activite_sources').includes('role')) {
    db.exec('ALTER TABLE activite_sources ADD COLUMN role TEXT;')
  }
}

// Exécution directe
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateDebunkage()
  console.log('Migration débunkage : schéma à jour.')
}
