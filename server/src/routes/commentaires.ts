import { Router } from 'express'
import db from '../lib/db.js'

const router = Router()

// GET /api/commentaires/:sourceId
router.get('/:sourceId', (req, res) => {
  const commentaires = db.prepare(`
    SELECT c.*, u.nom as auteur_nom
    FROM commentaires c
    LEFT JOIN utilisateurs u ON c.auteur_id = u.id
    WHERE c.source_id = ?
    ORDER BY c.cree_le DESC
  `).all(req.params.sourceId)
  res.json(commentaires)
})

// POST /api/commentaires
router.post('/', (req, res) => {
  const { source_id, contenu, type, url } = req.body
  if (!source_id || !contenu || !req.user) {
    res.status(400).json({ error: 'source_id, contenu et auth requis' }); return
  }

  const r = db.prepare(`
    INSERT INTO commentaires (source_id, auteur_id, type, contenu, url)
    VALUES (?, ?, ?, ?, ?)
  `).run(source_id, req.user.id, type || 'commentaire', contenu, url || null)

  res.status(201).json({ id: Number(r.lastInsertRowid) })
})

// DELETE /api/commentaires/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM commentaires WHERE id = ? AND auteur_id = ?').run(
    req.params.id, req.user?.id
  )
  res.json({ ok: true })
})

export default router
