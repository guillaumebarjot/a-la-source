import { Router } from 'express'
import multer from 'multer'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, renameSync, unlinkSync } from 'fs'
import db from '../lib/db.js'
import { requireRole } from '../lib/auth.js'
import { calculerScoreSource } from '../lib/score.js'
import { fetchOpenGraph } from '../lib/opengraph.js'
import { extractReadability, detecterArchivePartielle, compterMots } from '../lib/readability.js'
import { extrairePdfTexte } from '../lib/pdftext.js'
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
  const { statut, type_source, media, tag, sans_archive, commentees, ordre, limit = '50', offset = '0' } = req.query

  let sql = `
    SELECT s.*, m.nom as media_nom, a.nom as auteur_nom, u.nom as soumis_par_nom,
      (SELECT COUNT(*) FROM archives ar WHERE ar.source_id = s.id) > 0 as has_archive,
      (SELECT ar2.statut FROM archives ar2 WHERE ar2.source_id = s.id ORDER BY ar2.cree_le DESC LIMIT 1) as archive_statut,
      (SELECT COUNT(*) FROM commentaires c WHERE c.source_id = s.id) as nb_commentaires,
      (SELECT COUNT(*) FROM activite_sources asrc
         JOIN activites act ON act.id = asrc.activite_id AND act.type = 'atelier'
       WHERE asrc.source_id = s.id) as nb_ateliers
    FROM sources s
    LEFT JOIN medias m ON s.media_id = m.id
    LEFT JOIN auteurs a ON s.auteur_id = a.id
    LEFT JOIN utilisateurs u ON u.id = s.soumis_par
  `
  const conditions: string[] = []
  const params: unknown[] = []

  if (statut) { conditions.push('s.statut = ?'); params.push(statut) }
  if (type_source) { conditions.push('s.type_source = ?'); params.push(type_source) }
  if (media) { conditions.push('m.nom = ?'); params.push(media) }
  if (sans_archive === '1') {
    conditions.push('(SELECT COUNT(*) FROM archives ar WHERE ar.source_id = s.id) = 0')
  }
  // Filtre veille : sources deja commentees (discutees) ou pas encore (a traiter).
  if (commentees === 'oui') {
    conditions.push('(SELECT COUNT(*) FROM commentaires c WHERE c.source_id = s.id) > 0')
  } else if (commentees === 'non') {
    conditions.push('(SELECT COUNT(*) FROM commentaires c WHERE c.source_id = s.id) = 0')
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

// GET /api/sources/sans-copie-locale — sources sans copie locale du texte integral,
// hors video/audio (on n'archive pas le texte d'une video ou d'une emission radio).
// Lecture seule. Placee AVANT la route parametree /:id.
//
// « Copie locale » = la source dispose du texte integral, soit via une archive
// readability/markdown/pdf/html marquee 'complete', soit via le marqueur
// completude = 'integral_offline'. Une source SANS copie locale n'a ni l'une ni l'autre.
//
// Exclusion video/audio : la colonne canonique est sources.type_source ('video','radio').
// On complete par le type du media (tv/radio) et une heuristique d'URL (plateformes
// audiovisuelles) pour rattraper les sources dont le type_source n'aurait pas ete renseigne.
router.get('/sans-copie-locale', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      s.id, s.titre, s.url, s.image_url, s.date_publication, s.accroche,
      s.completude, s.type_source, s.paywall,
      m.nom as media_nom,
      (SELECT COUNT(*) FROM archives ar WHERE ar.source_id = s.id) > 0 as has_archive,
      (SELECT ar2.statut FROM archives ar2 WHERE ar2.source_id = s.id ORDER BY ar2.cree_le DESC LIMIT 1) as archive_statut
    FROM sources s
    LEFT JOIN medias m ON s.media_id = m.id
    WHERE NOT (
      s.completude = 'integral_offline'
      OR EXISTS (
        SELECT 1 FROM archives ar WHERE ar.source_id = s.id AND ar.statut = 'complete'
      )
    )
    AND (s.type_source IS NULL OR s.type_source NOT IN ('video', 'radio'))
    AND (m.type IS NULL OR LOWER(m.type) NOT IN ('tv', 'radio'))
    AND NOT (
      COALESCE(s.url, '') LIKE '%youtube.com%' OR COALESCE(s.url, '') LIKE '%youtu.be%'
      OR COALESCE(s.url, '') LIKE '%vimeo.%' OR COALESCE(s.url, '') LIKE '%dailymotion.%'
      OR COALESCE(s.url, '') LIKE '%soundcloud.%' OR COALESCE(s.url, '') LIKE '%spotify.%'
      OR COALESCE(s.url, '') LIKE '%podcast%'
    )
    ORDER BY s.date_publication DESC, s.soumis_le DESC
  `).all()
  res.json(rows)
})

// GET /api/sources/inbox — sources entrantes a qualifier (inbox)
// Placee AVANT la route parametree /:id pour ne pas etre avalee par celle-ci.
router.get('/inbox', (_req, res) => {
  const rows = db.prepare(`
    SELECT s.*, m.nom as media_nom
    FROM sources s
    LEFT JOIN medias m ON s.media_id = m.id
    WHERE s.a_qualifier = 1
    ORDER BY s.soumis_le DESC
  `).all()
  res.json(rows)
})

// GET /api/sources/:id — detail avec score, tags, mecanismes
router.get('/:id', (req, res) => {
  const source = db.prepare(`
    SELECT s.*, m.nom as media_nom, a.nom as auteur_nom, u.nom as soumis_par_nom
    FROM sources s
    LEFT JOIN medias m ON s.media_id = m.id
    LEFT JOIN auteurs a ON s.auteur_id = a.id
    LEFT JOIN utilisateurs u ON u.id = s.soumis_par
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

// POST /api/sources/from-url — creation simplifiee : auto-fetch metadata + archive
router.post('/from-url', async (req, res) => {
  const { url } = req.body
  if (!url) { res.status(400).json({ error: 'URL requise' }); return }

  // 1. Fetch OpenGraph metadata
  const og = await fetchOpenGraph(url)
  const titre = og.title || new URL(url).hostname
  const accroche = og.description || null

  // 2. Match or create media from og:site_name
  let media_id: number | null = null
  let media_nom: string | null = null
  if (og.siteName) {
    const existing = db.prepare('SELECT id, nom FROM medias WHERE nom = ? COLLATE NOCASE').get(og.siteName) as { id: number; nom: string } | undefined
    if (existing) {
      media_id = existing.id
      media_nom = existing.nom
    } else {
      // Try matching by domain
      try {
        const domain = new URL(url).hostname.replace('www.', '')
        const byUrl = db.prepare("SELECT id, nom FROM medias WHERE url_site LIKE ?").get(`%${domain}%`) as { id: number; nom: string } | undefined
        if (byUrl) {
          media_id = byUrl.id
          media_nom = byUrl.nom
        } else {
          const r = db.prepare('INSERT INTO medias (nom) VALUES (?)').run(og.siteName)
          media_id = Number(r.lastInsertRowid)
          media_nom = og.siteName
        }
      } catch {
        const r = db.prepare('INSERT INTO medias (nom) VALUES (?)').run(og.siteName)
        media_id = Number(r.lastInsertRowid)
        media_nom = og.siteName
      }
    }
  } else {
    // Fallback: match by domain
    try {
      const domain = new URL(url).hostname.replace('www.', '')
      const byUrl = db.prepare("SELECT id, nom FROM medias WHERE url_site LIKE ?").get(`%${domain}%`) as { id: number; nom: string } | undefined
      if (byUrl) {
        media_id = byUrl.id
        media_nom = byUrl.nom
      }
    } catch { /* ignore */ }
  }

  // 3. Match or create auteur
  let auteur_id: number | null = null
  let auteur_nom: string | null = null
  if (og.author) {
    auteur_nom = og.author
    const existing = db.prepare(
      'SELECT id FROM auteurs WHERE nom = ? AND (media_id = ? OR media_id IS NULL)'
    ).get(og.author, media_id) as { id: number } | undefined
    if (existing) {
      auteur_id = existing.id
    } else {
      const r = db.prepare('INSERT INTO auteurs (nom, media_id) VALUES (?, ?)').run(og.author, media_id)
      auteur_id = Number(r.lastInsertRowid)
    }
  }

  // 4. Insert source. `a_qualifier` (Inbox) et `completude` peuvent être fournis
  // (ex. veille autonome qui dépose en Inbox à qualifier avec complétude 'libre').
  const result = db.prepare(`
    INSERT INTO sources (titre, url, auteur_id, media_id, date_publication, paywall, accroche, mots_cles, image_url, soumis_par, a_qualifier, completude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    titre, url, auteur_id, media_id,
    og.datePublished || null,
    og.paywall ? 1 : 0,
    accroche,
    og.keywords ? og.keywords.join(', ') : null,
    og.image || null,
    req.user?.id || null,
    req.body.a_qualifier ? 1 : 0,
    typeof req.body.completude === 'string' ? req.body.completude : null
  )
  const sourceId = Number(result.lastInsertRowid)

  // 5. Trigger archivage in background
  extractReadability(url).then(article => {
    if (!article) return
    const nbMots = compterMots(article.content)
    const paywall = db.prepare('SELECT paywall FROM sources WHERE id = ?').get(sourceId) as { paywall: number } | undefined
    const statut = detecterArchivePartielle(article.textContent, paywall?.paywall || 0)
    db.prepare(`
      INSERT INTO archives (source_id, type, contenu, cree_par, nb_mots, statut)
      VALUES (?, 'readability', ?, ?, ?, ?)
    `).run(sourceId, article.content, req.user?.id || null, nbMots, statut)
    // Update keywords if we got more from readability
    if (article.motsCles.length > 0) {
      const existing = db.prepare('SELECT mots_cles FROM sources WHERE id = ?').get(sourceId) as { mots_cles: string | null } | undefined
      if (!existing?.mots_cles) {
        db.prepare('UPDATE sources SET mots_cles = ? WHERE id = ?').run(article.motsCles.join(', '), sourceId)
      }
    }
  }).catch(() => {})

  // 6. Return enriched data for preview
  res.status(201).json({
    id: sourceId,
    titre,
    url,
    media_nom,
    auteur_nom,
    date_publication: og.datePublished || null,
    paywall: og.paywall || false,
    accroche,
    mots_cles: og.keywords ? og.keywords.join(', ') : null,
    image_url: og.image || null,
    archivage: 'en_cours',
  })
})

// POST /api/sources/preview-url — preview metadata without creating
router.post('/preview-url', async (req, res) => {
  const { url } = req.body
  if (!url) { res.status(400).json({ error: 'URL requise' }); return }

  const og = await fetchOpenGraph(url)

  // Match media
  let media_nom: string | null = null
  if (og.siteName) {
    const existing = db.prepare('SELECT nom FROM medias WHERE nom = ? COLLATE NOCASE').get(og.siteName) as { nom: string } | undefined
    media_nom = existing?.nom || og.siteName
  } else {
    try {
      const domain = new URL(url).hostname.replace('www.', '')
      const byUrl = db.prepare("SELECT nom FROM medias WHERE url_site LIKE ?").get(`%${domain}%`) as { nom: string } | undefined
      if (byUrl) media_nom = byUrl.nom
    } catch { /* ignore */ }
  }

  res.json({
    titre: og.title || null,
    media_nom,
    auteur_nom: og.author || null,
    date_publication: og.datePublished || null,
    paywall: og.paywall || false,
    accroche: og.description || null,
    mots_cles: og.keywords ? og.keywords.join(', ') : null,
    image_url: og.image || null,
  })
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
  const allowed = ['titre', 'url', 'type_source', 'date_publication', 'paywall', 'accroche', 'statut', 'image_url', 'duree_estimee', 'viralite_qualitative', 'viralite_chiffre', 'timing_override', 'completude']
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

  // URL alternative : lien original/accessible fourni par le contributeur quand la source est paywallée.
  // On archive depuis ce lien ; le contenu obtenu est alors réputé complet (paywall contourné).
  const altUrl = typeof req.body?.url === 'string' && req.body.url.trim() ? req.body.url.trim() : null
  const targetUrl = altUrl || source.url

  const article = await extractReadability(targetUrl)
  if (!article) { res.status(422).json({ error: 'Extraction impossible' }); return }

  const nbMots = compterMots(article.content)
  const statut = detecterArchivePartielle(article.textContent, altUrl ? 0 : source.paywall)

  // Store extracted keywords
  if (article.motsCles.length > 0) {
    try {
      db.prepare('UPDATE sources SET mots_cles = ? WHERE id = ?').run(article.motsCles.join(', '), req.params.id)
    } catch { /* column may not exist yet */ }
  }

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
router.post('/:id/archive-fichier', upload.single('fichier'), async (req, res) => {
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
    // PDF : on garde le fichier ET on extrait le texte pour une lecture facile.
    if (isPdf) contenu = (await extrairePdfTexte(readFileSync(newPath))) || null
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


// POST /api/sources/:id/qualifier — sortir une source de l'inbox (a_qualifier = 0).
// Body optionnel { statut } pour router vers veille | vivier | atelier | archive.
router.post('/:id/qualifier', (req, res) => {
  const source = db.prepare('SELECT id FROM sources WHERE id = ?').get(req.params.id) as { id: number } | undefined
  if (!source) { res.status(404).json({ error: 'Source introuvable' }); return }

  const statutsValides = ['veille', 'vivier', 'atelier', 'archive']
  const statut = typeof req.body?.statut === 'string' && statutsValides.includes(req.body.statut)
    ? req.body.statut
    : 'veille'

  db.prepare('UPDATE sources SET a_qualifier = 0, statut = ? WHERE id = ?').run(statut, req.params.id)
  res.json({ ok: true, statut })
})

// POST /api/sources/:id/rejeter — ecarter une source de l'inbox.
// Choix retenu : non destructif. On sort de l'inbox (a_qualifier = 0) et on classe
// la source en 'archive' ; rien n'est supprime, la trace est conservee.
router.post('/:id/rejeter', (req, res) => {
  const source = db.prepare('SELECT id FROM sources WHERE id = ?').get(req.params.id) as { id: number } | undefined
  if (!source) { res.status(404).json({ error: 'Source introuvable' }); return }

  db.prepare("UPDATE sources SET a_qualifier = 0, statut = 'archive' WHERE id = ?").run(req.params.id)
  res.json({ ok: true })
})

// DELETE /api/sources/:id (animateur/admin only)
router.delete('/:id', requireRole('animateur', 'admin'), (req, res) => {
  db.prepare('DELETE FROM sources WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
