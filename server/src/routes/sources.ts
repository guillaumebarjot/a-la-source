import { Router } from 'express'
import db from '../lib/db.js'
import { calculerScoreSource } from '../lib/score.js'
import { fetchOpenGraph } from '../lib/opengraph.js'
import { extractReadability } from '../lib/readability.js'

const router = Router()

// GET /api/sources — liste avec filtres
router.get('/', (req, res) => {
  const { statut, type_source, media, tag, limit = '50', offset = '0' } = req.query

  let sql = `
    SELECT s.*, m.nom as media_nom, a.nom as auteur_nom
    FROM sources s
    LEFT JOIN medias m ON s.media_id = m.id
    LEFT JOIN auteurs a ON s.auteur_id = a.id
  `
  const conditions: string[] = []
  const params: unknown[] = []

  if (statut) { conditions.push('s.statut = ?'); params.push(statut) }
  if (type_source) { conditions.push('s.type_source = ?'); params.push(type_source) }
  if (media) { conditions.push('m.nom = ?'); params.push(media) }
  if (tag) {
    sql += ' JOIN source_tags st ON st.source_id = s.id JOIN tags t ON t.id = st.tag_id'
    conditions.push('t.nom = ?'); params.push(tag)
  }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ' ORDER BY s.soumis_le DESC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))

  const sources = db.prepare(sql).all(...params)
  res.json(sources)
})

// GET /api/sources/:id — detail avec score, tags, mecanismes
router.get('/:id', (req, res) => {
  const source = db.prepare(`
    SELECT s.*, m.nom as media_nom, a.nom as auteur_nom
    FROM sources s
    LEFT JOIN medias m ON s.media_id = m.id
    LEFT JOIN auteurs a ON s.auteur_id = a.id
    WHERE s.id = ?
  `).get(req.params.id) as Record<string, unknown> | undefined

  if (!source) { res.status(404).json({ error: 'Source introuvable' }); return }

  const tags = db.prepare(`
    SELECT t.* FROM tags t JOIN source_tags st ON st.tag_id = t.id WHERE st.source_id = ?
  `).all(req.params.id)

  const mecanismes = db.prepare(`
    SELECT sm.*, mr.nom as mecanisme_nom, mr.description as mecanisme_description,
           u.nom as identifie_par_nom
    FROM source_mecanismes sm
    JOIN mecanismes_reference mr ON sm.mecanisme_id = mr.id
    LEFT JOIN utilisateurs u ON sm.identifie_par = u.id
    WHERE sm.source_id = ?
  `).all(req.params.id)

  const archive = db.prepare(
    'SELECT * FROM archives WHERE source_id = ? ORDER BY cree_le DESC LIMIT 1'
  ).get(req.params.id)

  const score = calculerScoreSource(
    Number(req.params.id),
    source.date_publication as string | null
  )

  res.json({ ...source, tags, mecanismes, archive, score })
})

// POST /api/sources — creer une source
router.post('/', async (req, res) => {
  const { titre, url, type_source, media_nom, auteur_nom, date_publication, paywall, accroche } = req.body

  if (!titre) { res.status(400).json({ error: 'Titre requis' }); return }

  // Find or create media
  let media_id: number | null = null
  if (media_nom) {
    const existing = db.prepare('SELECT id FROM medias WHERE nom = ?').get(media_nom) as { id: number } | undefined
    if (existing) {
      media_id = existing.id
    } else {
      const r = db.prepare('INSERT INTO medias (nom) VALUES (?)').run(media_nom)
      media_id = Number(r.lastInsertRowid)
    }
  }

  // Find or create auteur
  let auteur_id: number | null = null
  if (auteur_nom) {
    const existing = db.prepare(
      'SELECT id FROM auteurs WHERE nom = ? AND (media_id = ? OR media_id IS NULL)'
    ).get(auteur_nom, media_id) as { id: number } | undefined
    if (existing) {
      auteur_id = existing.id
    } else {
      const r = db.prepare('INSERT INTO auteurs (nom, media_id) VALUES (?, ?)').run(auteur_nom, media_id)
      auteur_id = Number(r.lastInsertRowid)
    }
  }

  const result = db.prepare(`
    INSERT INTO sources (titre, url, auteur_id, media_id, type_source, date_publication, paywall, accroche, soumis_par)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(titre, url || null, auteur_id, media_id, type_source || null, date_publication || null, paywall ? 1 : 0, accroche || null, req.user?.id || null)

  const sourceId = Number(result.lastInsertRowid)

  // Fetch OG image in background
  if (url) {
    fetchOpenGraph(url).then(og => {
      if (og.image) {
        db.prepare('UPDATE sources SET image_url = ? WHERE id = ?').run(og.image, sourceId)
      }
    }).catch(() => {})
  }

  res.status(201).json({ id: sourceId })
})

// PATCH /api/sources/:id — modifier statut ou champs
router.patch('/:id', (req, res) => {
  const allowed = ['titre', 'url', 'type_source', 'date_publication', 'paywall', 'accroche', 'statut', 'image_url']
  const updates: string[] = []
  const params: unknown[] = []

  for (const [key, value] of Object.entries(req.body)) {
    if (allowed.includes(key)) {
      updates.push(`${key} = ?`)
      params.push(value)
    }
  }

  if (updates.length === 0) { res.status(400).json({ error: 'Rien a modifier' }); return }

  params.push(req.params.id)
  db.prepare(`UPDATE sources SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  res.json({ ok: true })
})

// POST /api/sources/:id/archiver — archivage readability
router.post('/:id/archiver', async (req, res) => {
  const source = db.prepare('SELECT url FROM sources WHERE id = ?').get(req.params.id) as { url: string } | undefined
  if (!source?.url) { res.status(400).json({ error: 'Pas d\'URL' }); return }

  const article = await extractReadability(source.url)
  if (!article) { res.status(422).json({ error: 'Extraction impossible' }); return }

  db.prepare(`
    INSERT INTO archives (source_id, type, contenu, cree_par)
    VALUES (?, 'readability', ?, ?)
  `).run(req.params.id, article.content, req.user?.id || null)

  res.json({ ok: true, title: article.title, excerpt: article.excerpt })
})

// DELETE /api/sources/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM sources WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
