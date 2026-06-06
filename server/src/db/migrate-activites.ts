/**
 * Migration — Activités (Chantier A, refonte par sujets)
 *
 * Pose la colonne vertébrale des activités d'éducation populaire : une table
 * `activites` (socle commun) + une extension par type. L'atelier en est le
 * premier exemple (`atelier_pipeline`). Chaque activité est un pipeline-outil
 * posé sur les données communes (sources, mécanismes, sujets).
 *
 * ADDITIF ET NON DESTRUCTIF : on crée les nouvelles tables et on RECOPIE les
 * ateliers existants dedans (backfill), SANS toucher aux tables `ateliers*` ni
 * aux routes actuelles. La bascule des lectures viendra plus tard, une fois ce
 * socle éprouvé. Idempotent : le backfill est tracé par `legacy_atelier_id`.
 *
 * Sauvegarde de la base recommandée avant exécution (faite le 2026-06-06).
 * Usage : npx tsx server/src/db/migrate-activites.ts
 */
import db from '../lib/db.js'

interface AtelierRow {
  id: number; numero: number; date_atelier: string | null; heure: string | null
  lieu: string | null; statut: string; facilitateur_id: number | null
  source_choisie_id: number | null; nb_participants: number | null
  compte_rendu: string | null; observations: string | null
  observations_surprise: string | null; questions_restantes: string | null
  mecanisme_identifie: string | null; cree_le: string | null
}

export function migrateActivites(): { migrated: number } {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('atelier','dossier','decryptage','debunkage','parcours','arpentage')),
      sujet_id INTEGER REFERENCES sujets(id) ON DELETE SET NULL,
      titre TEXT NOT NULL,
      statut TEXT NOT NULL DEFAULT 'brouillon',
      anime_par INTEGER REFERENCES utilisateurs(id),
      cree_par INTEGER REFERENCES utilisateurs(id),
      legacy_atelier_id INTEGER,
      cree_le DATETIME DEFAULT CURRENT_TIMESTAMP,
      maj_le DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activite_sources (
      activite_id INTEGER NOT NULL REFERENCES activites(id) ON DELETE CASCADE,
      source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      ordre INTEGER DEFAULT 0,
      note TEXT,
      PRIMARY KEY (activite_id, source_id)
    );
    CREATE TABLE IF NOT EXISTS atelier_pipeline (
      activite_id INTEGER PRIMARY KEY REFERENCES activites(id) ON DELETE CASCADE,
      numero INTEGER,
      date_atelier DATE,
      heure TEXT,
      lieu TEXT,
      facilitateur_id INTEGER REFERENCES utilisateurs(id),
      source_choisie_id INTEGER REFERENCES sources(id),
      nb_participants INTEGER,
      compte_rendu TEXT,
      observations TEXT,
      observations_surprise TEXT,
      questions_restantes TEXT,
      mecanisme_identifie TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_activites_type ON activites(type);
    CREATE INDEX IF NOT EXISTS idx_activites_sujet ON activites(sujet_id);
  `)

  // La table ateliers peut ne pas exister (base neuve) : on ne backfille que si elle est là.
  const hasAteliers = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='ateliers'"
  ).get()
  if (!hasAteliers) return { migrated: 0 }

  const dejaMigres = new Set(
    (db.prepare('SELECT legacy_atelier_id FROM activites WHERE legacy_atelier_id IS NOT NULL')
      .all() as { legacy_atelier_id: number }[]).map(r => r.legacy_atelier_id)
  )
  const ateliers = db.prepare('SELECT * FROM ateliers').all() as AtelierRow[]

  const insAct = db.prepare(`
    INSERT INTO activites (type, sujet_id, titre, statut, anime_par, cree_par, legacy_atelier_id, cree_le)
    VALUES ('atelier', NULL, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
  `)
  const insPipe = db.prepare(`
    INSERT INTO atelier_pipeline
      (activite_id, numero, date_atelier, heure, lieu, facilitateur_id, source_choisie_id,
       nb_participants, compte_rendu, observations, observations_surprise, questions_restantes, mecanisme_identifie)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insAS = db.prepare('INSERT OR IGNORE INTO activite_sources (activite_id, source_id, ordre) VALUES (?, ?, ?)')
  const getSources = db.prepare('SELECT source_id, ordre FROM atelier_sources WHERE atelier_id = ?')

  let migrated = 0
  const tx = db.transaction(() => {
    for (const a of ateliers) {
      if (dejaMigres.has(a.id)) continue
      const r = insAct.run(`Atelier #${a.numero}`, a.statut, a.facilitateur_id, a.facilitateur_id, a.id, a.cree_le)
      const aid = Number(r.lastInsertRowid)
      insPipe.run(aid, a.numero, a.date_atelier, a.heure, a.lieu, a.facilitateur_id, a.source_choisie_id,
        a.nb_participants, a.compte_rendu, a.observations, a.observations_surprise, a.questions_restantes, a.mecanisme_identifie)
      for (const s of getSources.all(a.id) as { source_id: number; ordre: number }[]) {
        insAS.run(aid, s.source_id, s.ordre)
      }
      migrated++
    }
  })
  tx()
  return { migrated }
}

// Exécution directe
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = migrateActivites()
  console.log(`Migration activités : ${r.migrated} atelier(s) recopié(s) dans activites.`)
}
