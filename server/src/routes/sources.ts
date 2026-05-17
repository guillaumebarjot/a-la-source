import { Router } from 'express'
import multer from 'multer'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, renameSync, unlinkSync } from 'fs'
import db from '../lib/db.js'
import { calculerScoreSource } from '../lib/score.js'
import { fetchOpenGraph } from '../lib/opengraph.js'
import { extractReadability, detecterArchivePartielle, compterMots } from '../lib/readability.js'
import { findSiteConfig, getSiteConfigCount, getConfiguredDomains } from '../lib/ftr-site-config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const uploadsDir = join(__dirname, '..', '..', '..', 'uploads')

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.md', '.pdf', '.html', '.htm', '.txt', '.png', '.jpg', '.jpeg', '.webp']
    const ext = extname(file.originalname).toLowerCase()
    cb(null, allowed.includes(ext))
  },
})

const router = Router()

// GET /api/sources — liste avec filtres
router.get('/', (req, res) => {
  const { statut, type_source, media, tag, sans_archive, ordre, limit = '50', offset = '0' } = req.query

  let sql = `
    SELECT s.*, m.nom as media_nom, a.nom as auteur_nom,
      (SELECT COUNT(*) FROM archives ar WHERE ar.source_id = s.id) > 0 as has_archive,
      (SELECT ar2.statut FROM archives ar2 WHERE ar2.source_id = s.id ORDER BY ar2.cree_le DESC LIMIT 1) as archive_statut,
      (SELECT COUNT(*) FROM commentaires c WHERE c.source_id = s.id) as nb_commentaires,
      (SELECT COUNT(*) FROM atelier_sources ats WHERE ats.source_id = s.id) as nb_ateliers
    FROM sources s
    LEFT JOIN medias m ON s.media_id = m.id
    LEFT JOIN auteurs a ON s.auteur_id = a.id
  `
  const conditions: string[] = []
  const params: unknown[] = []

  if (statut) { conditions.push('s.statut = ?'); params.push(statut) }
  if (type_source) { conditions.push('s.type_source = ?'); params.push(type_source) }
  if (media) { conditions.push('m.nom = ?'); params.push(media) }
  if (sans_archive === '1') {
    conditions.push('(SELECT COUNT(*) FROM archives ar WHERE ar.source_id = s.id) = 0')
  }
  if (tag) {
    sql += ' JOIN source_tags st ON st.source_id = s.id JOIN tags t ON t.id = st.tag_id'
    conditions.push('t.nom = ?'); params.push(tag)
  }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
  if (ordre === 'consultations') {
    sql += ' ORDER BY nb_commentaires DESC, s.soumis_le DESC'
  } else {
    sql += ' ORDER BY s.soumis_le DESC'
  }
  sql += ' LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))

  const sources = db.prepare(sql).all(...params)
  res.json(sources)
})

// GET /api/sources/top-evaluees — top 10 sources par richesse pedagogique
router.get('/top-evaluees', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      s.id,
      s.titre,
      s.url,
      m.nom as media_nom,
      COUNT(DISTINCT sm.id) as nb_mecanismes,
      COUNT(DISTINCT e.id) as nb_evaluations,
      COUNT(DISTINCT c.id) as nb_commentaires,
      (COUNT(DISTINCT sm.id) * 3 + COUNT(DISTINCT e.id) * 2 + COUNT(DISTINCT c.id)) as score_richesse
    FROM sources s
    LEFT JOIN medias m ON m.id = s.media_id
    LEFT JOIN source_mecanismes sm ON sm.source_id = s.id
    LEFT JOIN evaluations e ON e.source_id = s.id
    LEFT JOIN commentaires c ON c.source_id = s.id
    GROUP BY s.id
    HAVING score_richesse > 0
    ORDER BY score_richesse DESC
    LIMIT 10
  `).all()
  res.json(rows)
})

// GET /api/sources/archives-partielles — sources avec archive incomplete
router.get('/archives-partielles', (_req, res) => {
  const rows = db.prepare(`
    SELECT s.*, m.nom as media_nom,
      ar.statut as archive_statut, ar.nb_mots as archive_nb_mots, ar.cree_le as archive_date
    FROM sources s
    LEFT JOIN medias m ON s.media_id = m.id
    INNER JOIN archives ar ON ar.source_id = s.id
    WHERE ar.statut = 'partielle'
    AND ar.id = (SELECT MAX(a2.id) FROM archives a2 WHERE a2.source_id = s.id)
    ORDER BY s.date_publication DESC
  `).all()
  res.json(rows)
})

// GET /api/sources/ftr-config — info sur les configs d'extraction par site
router.get('/ftr-config', (_req, res) => {
  res.json({
    count: getSiteConfigCount(),
    domains: getConfiguredDomains(),
  })
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
    source.date_publication as string | null,
    source.type_source as string | null
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
  const allowed = ['titre', 'url', 'type_source', 'date_publication', 'paywall', 'accroche', 'statut', 'image_url', 'duree_estimee', 'viralite_qualitative', 'viralite_chiffre', 'timing_override']
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
  const source = db.prepare('SELECT url, paywall FROM sources WHERE id = ?').get(req.params.id) as { url: string; paywall: number } | undefined
  if (!source?.url) { res.status(400).json({ error: 'Pas d\'URL' }); return }

  const article = await extractReadability(source.url)
  if (!article) { res.status(422).json({ error: 'Extraction impossible' }); return }

  const nbMots = compterMots(article.content)
  const statut = detecterArchivePartielle(article.textContent, source.paywall)

  db.prepare(`
    INSERT INTO archives (source_id, type, contenu, cree_par, nb_mots, statut)
    VALUES (?, 'readability', ?, ?, ?, ?)
  `).run(req.params.id, article.content, req.user?.id || null, nbMots, statut)

  res.json({ ok: true, title: article.title, excerpt: article.excerpt, statut, nbMots })
})

// POST /api/sources/:id/archive-manuelle — l'utilisateur colle le contenu complet
router.post('/:id/archive-manuelle', (req, res) => {
  const { contenu, type = 'html' } = req.body
  if (!contenu || typeof contenu !== 'string') { res.status(400).json({ error: 'Contenu requis' }); return }

  const nbMots = compterMots(contenu)
  db.prepare(`
    INSERT INTO archives (source_id, type, contenu, cree_par, nb_mots, statut)
    VALUES (?, ?, ?, ?, ?, 'complete')
  `).run(req.params.id, type, contenu, req.user?.id || null, nbMots)

  res.json({ ok: true, nbMots })
})

// POST /api/sources/:id/archive-fichier — upload d'un fichier (pdf, md, html, image)
router.post('/:id/archive-fichier', upload.single('fichier'), (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'Fichier requis' }); return }

  const ext = extname(req.file.originalname).toLowerCase()
  const isImage = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext)
  const isPdf = ext === '.pdf'
  const isMd = ext === '.md'

  let type: string
  if (isPdf) type = 'pdf'
  else if (isMd) type = 'markdown'
  else if (isImage) type = 'html'
  else type = 'html'

  // For text files, read content inline; for binary (pdf/image), store path
  let contenu: string | null = null
  let chemin: string | null = null

  if (isPdf || isImage) {
    const newName = `archive-${req.params.id}-${Date.now()}${ext}`
    const newPath = join(uploadsDir, newName)
    renameSync(req.file.path, newPath)
    chemin = `uploads/${newName}`
  } else {
    contenu = readFileSync(req.file.path, 'utf-8')
    unlinkSync(req.file.path)
  }

  const nbMots = contenu ? compterMots(contenu) : null
  db.prepare(`
    INSERT INTO archives (source_id, type, contenu, chemin, cree_par, nb_mots, statut)
    VALUES (?, ?, ?, ?, ?, ?, 'complete')
  `).run(req.params.id, type, contenu, chemin, req.user?.id || null, nbMots)

  res.json({ ok: true, type, nbMots })
})

// POST /api/sources/:id/signaler-archive — signaler une archive incomplete
router.post('/:id/signaler-archive', (req, res) => {
  const { raison } = req.body
  const archive = db.prepare(`
    SELECT id FROM archives WHERE source_id = ? ORDER BY cree_le DESC LIMIT 1
  `).get(req.params.id) as { id: number } | undefined

  if (!archive) { res.status(404).json({ error: 'Pas d\'archive' }); return }

  // Marquer l'archive comme partielle
  db.prepare(`UPDATE archives SET statut = 'partielle' WHERE id = ?`).run(archive.id)

  // Enregistrer le signalement
  db.prepare(`
    INSERT INTO archive_signalements (archive_id, signale_par, raison)
    VALUES (?, ?, ?)
  `).run(archive.id, req.user?.id || null, raison || null)

  res.json({ ok: true })
})


// DELETE /api/sources/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM sources WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
