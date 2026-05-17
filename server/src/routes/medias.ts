import { Router } from 'express'
import db from '../lib/db.js'
import { calculerConfianceMedia } from '../lib/score.js'

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

// GET /api/medias/matrice — croise media x mecanisme
router.get('/matrice', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      s.media_id,
      m.nom as media_nom,
      sm.mecanisme_id,
      mr.nom as mecanisme_nom,
      COUNT(sm.id) as nb
    FROM source_mecanismes sm
    JOIN sources s ON s.id = sm.source_id
    JOIN medias m ON m.id = s.media_id
    JOIN mecanismes_reference mr ON mr.id = sm.mecanisme_id
    WHERE s.media_id IS NOT NULL
    GROUP BY s.media_id, sm.mecanisme_id
    ORDER BY m.nom, mr.nom
  `).all()
  res.json(rows)
})

// GET /api/medias/confiance — score de confiance par media
router.get('/confiance', (_req, res) => {
  const medias = db.prepare('SELECT id, nom FROM medias').all() as { id: number; nom: string }[]
  const results = medias.map(m => {
    const conf = calculerConfianceMedia(m.id)
    return { media_id: m.id, media_nom: m.nom, ...conf }
  }).filter(r => r.nbSources > 0)
    .sort((a, b) => a.score - b.score)
  res.json(results)
})

// POST /api/medias
router.post('/', (req, res) => {
  const { nom, type, url_site } = req.body
  if (!nom) { res.status(400).json({ error: 'Nom requis' }); return }
  const r = db.prepare('INSERT OR IGNORE INTO medias (nom, type, url_site) VALUES (?, ?, ?)').run(nom, type || null, url_site || null)
  res.status(201).json({ id: Number(r.lastInsertRowid) })
})

export default router
