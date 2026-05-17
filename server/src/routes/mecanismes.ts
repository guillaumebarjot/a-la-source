import { Router } from 'express'
import db from '../lib/db.js'

const router = Router()

// GET /api/mecanismes — liste de reference
router.get('/', (_req, res) => {
  const mecanismes = db.prepare('SELECT * FROM mecanismes_reference ORDER BY nom').all()
  res.json(mecanismes)
})

// POST /api/mecanismes/identifier — identifier un mecanisme sur une source
router.post('/identifier', (req, res) => {
  const { source_id, mecanisme_id, justification, extrait } = req.body
  if (!source_id || !mecanisme_id || !req.user) {
    res.status(400).json({ error: 'source_id, mecanisme_id et auth requis' }); return
  }

  db.prepare(`
    INSERT INTO source_mecanismes (source_id, mecanisme_id, identifie_par, justification, extrait)
    VALUES (?, ?, ?, ?, ?)
  `).run(source_id, mecanisme_id, req.user.id, justification || null, extrait || null)

  res.status(201).json({ ok: true })
})

// GET /api/mecanismes/stats — stats pour la page Decrypter
router.get('/stats', (_req, res) => {
  const stats = db.prepare(`
    SELECT mr.id, mr.nom, mr.description, COUNT(sm.id) as nb_sources
    FROM mecanismes_reference mr
    LEFT JOIN source_mecanismes sm ON sm.mecanisme_id = mr.id
    GROUP BY mr.id
    ORDER BY nb_sources DESC
  `).all()
  res.json(stats)
})

export default router
