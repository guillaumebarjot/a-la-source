/**
 * Routes Sujets (Chantier S) — refonte par sujets.
 *
 * Le Sujet est l'objet pivot éditorial : un thème durable qui agrège la veille
 * (sources), la couverture (événements) et les activités. On entre par les
 * sujets (façon GroundNews), la veille devient un substrat.
 *
 * Gouvernance : tout membre peut proposer un sujet (statut 'propose') ; la
 * publication ('publie') est réservée aux animateur·ices et admins.
 */
import { Router } from 'express'
import db from '../lib/db.js'
import { requireRole } from '../lib/auth.js'
import { sujetVersYeswiki, type YeswikiSource, type YeswikiSujetEvenement } from '../lib/yeswiki.js'

const router = Router()

function slugify(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// GET /api/sujets — liste, avec nombres de sources, d'événements et de médias couvrant
router.get('/', (req, res) => {
  const { statut } = req.query
  const where = statut ? 'WHERE s.statut = ?' : ''
  const rows = db.prepare(`
    SELECT
      s.*,
      (SELECT COUNT(*) FROM sujet_sources ss WHERE ss.sujet_id = s.id) AS nb_sources,
      (SELECT COUNT(*) FROM sujet_evenements se WHERE se.sujet_id = s.id) AS nb_evenements
    FROM sujets s
    ${where}
    ORDER BY s.statut = 'publie' DESC, s.titre
  `).all(...(statut ? [statut] : []))
  res.json(rows)
})

// GET /api/sujets/:idOrSlug/yeswiki — export du thème en syntaxe YesWiki (text/plain)
// Place AVANT /:idOrSlug pour l'expressivite ; A coller dans une page YesWiki.
router.get('/:idOrSlug/yeswiki', (req, res) => {
  const key = req.params.idOrSlug
  const sujet = db.prepare(
    `SELECT id, titre, accroche, description_md FROM sujets WHERE ${/^\d+$/.test(key) ? 'id' : 'slug'} = ?`
  ).get(key) as { id: number; titre: string; accroche: string | null; description_md: string | null } | undefined
  if (!sujet) { res.status(404).json({ error: 'Sujet non trouve' }); return }

  const sources = db.prepare(`
    SELECT s.titre, s.url, m.nom AS media_nom, NULL AS role
    FROM sujet_sources ss
    JOIN sources s ON s.id = ss.source_id
    LEFT JOIN medias m ON m.id = s.media_id
    WHERE ss.sujet_id = ?
    ORDER BY s.date_publication DESC
  `).all(sujet.id) as YeswikiSource[]

  const evenements = db.prepare(`
    SELECT e.titre, e.date_evenement
    FROM sujet_evenements se
    JOIN evenements e ON e.id = se.evenement_id
    WHERE se.sujet_id = ?
    ORDER BY COALESCE(e.date_evenement, e.cree_le) DESC
  `).all(sujet.id) as YeswikiSujetEvenement[]

  const texte = sujetVersYeswiki({
    titre: sujet.titre,
    accroche: sujet.accroche ?? null,
    description_md: sujet.description_md ?? null,
    sources,
    evenements,
  })

  res.type('text/plain; charset=utf-8').send(texte)
})

// GET /api/sujets/:idOrSlug — détail + sources + événements rattachés
router.get('/:idOrSlug', (req, res) => {
  const key = req.params.idOrSlug
  const sujet = db.prepare(
    `SELECT * FROM sujets WHERE ${/^\d+$/.test(key) ? 'id' : 'slug'} = ?`
  ).get(key) as { id: number } | undefined
  if (!sujet) { res.status(404).json({ error: 'Sujet non trouve' }); return }

  const sources = db.prepare(`
    SELECT s.id, s.titre, s.url, s.accroche, s.image_url, s.date_publication,
           m.nom AS media_nom, m.type_propriete
    FROM sujet_sources ss
    JOIN sources s ON s.id = ss.source_id
    LEFT JOIN medias m ON m.id = s.media_id
    WHERE ss.sujet_id = ?
    ORDER BY s.date_publication DESC
  `).all(sujet.id)

  // Couverture (geste GroundNews) : par événement, combien de médias le couvrent
  // et combien de types de propriété différents (diversité de la couverture).
  const evenements = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(DISTINCT s.media_id) FROM sources s WHERE s.evenement_id = e.id) AS nb_medias,
      (SELECT COUNT(DISTINCT m.type_propriete)
         FROM sources s LEFT JOIN medias m ON m.id = s.media_id
         WHERE s.evenement_id = e.id AND m.type_propriete IS NOT NULL) AS nb_types_propriete
    FROM sujet_evenements se
    JOIN evenements e ON e.id = se.evenement_id
    WHERE se.sujet_id = ?
    ORDER BY COALESCE(e.date_evenement, e.cree_le) DESC
  `).all(sujet.id)

  res.json({ ...sujet, sources, evenements })
})

// POST /api/sujets — proposer un sujet (tout membre authentifié)
router.post('/', (req, res) => {
  const { titre, accroche, description_md, image_url, couleur } = req.body
  if (!titre) { res.status(400).json({ error: 'Titre requis' }); return }
  let slug = slugify(titre)
  // Unicité du slug : suffixe incrémental si collision
  const exists = db.prepare('SELECT 1 FROM sujets WHERE slug = ?')
  let i = 2
  let candidate = slug
  while (exists.get(candidate)) { candidate = `${slug}-${i++}` }
  slug = candidate

  const r = db.prepare(`
    INSERT INTO sujets (slug, titre, accroche, description_md, image_url, couleur, statut, cree_par)
    VALUES (?, ?, ?, ?, ?, ?, 'propose', ?)
  `).run(slug, titre, accroche || null, description_md || null, image_url || null, couleur || null, req.user?.id || null)
  res.status(201).json({ id: Number(r.lastInsertRowid), slug })
})

// PUT /api/sujets/:id — éditer le contenu éditorial
router.put('/:id', (req, res) => {
  const exists = db.prepare('SELECT id FROM sujets WHERE id = ?').get(req.params.id)
  if (!exists) { res.status(404).json({ error: 'Sujet non trouve' }); return }
  const { titre, accroche, description_md, image_url, couleur } = req.body
  db.prepare(`
    UPDATE sujets
    SET titre = COALESCE(?, titre),
        accroche = ?, description_md = ?, image_url = ?, couleur = ?,
        maj_le = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(titre ?? null, accroche ?? null, description_md ?? null, image_url ?? null, couleur ?? null, req.params.id)
  res.json(db.prepare('SELECT * FROM sujets WHERE id = ?').get(req.params.id))
})

// POST /api/sujets/:id/publier — publier (animateur·ice / admin)
router.post('/:id/publier', requireRole('animateur', 'admin'), (req, res) => {
  const exists = db.prepare('SELECT id FROM sujets WHERE id = ?').get(req.params.id)
  if (!exists) { res.status(404).json({ error: 'Sujet non trouve' }); return }
  db.prepare(`UPDATE sujets SET statut = 'publie', valide_par = ?, maj_le = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(req.user?.id || null, req.params.id)
  res.json(db.prepare('SELECT * FROM sujets WHERE id = ?').get(req.params.id))
})

// DELETE /api/sujets/:id — supprimer (animateur·ice / admin) ; les rattachements tombent en cascade
router.delete('/:id', requireRole('animateur', 'admin'), (req, res) => {
  db.prepare('DELETE FROM sujets WHERE id = ?').run(req.params.id)
  res.status(204).end()
})

// POST /api/sujets/:id/sources — rattacher une source { source_id }
router.post('/:id/sources', (req, res) => {
  const { source_id } = req.body
  if (!source_id) { res.status(400).json({ error: 'source_id requis' }); return }
  db.prepare('INSERT OR IGNORE INTO sujet_sources (sujet_id, source_id) VALUES (?, ?)')
    .run(req.params.id, source_id)
  res.status(204).end()
})

// DELETE /api/sujets/:id/sources/:sourceId — détacher une source
router.delete('/:id/sources/:sourceId', (req, res) => {
  db.prepare('DELETE FROM sujet_sources WHERE sujet_id = ? AND source_id = ?')
    .run(req.params.id, req.params.sourceId)
  res.status(204).end()
})

// POST /api/sujets/:id/evenements — rattacher un événement { evenement_id }
router.post('/:id/evenements', (req, res) => {
  const { evenement_id } = req.body
  if (!evenement_id) { res.status(400).json({ error: 'evenement_id requis' }); return }
  db.prepare('INSERT OR IGNORE INTO sujet_evenements (sujet_id, evenement_id) VALUES (?, ?)')
    .run(req.params.id, evenement_id)
  res.status(204).end()
})

// DELETE /api/sujets/:id/evenements/:evenementId — détacher un événement
router.delete('/:id/evenements/:evenementId', (req, res) => {
  db.prepare('DELETE FROM sujet_evenements WHERE sujet_id = ? AND evenement_id = ?')
    .run(req.params.id, req.params.evenementId)
  res.status(204).end()
})

export default router
