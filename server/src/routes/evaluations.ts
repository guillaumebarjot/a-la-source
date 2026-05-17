import { Router } from 'express'
import db from '../lib/db.js'
import { calculerScoreSource } from '../lib/score.js'

const router = Router()

// GET /api/evaluations/:sourceId
router.get('/:sourceId', (req, res) => {
  const evals = db.prepare(`
    SELECT e.*, u.nom as evaluateur_nom
    FROM evaluations e
    JOIN utilisateurs u ON e.evaluateur_id = u.id
    WHERE e.source_id = ?
  `).all(req.params.sourceId)
  res.json(evals)
})

// GET /api/evaluations/:sourceId/score — score complet calcule
router.get('/:sourceId/score', (req, res) => {
  const source = db.prepare('SELECT date_publication, type_source FROM sources WHERE id = ?').get(req.params.sourceId) as {
    date_publication: string | null; type_source: string | null
  } | undefined
  if (!source) return res.status(404).json({ error: 'Source introuvable' })

  const score = calculerScoreSource(
    parseInt(req.params.sourceId),
    source.date_publication,
    source.type_source
  )
  res.json(score)
})

// POST /api/evaluations — creer/mettre a jour une evaluation
router.post('/', (req, res) => {
  const { source_id, score_echo, score_pedagogie, complexite, bonus_expert, resonance, commentaire } = req.body
  if (!source_id || !req.user) { res.status(400).json({ error: 'source_id et auth requis' }); return }

  db.prepare(`
    INSERT INTO evaluations (source_id, evaluateur_id, score_echo, score_pedagogie, complexite, bonus_expert, resonance, commentaire)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_id, evaluateur_id) DO UPDATE SET
      score_echo = excluded.score_echo,
      score_pedagogie = excluded.score_pedagogie,
      complexite = excluded.complexite,
      bonus_expert = excluded.bonus_expert,
      resonance = excluded.resonance,
      commentaire = excluded.commentaire,
      evaluee_le = CURRENT_TIMESTAMP
  `).run(
    source_id,
    req.user.id,
    score_echo || 0,
    score_pedagogie || 0,
    complexite || 0,
    bonus_expert || 0,
    resonance || 0,
    commentaire || null
  )

  res.json({ ok: true })
})

export default router
