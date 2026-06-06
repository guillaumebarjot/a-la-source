/**
 * Migration — Sujets (Chantier S, refonte par sujets)
 *
 * Introduit le Sujet : objet pivot éditorial (thème durable) qui agrège la
 * veille (sources), la couverture (événements) et, à terme, les activités.
 * C'est la colonne vertébrale de la refonte v3 « nav par sujets », façon
 * GroundNews (un topic agrège des stories), sans aucune notation.
 *
 * Distinct de l'événement (fait ponctuel multisourcé, Chantier C) : un sujet
 * dure, un événement est daté. Un sujet contient plusieurs événements.
 *
 * Idempotent. Usage : npx tsx server/src/db/migrate-sujets.ts
 */
import db from '../lib/db.js'
import { seedSujets } from './seed-sujets.js'

console.log('Migration sujets — début')

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
console.log('  tables sujets, sujet_sources, sujet_evenements OK')

const n = db.prepare('SELECT COUNT(*) AS c FROM sujets').get() as { c: number }
if (n.c === 0) {
  const r = seedSujets()
  console.log(`  seed sujets : ${r.inserted} thème(s) créé(s)`)
}

console.log('Migration sujets — terminée')
