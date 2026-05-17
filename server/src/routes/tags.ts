import { Router } from 'express'
import db from '../lib/db.js'

const router = Router()

// GET /api/tags
router.get('/', (_req, res) => {
  const tags = db.prepare('SELECT * FROM tags ORDER BY nom').all()
  res.json(tags)
})

// POST /api/tags
router.post('/', (req, res) => {
  const { nom, couleur, categorie } = req.body
  if (!nom) { res.status(400).json({ error: 'Nom requis' }); return }
  const r = db.prepare('INSERT OR IGNORE INTO tags (nom, couleur, categorie) VALUES (?, ?, ?)').run(nom, couleur || null, categorie || 'libre')
  res.status(201).json({ id: Number(r.lastInsertRowid) })
})

// POST /api/sources/:sourceId/tags
router.post('/source/:sourceId', (req, res) => {
  const { tag_nom } = req.body
  if (!tag_nom) { res.status(400).json({ error: 'tag_nom requis' }); return }

  // Find or create tag
  let tag = db.prepare('SELECT id FROM tags WHERE nom = ?').get(tag_nom) as { id: number } | undefined
  if (!tag) {
    const r = db.prepare('INSERT INTO tags (nom) VALUES (?)').run(tag_nom)
    tag = { id: Number(r.lastInsertRowid) }
  }

  db.prepare('INSERT OR IGNORE INTO source_tags (source_id, tag_id, ajoute_par) VALUES (?, ?, ?)').run(
    req.params.sourceId, tag.id, req.user?.id || null
  )
  res.json({ ok: true, tag_id: tag.id })
})

// DELETE /api/sources/:sourceId/tags/:tagId
router.delete('/source/:sourceId/:tagId', (req, res) => {
  db.prepare('DELETE FROM source_tags WHERE source_id = ? AND tag_id = ?').run(
    req.params.sourceId, req.params.tagId
  )
  res.json({ ok: true })
})

export default router
