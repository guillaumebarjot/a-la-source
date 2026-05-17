import { Router } from 'express'
import db from '../lib/db.js'

const router = Router()

// GET /api/contenus/:cle
router.get('/:cle', (req, res) => {
  const contenu = db.prepare('SELECT * FROM contenus WHERE cle = ?').get(req.params.cle)
  if (!contenu) { res.status(404).json({ error: 'Contenu introuvable' }); return }
  res.json(contenu)
})

// PUT /api/contenus/:cle
router.put('/:cle', (req, res) => {
  const { titre, contenu } = req.body
  db.prepare(`
    INSERT INTO contenus (cle, titre, contenu) VALUES (?, ?, ?)
    ON CONFLICT(cle) DO UPDATE SET titre = excluded.titre, contenu = excluded.contenu, modifie_le = CURRENT_TIMESTAMP
  `).run(req.params.cle, titre || null, contenu || '')
  res.json({ ok: true })
})

export default router
