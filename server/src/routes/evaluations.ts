import { Router } from 'express'
import db from '../lib/db.js'

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

// POST /api/evaluations
router.post('/', (req, res) => {
  const { source_id, score_echo, score_pedagogie, commentaire } = req.body
  if (!source_id || !req.user) { res.status(400).json({ error: 'source_id et auth requis' }); return }

  db.prepare(`
    INSERT INTO evaluations (source_id, evaluateur_id, score_echo, score_pedagogie, commentaire)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(source_id, evaluateur_id) DO UPDATE SET
      score_echo = excluded.score_echo,
      score_pedagogie = excluded.score_pedagogie,
      commentaire = excluded.commentaire,
      evaluee_le = CURRENT_TIMESTAMP
  `).run(source_id, req.user.id, score_echo || 0, score_pedagogie || 0, commentaire || null)

  res.json({ ok: true })
})

export default router
