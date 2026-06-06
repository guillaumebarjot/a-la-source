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
import { seedSujets } from './seed-sujets.js'
import { migrateActivites } from './migrate-activites.js'

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

  // Chantier S — sujets (refonte par sujets, façon GroundNews)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sujets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      titre TEXT NOT NULL,
      accroche TEXT,
      description_md TEXT,
      image_url TEXT,
      couleur TEXT,
      statut TEXT NOT NULL DEFAULT 'propose' CHECK(statut IN ('propose','publie','archive')),
      provenance TEXT,
      cree_par INTEGER REFERENCES utilisateurs(id),
      valide_par INTEGER REFERENCES utilisateurs(id),
      cree_le DATETIME DEFAULT CURRENT_TIMESTAMP,
      maj_le DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sujet_sources (
      sujet_id INTEGER NOT NULL REFERENCES sujets(id) ON DELETE CASCADE,
      source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      PRIMARY KEY (sujet_id, source_id)
    );
    CREATE TABLE IF NOT EXISTS sujet_evenements (
      sujet_id INTEGER NOT NULL REFERENCES sujets(id) ON DELETE CASCADE,
      evenement_id INTEGER NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,
      PRIMARY KEY (sujet_id, evenement_id)
    );
  `)

  // Seed initial de la propriété des médias, une seule fois (si jamais renseignée)
  const n = db.prepare('SELECT COUNT(*) AS c FROM medias WHERE proprietaire IS NOT NULL').get() as { c: number }
  if (n.c === 0) {
    const r = seedMediasPropriete()
    console.log(`  auto-seed propriété médias: ${r.updated} média(s) renseigné(s)`)
  }

  // Seed initial des sujets amorces (lithium + dossiers locaux Becs Rouges), une seule fois
  const ns = db.prepare('SELECT COUNT(*) AS c FROM sujets').get() as { c: number }
  if (ns.c === 0) {
    const rs = seedSujets()
    console.log(`  auto-seed sujets: ${rs.inserted} thème(s) créé(s)`)
  }

  // Chantier A — socle des activités + backfill des ateliers (additif, non destructif, idempotent)
  const ra = migrateActivites()
  if (ra.migrated > 0) console.log(`  auto-migrate activités: ${ra.migrated} atelier(s) recopié(s) dans activites`)

  console.log('Auto-migration: schéma à jour.')
}
