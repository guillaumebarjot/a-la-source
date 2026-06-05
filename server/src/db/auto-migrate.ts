/**
 * Auto-migration au démarrage.
 *
 * Applique les évolutions de schéma additives et idempotentes à chaque boot,
 * pour que l'app mette à jour sa propre base sans étape manuelle (utile en
 * déploiement, et quand la base est partagée via OneDrive entre PRO et PERSO).
 * Toutes les opérations sont sûres si déjà appliquées.
 */
import db from '../lib/db.js'
import { seedMediasPropriete } from './seed-medias-propriete.js'

function colonnes(table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name)
}

function ajouterColonne(table: string, colonne: string, type: string) {
  if (!colonnes(table).includes(colonne)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${colonne} ${type};`)
    console.log(`  auto-migrate: + ${table}.${colonne}`)
  }
}

export function autoMigrate(): void {
  // Chantier A — propriété structurée des médias
  ajouterColonne('medias', 'description', 'TEXT')
  ajouterColonne('medias', 'proprietaire', 'TEXT')
  ajouterColonne('medias', 'actionnaire_ultime', 'TEXT')
  ajouterColonne('medias', 'type_propriete', 'TEXT')
  ajouterColonne('medias', 'financement', 'TEXT')
  ajouterColonne('medias', 'annee_creation', 'INTEGER')
  ajouterColonne('medias', 'ligne_revendiquee', 'TEXT')

  // Chantier C — événements (veille multisource)
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
  ajouterColonne('sources', 'evenement_id', 'INTEGER REFERENCES evenements(id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_sources_evenement ON sources(evenement_id);')

  // Chantier B — profil de transparence des médias
  db.exec(`
    CREATE TABLE IF NOT EXISTS media_transparence (
      media_id INTEGER PRIMARY KEY REFERENCES medias(id) ON DELETE CASCADE,
      distingue_info_opinion INTEGER,
      publie_corrections INTEGER,
      divulgue_propriete INTEGER,
      divulgue_financement INTEGER,
      sans_publicite INTEGER,
      credite_auteurs INTEGER,
      charte_deontologique INTEGER,
      source_observation TEXT,
      maj_le DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Seed initial de la propriété des médias, une seule fois (si jamais renseignée)
  const n = db.prepare('SELECT COUNT(*) AS c FROM medias WHERE proprietaire IS NOT NULL').get() as { c: number }
  if (n.c === 0) {
    const r = seedMediasPropriete()
    console.log(`  auto-seed propriété médias: ${r.updated} média(s) renseigné(s)`)
  }

  console.log('Auto-migration: schéma à jour.')
}
