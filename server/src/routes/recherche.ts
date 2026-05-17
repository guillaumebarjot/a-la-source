import { Router } from 'express'
import db from '../lib/db.js'

const router = Router()

// GET /api/recherche?q=terme
router.get('/', (req, res) => {
  const q = req.query.q as string
  if (!q || q.trim().length < 2) return res.json([])

  const results = db.prepare(`
    SELECT s.id, s.titre, s.accroche, s.date_publication, s.type_source,
           m.nom as media_nom,
           snippet(sources_fts, 2, '<mark>', '</mark>', '...', 40) as extrait
    FROM sources_fts
    JOIN sources s ON s.id = sources_fts.rowid
    LEFT JOIN medias m ON s.media_id = m.id
    WHERE sources_fts MATCH ?
    ORDER BY rank
    LIMIT 20
  `).all(q.trim())

  res.json(results)
})

export default router
