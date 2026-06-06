/**
 * Migration — Dossier (extension du socle Activités)
 *
 * Le dossier est un format de fond sur un thème : mise en perspective, sources
 * de référence et mécanismes récurrents. Le DÉCRYPTAGE n'est pas un type
 * distinct : c'est un dossier daté « à chaud », signalé par le flag a_chaud et
 * rattaché à un événement (evenement_id). Cette migration pose l'extension :
 *   - dossier_contenu : contenu éditorial du dossier (perspective + corps),
 *     flag à chaud et lien événement.
 *
 * ADDITIF, NON DESTRUCTIF, IDEMPOTENT (CREATE TABLE IF NOT EXISTS).
 */
import db from '../lib/db.js'

export function migrateDossiers(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dossier_contenu (
      activite_id INTEGER PRIMARY KEY REFERENCES activites(id) ON DELETE CASCADE,
      contenu_md TEXT,
      mise_en_perspective_md TEXT,
      a_chaud INTEGER DEFAULT 0,
      evenement_id INTEGER REFERENCES evenements(id)
    );
    CREATE INDEX IF NOT EXISTS idx_dossier_contenu_evenement ON dossier_contenu(evenement_id);
  `)
}

// Exécution directe
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateDossiers()
  console.log('Migration dossiers : schéma à jour.')
}
