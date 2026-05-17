import { Router } from 'express'
import db from '../lib/db.js'

const router = Router()

// GET /api/mecanismes — liste complete
router.get('/', (_req, res) => {
  const mecanismes = db.prepare(`
    SELECT id, nom, slug, description, categorie, categorie_label, categorie_description
    FROM mecanismes_reference ORDER BY categorie, nom
  `).all()
  res.json(mecanismes)
})

// GET /api/mecanismes/categories — categories distinctes
router.get('/categories', (_req, res) => {
  const cats = db.prepare(`
    SELECT categorie, categorie_label, categorie_description, COUNT(*) as nb
    FROM mecanismes_reference
    GROUP BY categorie
    ORDER BY categorie_label
  `).all()
  res.json(cats)
})

// GET /api/mecanismes/stats — stats pour Observatoire
router.get('/stats', (_req, res) => {
  const stats = db.prepare(`
    SELECT mr.id, mr.nom, mr.slug, mr.description, COUNT(sm.id) as nb_sources
    FROM mecanismes_reference mr
    LEFT JOIN source_mecanismes sm ON sm.mecanisme_id = mr.id
    GROUP BY mr.id
    ORDER BY nb_sources DESC
  `).all()
  res.json(stats)
})

// GET /api/mecanismes/timeline — identifications par mois
router.get('/timeline', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m', sm.identifie_le) as mois,
      sm.mecanisme_id,
      mr.nom as mecanisme_nom,
      COUNT(sm.id) as nb
    FROM source_mecanismes sm
    JOIN mecanismes_reference mr ON mr.id = sm.mecanisme_id
    WHERE sm.identifie_le IS NOT NULL
    GROUP BY mois, sm.mecanisme_id
    ORDER BY mois ASC, nb DESC
  `).all()
  res.json(rows)
})

// GET /api/mecanismes/categorie/:cat — mecanismes d'une categorie
router.get('/categorie/:cat', (req, res) => {
  const mecas = db.prepare(`
    SELECT id, nom, slug, description, exemple, categorie, categorie_label, categorie_description
    FROM mecanismes_reference
    WHERE categorie = ?
    ORDER BY nom
  `).all(req.params.cat)
  if (mecas.length === 0) { res.status(404).json({ error: 'Categorie introuvable' }); return }
  res.json(mecas)
})

// GET /api/mecanismes/fiche/:slug — fiche complete d'un mecanisme
router.get('/fiche/:slug', (req, res) => {
  const m = db.prepare(`
    SELECT * FROM mecanismes_reference WHERE slug = ?
  `).get(req.params.slug)
  if (!m) { res.status(404).json({ error: 'Mecanisme introuvable' }); return }
  res.json(m)
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

export default router
