import { Router } from 'express'
import db from '../lib/db.js'
import { requireRole } from '../lib/auth.js'
import { calculerScoreSource } from '../lib/score.js'

const router = Router()

// GET /api/ateliers
router.get('/', (_req, res) => {
  const ateliers = db.prepare('SELECT * FROM ateliers ORDER BY numero DESC').all()
  res.json(ateliers)
})

// GET /api/ateliers/vivier — sources au vivier avec scores + tags
router.get('/vivier', (_req, res) => {
  const sources = db.prepare(`
    SELECT s.*, m.nom as media_nom
    FROM sources s
    LEFT JOIN medias m ON s.media_id = m.id
    WHERE s.statut = 'vivier'
    ORDER BY s.soumis_le DESC
  `).all() as Array<Record<string, unknown>>

  const result = sources.map(s => {
    const tags = db.prepare(`
      SELECT t.id, t.nom, t.couleur, t.categorie
      FROM tags t JOIN source_tags st ON st.tag_id = t.id
      WHERE st.source_id = ?
    `).all(s.id as number) as Array<{ id: number; nom: string; couleur: string | null; categorie: string }>
    return {
      ...s,
      tags,
      score: calculerScoreSource(s.id as number, s.date_publication as string | null, s.type_source as string | null)
    }
  })

  // Sort by score descending
  result.sort((a, b) => b.score.scoreTotal - a.score.scoreTotal)
  res.json(result)
})

// GET /api/ateliers/en-cours — atelier en preparation (ou null)
router.get('/en-cours', (_req, res) => {
  const atelier = db.prepare("SELECT * FROM ateliers WHERE statut = 'preparation' ORDER BY cree_le DESC LIMIT 1").get()
  if (!atelier) { res.json(null); return }

  const sources = db.prepare(`
    SELECT s.*, m.nom as media_nom
    FROM atelier_sources as2
    JOIN sources s ON s.id = as2.source_id
    LEFT JOIN medias m ON s.media_id = m.id
    WHERE as2.atelier_id = ? AND as2.retiree_le IS NULL
  `).all((atelier as { id: number }).id)

  res.json({ ...(atelier as Record<string, unknown>), sources })
})

// GET /api/ateliers/:id
router.get('/:id', (req, res) => {
  const atelier = db.prepare('SELECT * FROM ateliers WHERE id = ?').get(req.params.id)
  if (!atelier) { res.status(404).json({ error: 'Atelier introuvable' }); return }

  const sources = db.prepare(`
    SELECT s.*, m.nom as media_nom
    FROM atelier_sources as2
    JOIN sources s ON s.id = as2.source_id
    LEFT JOIN medias m ON s.media_id = m.id
    WHERE as2.atelier_id = ? AND as2.retiree_le IS NULL
  `).all(req.params.id)

  res.json({ ...atelier, sources })
})

// POST /api/ateliers — creer un atelier (animateur+)
router.post('/', requireRole('animateur', 'admin'), (req, res) => {
  const { numero, date_atelier, lieu } = req.body
  if (!numero) { res.status(400).json({ error: 'Numero requis' }); return }

  const r = db.prepare(`
    INSERT INTO ateliers (numero, date_atelier, lieu) VALUES (?, ?, ?)
  `).run(numero, date_atelier || null, lieu || null)
  res.status(201).json({ id: Number(r.lastInsertRowid) })
})

// POST /api/ateliers/:id/sources — ajouter source a un atelier
router.post('/:id/sources', requireRole('animateur', 'admin'), (req, res) => {
  const { source_id } = req.body
  db.prepare('INSERT OR IGNORE INTO atelier_sources (atelier_id, source_id) VALUES (?, ?)').run(
    req.params.id, source_id
  )
  // Passe la source en statut atelier
  db.prepare("UPDATE sources SET statut = 'atelier' WHERE id = ?").run(source_id)
  res.json({ ok: true })
})

// DELETE /api/ateliers/:id/sources/:sourceId — retirer source de l'atelier
router.delete('/:id/sources/:sourceId', requireRole('animateur', 'admin'), (req, res) => {
  db.prepare(
    "UPDATE atelier_sources SET retiree_le = CURRENT_TIMESTAMP WHERE atelier_id = ? AND source_id = ?"
  ).run(req.params.id, req.params.sourceId)
  // Repasse la source au vivier
  db.prepare("UPDATE sources SET statut = 'vivier' WHERE id = ?").run(req.params.sourceId)
  res.json({ ok: true })
})

// PATCH /api/ateliers/:id
router.patch('/:id', requireRole('animateur', 'admin'), (req, res) => {
  const allowed = ['statut', 'source_choisie_id', 'nb_participants', 'compte_rendu', 'observations', 'mecanisme_identifie']
  const updates: string[] = []
  const params: unknown[] = []

  for (const [key, value] of Object.entries(req.body)) {
    if (allowed.includes(key)) { updates.push(`${key} = ?`); params.push(value) }
  }

  if (updates.length === 0) { res.status(400).json({ error: 'Rien a modifier' }); return }
  params.push(req.params.id)
  db.prepare(`UPDATE ateliers SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  res.json({ ok: true })
})

export default router
