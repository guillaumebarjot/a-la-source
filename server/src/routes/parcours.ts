import { Router } from 'express'
import db from '../lib/db.js'
import { requireRole } from '../lib/auth.js'

const router = Router()

// GET /api/parcours — liste des parcours, avec nb de questions
router.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.titre, p.description, p.cree_le,
           COUNT(q.id) AS nb_questions
    FROM parcours p
    LEFT JOIN parcours_questions q ON q.parcours_id = p.id
    GROUP BY p.id
    ORDER BY p.cree_le ASC
  `).all()
  res.json(rows)
})

// POST /api/parcours — creer un parcours (animateur / admin)
router.post('/', requireRole('animateur', 'admin'), (req, res) => {
  const { titre, description, questions } = req.body as {
    titre?: string
    description?: string
    questions?: { source_id: number; mecanisme_attendu_id: number; explication?: string }[]
  }
  if (!titre || !titre.trim()) { res.status(400).json({ error: 'titre requis' }); return }

  const insP = db.prepare('INSERT INTO parcours (titre, description, cree_par) VALUES (?, ?, ?)')
  const insQ = db.prepare(`
    INSERT INTO parcours_questions (parcours_id, ordre, source_id, mecanisme_attendu_id, explication)
    VALUES (?, ?, ?, ?, ?)
  `)
  const creer = db.transaction(() => {
    const pid = Number(insP.run(titre.trim(), description || null, req.user?.id ?? null).lastInsertRowid)
    if (Array.isArray(questions)) {
      questions.forEach((q, i) => {
        if (q && q.source_id && q.mecanisme_attendu_id) {
          insQ.run(pid, i + 1, q.source_id, q.mecanisme_attendu_id, q.explication || null)
        }
      })
    }
    return pid
  })
  const id = creer()
  res.status(201).json({ id })
})

// GET /api/parcours/:id — parcours + questions pour jouer.
// On NE revele PAS le mecanisme attendu ni l'explication : carte-source nue.
router.get('/:id', (req, res) => {
  const parcours = db.prepare(
    'SELECT id, titre, description FROM parcours WHERE id = ?'
  ).get(req.params.id) as { id: number; titre: string; description: string | null } | undefined
  if (!parcours) { res.status(404).json({ error: 'Parcours introuvable' }); return }

  // Carte-source NUE : image + titre + chapo, aucun indice du mecanisme.
  const questions = db.prepare(`
    SELECT q.id, q.ordre,
           s.id AS source_id, s.titre AS source_titre,
           s.accroche AS source_accroche, s.image_url AS source_image_url
    FROM parcours_questions q
    JOIN sources s ON s.id = q.source_id
    WHERE q.parcours_id = ?
    ORDER BY q.ordre ASC, q.id ASC
  `).all(parcours.id)

  // Choix proposes : tous les mecanismes de reference (le bon est noye dedans).
  const mecanismes = db.prepare(
    'SELECT id, nom, categorie FROM mecanismes_reference ORDER BY categorie, nom'
  ).all()

  res.json({ ...parcours, questions, mecanismes })
})

// POST /api/parcours/:id/sessions — demarre une session pour l'utilisateur courant
router.post('/:id/sessions', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'auth requise' }); return }
  const parcours = db.prepare('SELECT id FROM parcours WHERE id = ?').get(req.params.id) as { id: number } | undefined
  if (!parcours) { res.status(404).json({ error: 'Parcours introuvable' }); return }

  const total = (db.prepare(
    'SELECT COUNT(*) AS c FROM parcours_questions WHERE parcours_id = ?'
  ).get(parcours.id) as { c: number }).c

  const sid = Number(db.prepare(
    'INSERT INTO parcours_sessions (parcours_id, utilisateur_id, score, total) VALUES (?, ?, 0, ?)'
  ).run(parcours.id, req.user.id, total).lastInsertRowid)

  res.status(201).json({ session_id: sid, total })
})

// POST /api/parcours/sessions/:sid/reponses — enregistre une reponse et corrige
router.post('/sessions/:sid/reponses', (req, res) => {
  const { question_id, mecanisme_choisi_id } = req.body as {
    question_id?: number
    mecanisme_choisi_id?: number
  }
  if (!question_id || !mecanisme_choisi_id) {
    res.status(400).json({ error: 'question_id et mecanisme_choisi_id requis' }); return
  }

  const session = db.prepare(
    'SELECT id, parcours_id, score FROM parcours_sessions WHERE id = ?'
  ).get(req.params.sid) as { id: number; parcours_id: number; score: number } | undefined
  if (!session) { res.status(404).json({ error: 'Session introuvable' }); return }

  const question = db.prepare(`
    SELECT id, mecanisme_attendu_id, explication
    FROM parcours_questions
    WHERE id = ? AND parcours_id = ?
  `).get(question_id, session.parcours_id) as
    { id: number; mecanisme_attendu_id: number; explication: string | null } | undefined
  if (!question) { res.status(404).json({ error: 'Question introuvable dans ce parcours' }); return }

  const correct = mecanisme_choisi_id === question.mecanisme_attendu_id ? 1 : 0

  const attendu = db.prepare(
    'SELECT id, nom, categorie FROM mecanismes_reference WHERE id = ?'
  ).get(question.mecanisme_attendu_id) as { id: number; nom: string; categorie: string | null } | undefined

  // Insertion idempotente : on ne recompte pas le score si la question a deja ete repondue.
  const traiter = db.transaction(() => {
    const r = db.prepare(`
      INSERT OR IGNORE INTO parcours_reponses (session_id, question_id, mecanisme_choisi_id, correct)
      VALUES (?, ?, ?, ?)
    `).run(session.id, question.id, mecanisme_choisi_id, correct)
    if (r.changes > 0 && correct === 1) {
      db.prepare('UPDATE parcours_sessions SET score = score + 1 WHERE id = ?').run(session.id)
    }
  })
  traiter()

  // Cloture si toutes les questions ont une reponse.
  const restantes = (db.prepare(`
    SELECT COUNT(*) AS c FROM parcours_questions q
    WHERE q.parcours_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM parcours_reponses r WHERE r.session_id = ? AND r.question_id = q.id
      )
  `).get(session.parcours_id, session.id) as { c: number }).c
  if (restantes === 0) {
    db.prepare("UPDATE parcours_sessions SET termine_le = CURRENT_TIMESTAMP WHERE id = ? AND termine_le IS NULL")
      .run(session.id)
  }

  const etat = db.prepare(
    'SELECT score, total, termine_le FROM parcours_sessions WHERE id = ?'
  ).get(session.id) as { score: number; total: number; termine_le: string | null }

  res.json({
    correct: correct === 1,
    mecanisme_attendu: attendu || null,
    explication: question.explication,
    score: etat.score,
    total: etat.total,
    termine: etat.termine_le != null,
  })
})

// GET /api/parcours/sessions/:sid — etat / score d'une session
router.get('/sessions/:sid', (req, res) => {
  const session = db.prepare(`
    SELECT id, parcours_id, utilisateur_id, score, total, commence_le, termine_le
    FROM parcours_sessions WHERE id = ?
  `).get(req.params.sid)
  if (!session) { res.status(404).json({ error: 'Session introuvable' }); return }
  res.json(session)
})

export default router
