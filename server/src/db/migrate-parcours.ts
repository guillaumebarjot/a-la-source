/**
 * Migration — Parcours / Quiz (cursus d'apprentissage)
 *
 * Un parcours est une suite de questions construites sur des sources reelles.
 * Pour chaque question, on montre une carte-source NUE (image + titre + chapo)
 * et on demande a l'apprenant : « Quel mecanisme est a l'oeuvre ? ». La reponse
 * est choisie parmi les mecanismes de reference, puis corrigee avec une
 * explication. Les sessions mesurent la progression (score / total).
 *
 * Tables :
 *   - parcours            : le cursus (titre, description, auteur)
 *   - parcours_questions  : une question = une source + un mecanisme attendu + explication
 *   - parcours_sessions   : une tentative d'un utilisateur (score, total, fin)
 *   - parcours_reponses   : chaque reponse donnee (mecanisme choisi, correct ?)
 *
 * ADDITIF, NON DESTRUCTIF, IDEMPOTENT (CREATE TABLE IF NOT EXISTS).
 * Genere un parcours par defaut a partir de source_mecanismes SI des donnees
 * existent et SI aucun parcours n'a encore ete cree.
 */
import db from '../lib/db.js'

export function migrateParcours(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS parcours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titre TEXT NOT NULL,
      description TEXT,
      cree_par INTEGER REFERENCES utilisateurs(id),
      cree_le DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS parcours_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parcours_id INTEGER NOT NULL REFERENCES parcours(id) ON DELETE CASCADE,
      ordre INTEGER NOT NULL DEFAULT 0,
      source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      mecanisme_attendu_id INTEGER NOT NULL REFERENCES mecanismes_reference(id),
      explication TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_parcours_questions_parcours ON parcours_questions(parcours_id);
    CREATE TABLE IF NOT EXISTS parcours_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parcours_id INTEGER NOT NULL REFERENCES parcours(id) ON DELETE CASCADE,
      utilisateur_id INTEGER REFERENCES utilisateurs(id),
      score INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      commence_le DATETIME DEFAULT CURRENT_TIMESTAMP,
      termine_le DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_parcours_sessions_parcours ON parcours_sessions(parcours_id);
    CREATE TABLE IF NOT EXISTS parcours_reponses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES parcours_sessions(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES parcours_questions(id) ON DELETE CASCADE,
      mecanisme_choisi_id INTEGER REFERENCES mecanismes_reference(id),
      correct INTEGER DEFAULT 0,
      repondu_le DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, question_id)
    );
    CREATE INDEX IF NOT EXISTS idx_parcours_reponses_session ON parcours_reponses(session_id);
  `)

  // Generation d'un parcours par defaut a partir des identifications reelles,
  // une seule fois (si aucun parcours et si des donnees existent).
  const nbParcours = (db.prepare('SELECT COUNT(*) AS c FROM parcours').get() as { c: number }).c
  if (nbParcours === 0) {
    genererParcoursParDefaut()
  }
}

/**
 * Construit un parcours « decouverte » a partir de source_mecanismes :
 * on prend jusqu'a 10 sources distinctes ayant un mecanisme identifie, et on en
 * fait autant de questions. La justification reelle sert d'explication.
 * Ne cree rien s'il n'y a pas de donnees exploitables.
 */
function genererParcoursParDefaut(): number | null {
  const lignes = db.prepare(`
    SELECT sm.source_id, sm.mecanisme_id,
           sm.justification, sm.extrait, MIN(sm.identifie_le) AS le
    FROM source_mecanismes sm
    JOIN sources s ON s.id = sm.source_id
    GROUP BY sm.source_id
    ORDER BY le ASC
    LIMIT 10
  `).all() as { source_id: number; mecanisme_id: number; justification: string | null; extrait: string | null }[]

  if (lignes.length === 0) return null

  const insParcours = db.prepare(
    'INSERT INTO parcours (titre, description) VALUES (?, ?)'
  )
  const insQuestion = db.prepare(`
    INSERT INTO parcours_questions (parcours_id, ordre, source_id, mecanisme_attendu_id, explication)
    VALUES (?, ?, ?, ?, ?)
  `)

  const creer = db.transaction(() => {
    const pid = Number(insParcours.run(
      'Decouverte des mecanismes',
      "Un premier parcours pour entrainer l'oeil : sur chaque source, devinez quel mecanisme est a l'oeuvre."
    ).lastInsertRowid)
    lignes.forEach((l, i) => {
      const explication = l.justification && l.justification.trim().length > 0
        ? l.justification
        : (l.extrait || null)
      insQuestion.run(pid, i + 1, l.source_id, l.mecanisme_id, explication)
    })
    return pid
  })

  const pid = creer()
  console.log(`  auto-seed parcours: 1 parcours genere (${lignes.length} question(s))`)
  return pid
}

// Execution directe
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateParcours()
  console.log('Migration parcours : schema a jour.')
}
