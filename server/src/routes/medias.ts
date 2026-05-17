import { Router } from 'express'
import db from '../lib/db.js'

const router = Router()

// GET /api/medias
router.get('/', (_req, res) => {
  const medias = db.prepare(`
    SELECT m.*, COUNT(s.id) as nb_sources
    FROM medias m
    LEFT JOIN sources s ON s.media_id = m.id
    GROUP BY m.id
    ORDER BY nb_sources DESC
  `).all()
  res.json(medias)
})

// GET /api/medias/:id/stats — stats d'un media (confiance agregee)
router.get('/:id/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(DISTINCT s.id) as nb_sources,
      AVG(e.score_echo) as moy_echo,
      AVG(e.score_pedagogie) as moy_pedagogie,
      COUNT(DISTINCT e.id) as nb_evaluations
    FROM sources s
    LEFT JOIN evaluations e ON e.source_id = s.id
    WHERE s.media_id = ?
  `).get(req.params.id)
  res.json(stats)
})

// POST /api/medias
router.post('/', (req, res) => {
  const { nom, type, url_site } = req.body
  if (!nom) { res.status(400).json({ error: 'Nom requis' }); return }
  const r = db.prepare('INSERT OR IGNORE INTO medias (nom, type, url_site) VALUES (?, ?, ?)').run(nom, type || null, url_site || null)
  res.status(201).json({ id: Number(r.lastInsertRowid) })
})

export default router
