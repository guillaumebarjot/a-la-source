/**
 * Routes Événements (Chantier C) — veille multisourcée.
 *
 * Un événement regroupe plusieurs sources traitant d'un même fait. La vue de
 * couverture met en regard les traitements de médias de propriétés
 * différentes (qui couvre, qui est absent, quels angles), sans noter.
 */
import { Router } from 'express'
import db from '../lib/db.js'

const router = Router()

// GET /api/evenements — liste avec nombre de sources et diversité de propriété
router.get('/', (_req, res) => {
  const evenements = db.prepare(`
    SELECT
      e.*,
      COUNT(DISTINCT s.id) AS nb_sources,
      COUNT(DISTINCT s.media_id) AS nb_medias,
      COUNT(DISTINCT m.type_propriete) AS nb_types_propriete
    FROM evenements e
    LEFT JOIN sources s ON s.evenement_id = e.id
    LEFT JOIN medias m ON m.id = s.media_id
    GROUP BY e.id
    ORDER BY COALESCE(e.date_evenement, e.cree_le) DESC
  `).all()
  res.json(evenements)
})

// GET /api/evenements/:id — détail + couverture (sources avec média et propriété)
router.get('/:id', (req, res) => {
  const evenement = db.prepare('SELECT * FROM evenements WHERE id = ?').get(req.params.id)
  if (!evenement) { res.status(404).json({ error: 'Evenement non trouve' }); return }

  const sources = db.prepare(`
    SELECT
      s.id, s.titre, s.url, s.accroche, s.date_publication, s.type_source,
      m.id AS media_id, m.nom AS media_nom,
      m.proprietaire, m.actionnaire_ultime, m.type_propriete, m.ligne_revendiquee
    FROM sources s
    LEFT JOIN medias m ON m.id = s.media_id
    WHERE s.evenement_id = ?
    ORDER BY s.date_publication
  `).all(req.params.id)

  res.json({ ...evenement, sources })
})

// POST /api/evenements — créer un événement
router.post('/', (req, res) => {
  const { titre, description, date_evenement, cree_par } = req.body
  if (!titre) { res.status(400).json({ error: 'Titre requis' }); return }
  const r = db.prepare(
    'INSERT INTO evenements (titre, description, date_evenement, cree_par) VALUES (?, ?, ?, ?)'
  ).run(titre, description || null, date_evenement || null, cree_par || null)
  res.status(201).json({ id: Number(r.lastInsertRowid) })
})

// PUT /api/evenements/:id — éditer
router.put('/:id', (req, res) => {
  const exists = db.prepare('SELECT id FROM evenements WHERE id = ?').get(req.params.id)
  if (!exists) { res.status(404).json({ error: 'Evenement non trouve' }); return }
  const { titre, description, date_evenement } = req.body
  db.prepare(`
    UPDATE evenements
    SET titre = COALESCE(?, titre),
        description = ?,
        date_evenement = ?
    WHERE id = ?
  `).run(titre ?? null, description ?? null, date_evenement ?? null, req.params.id)
  res.json(db.prepare('SELECT * FROM evenements WHERE id = ?').get(req.params.id))
})

// DELETE /api/evenements/:id — supprimer (détache les sources, ne les efface pas)
router.delete('/:id', (req, res) => {
  db.prepare('UPDATE sources SET evenement_id = NULL WHERE evenement_id = ?').run(req.params.id)
  db.prepare('DELETE FROM evenements WHERE id = ?').run(req.params.id)
  res.status(204).end()
})

// POST /api/evenements/:id/sources — rattacher une source { source_id }
router.post('/:id/sources', (req, res) => {
  const { source_id } = req.body
  if (!source_id) { res.status(400).json({ error: 'source_id requis' }); return }
  const ev = db.prepare('SELECT id FROM evenements WHERE id = ?').get(req.params.id)
  if (!ev) { res.status(404).json({ error: 'Evenement non trouve' }); return }
  const src = db.prepare('SELECT id FROM sources WHERE id = ?').get(source_id)
  if (!src) { res.status(404).json({ error: 'Source non trouvee' }); return }
  db.prepare('UPDATE sources SET evenement_id = ? WHERE id = ?').run(req.params.id, source_id)
  res.status(204).end()
})

// DELETE /api/evenements/:id/sources/:sourceId — détacher une source
router.delete('/:id/sources/:sourceId', (req, res) => {
  db.prepare('UPDATE sources SET evenement_id = NULL WHERE id = ? AND evenement_id = ?')
    .run(req.params.sourceId, req.params.id)
  res.status(204).end()
})

export default router
