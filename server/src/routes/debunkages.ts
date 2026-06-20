/**
 * Routes Débunkages — activité d'éducation populaire aux médias.
 *
 * Un débunkage est porté par un adhérent (rôle 'membre' suffit) : il vise une
 * affirmation, construit une démonstration appuyée sur des sources (rôle pour /
 * contre), et publie le résultat sous forme de posts réseaux sociaux dont on
 * garde le lien. Adossé au socle `activites` (type 'debunkage') + extension
 * `debunkage_pipeline` + `debunkage_posts`.
 */
import { Router } from 'express'
import db from '../lib/db.js'
import { requireRole } from '../lib/auth.js'
import { debunkageVersYeswiki, type YeswikiSource } from '../lib/yeswiki.js'
import { notifierPublication } from '../discord/notify.js'

const router = Router()

// GET /api/debunkages — liste des activités de type débunkage
router.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      a.id, a.titre, a.statut AS statut_activite, a.sujet_id, a.cree_le, a.maj_le,
      p.statut, p.relaye_site,
      s.titre AS sujet_titre, s.slug AS sujet_slug,
      (SELECT COUNT(*) FROM debunkage_posts dp WHERE dp.activite_id = a.id) AS nb_posts,
      (SELECT COUNT(*) FROM activite_sources asr WHERE asr.activite_id = a.id) AS nb_sources
    FROM activites a
    LEFT JOIN debunkage_pipeline p ON p.activite_id = a.id
    LEFT JOIN sujets s ON s.id = a.sujet_id
    WHERE a.type = 'debunkage'
    ORDER BY a.maj_le DESC, a.cree_le DESC
  `).all()
  res.json(rows)
})

// GET /api/debunkages/:id — détail : activité + pipeline + posts + sources (avec rôle)
router.get('/:id', (req, res) => {
  const activite = db.prepare(`
    SELECT a.id, a.titre, a.type, a.statut AS statut_activite, a.sujet_id,
           a.anime_par, a.cree_par, a.cree_le, a.maj_le,
           s.titre AS sujet_titre, s.slug AS sujet_slug
    FROM activites a
    LEFT JOIN sujets s ON s.id = a.sujet_id
    WHERE a.id = ? AND a.type = 'debunkage'
  `).get(req.params.id) as { id: number } | undefined
  if (!activite) { res.status(404).json({ error: 'Debunkage non trouve' }); return }

  const pipeline = db.prepare('SELECT * FROM debunkage_pipeline WHERE activite_id = ?').get(activite.id)
  const posts = db.prepare(
    'SELECT * FROM debunkage_posts WHERE activite_id = ? ORDER BY publie_le DESC'
  ).all(activite.id)
  const sources = db.prepare(`
    SELECT s.id, s.titre, s.url, s.accroche, s.image_url, s.date_publication,
           m.nom AS media_nom, m.type_propriete,
           asr.role, asr.ordre, asr.note
    FROM activite_sources asr
    JOIN sources s ON s.id = asr.source_id
    LEFT JOIN medias m ON m.id = s.media_id
    WHERE asr.activite_id = ?
    ORDER BY asr.ordre, s.titre
  `).all(activite.id)

  res.json({ ...activite, pipeline, posts, sources })
})

// GET /api/debunkages/:id/yeswiki — export du débunkage en syntaxe YesWiki (text/plain)
// A coller dans une page becs-rouges.fr ou rouge-coquelicot.fr.
router.get('/:id/yeswiki', (req, res) => {
  const activite = db.prepare(
    "SELECT id, titre FROM activites WHERE id = ? AND type = 'debunkage'"
  ).get(req.params.id) as { id: number; titre: string } | undefined
  if (!activite) { res.status(404).json({ error: 'Debunkage non trouve' }); return }

  const pipeline = db.prepare(
    'SELECT affirmation_visee_md, demonstration_md FROM debunkage_pipeline WHERE activite_id = ?'
  ).get(activite.id) as { affirmation_visee_md: string | null; demonstration_md: string | null } | undefined

  const sources = db.prepare(`
    SELECT s.titre, s.url, m.nom AS media_nom, asr.role
    FROM activite_sources asr
    JOIN sources s ON s.id = asr.source_id
    LEFT JOIN medias m ON m.id = s.media_id
    WHERE asr.activite_id = ?
    ORDER BY asr.ordre, s.titre
  `).all(activite.id) as YeswikiSource[]

  const texte = debunkageVersYeswiki({
    titre: activite.titre,
    affirmation_visee_md: pipeline?.affirmation_visee_md ?? null,
    demonstration_md: pipeline?.demonstration_md ?? null,
    sources,
  })

  res.type('text/plain; charset=utf-8').send(texte)
})

// POST /api/debunkages — créer un débunkage (tout membre authentifié)
router.post('/', requireRole('membre', 'animateur', 'admin'), (req, res) => {
  const { titre, sujet_id, affirmation_visee_md, demonstration_md } = req.body
  if (!titre) { res.status(400).json({ error: 'Titre requis' }); return }

  const tx = db.transaction(() => {
    const r = db.prepare(`
      INSERT INTO activites (type, sujet_id, titre, statut, anime_par, cree_par)
      VALUES ('debunkage', ?, ?, 'brouillon', ?, ?)
    `).run(sujet_id || null, titre, req.user?.id || null, req.user?.id || null)
    const aid = Number(r.lastInsertRowid)
    db.prepare(`
      INSERT INTO debunkage_pipeline (activite_id, affirmation_visee_md, demonstration_md, statut, relaye_site)
      VALUES (?, ?, ?, 'brouillon', 0)
    `).run(aid, affirmation_visee_md || null, demonstration_md || null)
    return aid
  })
  const id = tx()
  res.status(201).json({ id })
})

// PUT /api/debunkages/:id — éditer affirmation / démonstration / relai site
router.put('/:id', (req, res) => {
  const exists = db.prepare(
    "SELECT 1 FROM activites WHERE id = ? AND type = 'debunkage'"
  ).get(req.params.id)
  if (!exists) { res.status(404).json({ error: 'Debunkage non trouve' }); return }

  const { titre, sujet_id, affirmation_visee_md, demonstration_md, relaye_site } = req.body

  const tx = db.transaction(() => {
    if (titre !== undefined || sujet_id !== undefined) {
      db.prepare(`
        UPDATE activites
        SET titre = COALESCE(?, titre), sujet_id = COALESCE(?, sujet_id), maj_le = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(titre ?? null, sujet_id ?? null, req.params.id)
    }
    // Assure l'existence de la ligne pipeline (robustesse) puis met à jour.
    db.prepare('INSERT OR IGNORE INTO debunkage_pipeline (activite_id) VALUES (?)').run(req.params.id)
    db.prepare(`
      UPDATE debunkage_pipeline
      SET affirmation_visee_md = COALESCE(?, affirmation_visee_md),
          demonstration_md = COALESCE(?, demonstration_md),
          relaye_site = COALESCE(?, relaye_site)
      WHERE activite_id = ?
    `).run(
      affirmation_visee_md ?? null,
      demonstration_md ?? null,
      relaye_site === undefined ? null : (relaye_site ? 1 : 0),
      req.params.id
    )
  })
  tx()

  res.json(db.prepare('SELECT * FROM debunkage_pipeline WHERE activite_id = ?').get(req.params.id))
})

// POST /api/debunkages/:id/publier — marquer le pipeline comme publié
router.post('/:id/publier', (req, res) => {
  const row = db.prepare(
    `SELECT a.titre, dp.statut FROM activites a
     LEFT JOIN debunkage_pipeline dp ON dp.activite_id = a.id
     WHERE a.id = ? AND a.type = 'debunkage'`
  ).get(req.params.id) as { titre: string; statut: string | null } | undefined
  if (!row) { res.status(404).json({ error: 'Debunkage non trouve' }); return }
  db.prepare('INSERT OR IGNORE INTO debunkage_pipeline (activite_id) VALUES (?)').run(req.params.id)
  db.prepare("UPDATE debunkage_pipeline SET statut = 'publie' WHERE activite_id = ?").run(req.params.id)
  db.prepare("UPDATE activites SET maj_le = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id)
  if (row.statut !== 'publie') {
    void notifierPublication({ type: 'Debunkage', titre: row.titre || 'Debunkage', chemin: `/debunkages/${req.params.id}` })
  }
  res.json(db.prepare('SELECT * FROM debunkage_pipeline WHERE activite_id = ?').get(req.params.id))
})

// POST /api/debunkages/:id/posts — consigner un lien de post { reseau, url }
router.post('/:id/posts', (req, res) => {
  const exists = db.prepare(
    "SELECT 1 FROM activites WHERE id = ? AND type = 'debunkage'"
  ).get(req.params.id)
  if (!exists) { res.status(404).json({ error: 'Debunkage non trouve' }); return }
  const { reseau, url } = req.body
  if (!url) { res.status(400).json({ error: 'url requise' }); return }
  const r = db.prepare(
    'INSERT INTO debunkage_posts (activite_id, reseau, url) VALUES (?, ?, ?)'
  ).run(req.params.id, reseau || 'autre', url)
  res.status(201).json(db.prepare('SELECT * FROM debunkage_posts WHERE id = ?').get(Number(r.lastInsertRowid)))
})

// DELETE /api/debunkages/:id/posts/:postId — retirer un lien de post
router.delete('/:id/posts/:postId', (req, res) => {
  db.prepare('DELETE FROM debunkage_posts WHERE id = ? AND activite_id = ?')
    .run(req.params.postId, req.params.id)
  res.status(204).end()
})

// POST /api/debunkages/:id/sources — rattacher une source { source_id, role }
router.post('/:id/sources', (req, res) => {
  const exists = db.prepare(
    "SELECT 1 FROM activites WHERE id = ? AND type = 'debunkage'"
  ).get(req.params.id)
  if (!exists) { res.status(404).json({ error: 'Debunkage non trouve' }); return }
  const { source_id, role } = req.body
  if (!source_id) { res.status(400).json({ error: 'source_id requis' }); return }
  db.prepare(`
    INSERT INTO activite_sources (activite_id, source_id, role)
    VALUES (?, ?, ?)
    ON CONFLICT(activite_id, source_id) DO UPDATE SET role = excluded.role
  `).run(req.params.id, source_id, role || null)
  res.status(204).end()
})

// DELETE /api/debunkages/:id/sources/:sourceId — détacher une source
router.delete('/:id/sources/:sourceId', (req, res) => {
  db.prepare('DELETE FROM activite_sources WHERE activite_id = ? AND source_id = ?')
    .run(req.params.id, req.params.sourceId)
  res.status(204).end()
})

export default router
