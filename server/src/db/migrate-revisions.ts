/**
 * Migration — Répétition espacée des mécanismes (patron Anki / SM-2, recadré auto-apprentissage)
 *
 * La « carte » à réviser n'est PAS une question d'examen : c'est un MÉCANISME
 * rencontré (la grille de lecture des 25 mécanismes du catalogue). L'enjeu n'est
 * pas la performance mémoire mais d'ancrer l'esprit critique dans la durée : revoir
 * au bon moment les mécanismes déjà croisés pour que l'œil les reconnaisse seul.
 *
 * Doctrine epoché (cf. docs/conception-quiz-autoapprentissage.md, section C) :
 *   - Pas de note, pas de fail, pas de streak. Le succès allonge l'intervalle,
 *     l'échec le raccourcit doucement (jamais de reset brutal à 0, jamais affiché).
 *   - Granularité = le mécanisme, pas la source : une révision peut présenter une
 *     NOUVELLE source mobilisant le même mécanisme (cohérent avec le tirage en banque).
 *
 * Table (une seule, hors des tables parcours*, pour ne pas alourdir le quiz) :
 *   - revisions_mecanismes : planification SM-2 par personne × mécanisme (clé unique).
 *
 * ADDITIF, NON DESTRUCTIF, IDEMPOTENT (CREATE TABLE / INDEX IF NOT EXISTS).
 *
 * Câblage dans auto-migrate.ts (à ajouter à la main, ce module N'EST PAS wiré) :
 *   import { migrateRevisions } from './migrate-revisions.js'   // en tête de fichier
 *   migrateRevisions()                                          // dans autoMigrate(), après migrateParcours()
 */
import db from '../lib/db.js'

export function migrateRevisions(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS revisions_mecanismes (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      utilisateur_id      INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
      mecanisme_id        INTEGER NOT NULL REFERENCES mecanismes_reference(id),
      intervalle_jours    INTEGER NOT NULL DEFAULT 1,   -- 1, 6, puis round(intervalle * facilite)
      facilite            REAL    NOT NULL DEFAULT 2.5,  -- ease SM-2, plancher 1.3
      nb_revus            INTEGER NOT NULL DEFAULT 0,    -- compteur de passages reussis
      prochaine_revision  DATE    NOT NULL,             -- la donnee pilotante
      maj_le              DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(utilisateur_id, mecanisme_id)
    );
    CREATE INDEX IF NOT EXISTS idx_revisions_due
      ON revisions_mecanismes(utilisateur_id, prochaine_revision);
  `)
}

// Execution directe : tsx src/db/migrate-revisions.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateRevisions()
  console.log('Migration revisions_mecanismes : schema a jour.')
}
