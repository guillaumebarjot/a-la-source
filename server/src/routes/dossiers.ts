/**
 * Routes Dossiers — activité d'éducation populaire aux médias.
 *
 * Le dossier est un format de fond sur un thème : mise en perspective, sources
 * de référence et mécanismes récurrents. Le DÉCRYPTAGE n'est pas un type
 * distinct : c'est un dossier daté « à chaud » (flag a_chaud) rattaché à un
 * événement (evenement_id). Adossé au socle `activites` (type 'dossier') +
 * extension `dossier_contenu` + `activite_sources` (rôle de la source).
 *
 * Gouvernance : tout membre authentifié peut créer et éditer un dossier ; la
 * publication marque le statut de l'activité.
 */
import { Router } from 'express'
import db from '../lib/db.js'
import { requireRole } from '../lib/auth.js'
import { dossierVersYeswiki, type YeswikiSource } from '../lib/yeswiki.js'
import { notifierPublication } from '../discord/notify.js'

const router = Router()

// GET /api/dossiers — liste des activités de type dossier (avec sujet et flag à chaud)
router.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      a.id, a.titre, a.statut AS statut_activite, a.sujet_id, a.cree_le, a.maj_le,
      c.a_chaud, c.evenement_id,
      s.titre AS sujet_titre, s.slug AS sujet_slug,
      e.titre AS evenement_titre, e.date_evenement,
      (SELECT COUNT(*) FROM activite_sources asr WHERE asr.activite_id = a.id) AS nb_sources
    FROM activites a
    LEFT JOIN dossier_contenu c ON c.activite_id = a.id
    LEFT JOIN sujets s ON s.id = a.sujet_id
    LEFT JOIN evenements e ON e.id = c.evenement_id
    WHERE a.type = 'dossier'
    ORDER BY a.maj_le DESC, a.cree_le DESC
  `).all()
  res.json(rows)
})

// GET /api/dossiers/:id — détail : activité + contenu + sources (avec rôle)
router.get('/:id', (req, res) => {
  const activite = db.prepare(`
    SELECT a.id, a.titre, a.type, a.statut AS statut_activite, a.sujet_id,
           a.anime_par, a.cree_par, a.cree_le, a.maj_le,
           s.titre AS sujet_titre, s.slug AS sujet_slug
    FROM activites a
    LEFT JOIN sujets s ON s.id = a.sujet_id
    WHERE a.id = ? AND a.type = 'dossier'
  `).get(req.params.id) as { id: number } | undefined
  if (!activite) { res.status(404).json({ error: 'Dossier non trouve' }); return }

  const contenu = db.prepare(`
    SELECT c.activite_id, c.contenu_md, c.mise_en_perspective_md, c.a_chaud, c.evenement_id,
           e.titre AS evenement_titre, e.date_evenement
    FROM dossier_contenu c
    LEFT JOIN evenements e ON e.id = c.evenement_id
    WHERE c.activite_id = ?
  `).get(activite.id)
  const sources = db.prepare(`
    SELECT s.id, s.titre, s.url, s.accroche, s.image_url, s.date_publication,
           m.nom AS media_nom, m.type_propriete,
           asr.role, asr.ordre, asr.note
    FROM activite_sources asr
    JOIN sources s ON s.id = asr.source_id
    LEFT JOIN medias m ON m.id = s.media_id
    WHERE asr.activite_id = ?
    ORDER BY asr.ordre, s.titre
  `).all(activite.id) as Array<{ id: number }>

  // Jalons de completude FACTUELS (chantier #1, tunnelisation §3.2). Booleens
  // deduits de la presence de donnees, jamais d'un score. Aucun n'est bloquant :
  // ils alimentent le stepper et l'encart « prochaine action » cote client.
  const c = contenu as {
    mise_en_perspective_md?: string | null
    contenu_md?: string | null
  } | undefined
  const a = activite as { sujet_id?: number | null; statut_activite?: string }
  const jalons = {
    a_sujet: a.sujet_id != null,
    a_mise_en_perspective: !!(c?.mise_en_perspective_md && c.mise_en_perspective_md.trim()),
    a_corpus: sources.length > 0,
    a_contenu: !!(c?.contenu_md && c.contenu_md.trim()),
    est_publie: a.statut_activite === 'publie',
  }

  res.json({ ...activite, contenu, sources, jalons })
})

// GET /api/dossiers/:id/yeswiki — export du dossier en syntaxe YesWiki (text/plain)
// A coller dans une page becs-rouges.fr ou rouge-coquelicot.fr.
router.get('/:id/yeswiki', (req, res) => {
  const activite = db.prepare(
    "SELECT id, titre FROM activites WHERE id = ? AND type = 'dossier'"
  ).get(req.params.id) as { id: number; titre: string } | undefined
  if (!activite) { res.status(404).json({ error: 'Dossier non trouve' }); return }

  const contenu = db.prepare(`
    SELECT c.contenu_md, c.mise_en_perspective_md, c.a_chaud,
           e.titre AS evenement_titre, e.date_evenement
    FROM dossier_contenu c
    LEFT JOIN evenements e ON e.id = c.evenement_id
    WHERE c.activite_id = ?
  `).get(activite.id) as {
    contenu_md: string | null
    mise_en_perspective_md: string | null
    a_chaud: number | null
    evenement_titre: string | null
    date_evenement: string | null
  } | undefined

  const sources = db.prepare(`
    SELECT s.titre, s.url, m.nom AS media_nom, asr.role
    FROM activite_sources asr
    JOIN sources s ON s.id = asr.source_id
    LEFT JOIN medias m ON m.id = s.media_id
    WHERE asr.activite_id = ?
    ORDER BY asr.ordre, s.titre
  `).all(activite.id) as YeswikiSource[]

  const texte = dossierVersYeswiki({
    titre: activite.titre,
    a_chaud: !!contenu?.a_chaud,
    evenement_titre: contenu?.evenement_titre ?? null,
    evenement_date: contenu?.date_evenement ?? null,
    mise_en_perspective_md: contenu?.mise_en_perspective_md ?? null,
    contenu_md: contenu?.contenu_md ?? null,
    sources,
  })

  res.type('text/plain; charset=utf-8').send(texte)
})

// POST /api/dossiers — créer un dossier (tout membre authentifié)
router.post('/', requireRole('membre', 'animateur', 'admin'), (req, res) => {
  const { titre, sujet_id, mise_en_perspective_md, contenu_md, a_chaud, evenement_id } = req.body
  if (!titre) { res.status(400).json({ error: 'Titre requis' }); return }

  const tx = db.transaction(() => {
    const r = db.prepare(`
      INSERT INTO activites (type, sujet_id, titre, statut, anime_par, cree_par)
      VALUES ('dossier', ?, ?, 'brouillon', ?, ?)
    `).run(sujet_id || null, titre, req.user?.id || null, req.user?.id || null)
    const aid = Number(r.lastInsertRowid)
    db.prepare(`
      INSERT INTO dossier_contenu (activite_id, mise_en_perspective_md, contenu_md, a_chaud, evenement_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(aid, mise_en_perspective_md || null, contenu_md || null, a_chaud ? 1 : 0, evenement_id || null)
    return aid
  })
  const id = tx()
  res.status(201).json({ id })
})

// PUT /api/dossiers/:id — éditer le contenu (perspective, corps, à chaud, événement)
router.put('/:id', (req, res) => {
  const exists = db.prepare(
    "SELECT 1 FROM activites WHERE id = ? AND type = 'dossier'"
  ).get(req.params.id)
  if (!exists) { res.status(404).json({ error: 'Dossier non trouve' }); return }

  const { titre, sujet_id, contenu_md, mise_en_perspective_md, a_chaud, evenement_id } = req.body

  const tx = db.transaction(() => {
    if (titre !== undefined || sujet_id !== undefined) {
      db.prepare(`
        UPDATE activites
        SET titre = COALESCE(?, titre), sujet_id = COALESCE(?, sujet_id), maj_le = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(titre ?? null, sujet_id ?? null, req.params.id)
    }
    // Assure l'existence de la ligne de contenu (robustesse) puis met à jour.
    db.prepare('INSERT OR IGNORE INTO dossier_contenu (activite_id) VALUES (?)').run(req.params.id)
    db.prepare(`
      UPDATE dossier_contenu
      SET contenu_md = COALESCE(?, contenu_md),
          mise_en_perspective_md = COALESCE(?, mise_en_perspective_md),
          a_chaud = COALESCE(?, a_chaud),
          evenement_id = CASE WHEN ? = 1 THEN ? ELSE evenement_id END
      WHERE activite_id = ?
    `).run(
      contenu_md ?? null,
      mise_en_perspective_md ?? null,
      a_chaud === undefined ? null : (a_chaud ? 1 : 0),
      evenement_id === undefined ? 0 : 1,
      evenement_id === undefined ? null : (evenement_id || null),
      req.params.id
    )
    db.prepare("UPDATE activites SET maj_le = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id)
  })
  tx()

  res.json(db.prepare('SELECT * FROM dossier_contenu WHERE activite_id = ?').get(req.params.id))
})

// POST /api/dossiers/:id/publier — marquer l'activité comme publiée
router.post('/:id/publier', (req, res) => {
  const row = db.prepare(
    "SELECT titre, statut FROM activites WHERE id = ? AND type = 'dossier'"
  ).get(req.params.id) as { titre: string; statut: string } | undefined
  if (!row) { res.status(404).json({ error: 'Dossier non trouve' }); return }
  db.prepare("UPDATE activites SET statut = 'publie', maj_le = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id)
  if (row.statut !== 'publie') {
    void notifierPublication({ type: 'Dossier', titre: row.titre || 'Dossier', chemin: `/dossiers/${req.params.id}` })
  }
  res.json(db.prepare('SELECT id, titre, statut FROM activites WHERE id = ?').get(req.params.id))
})

// POST /api/dossiers/:id/sources — rattacher une source { source_id, role? }
router.post('/:id/sources', (req, res) => {
  const exists = db.prepare(
    "SELECT 1 FROM activites WHERE id = ? AND type = 'dossier'"
  ).get(req.params.id)
  if (!exists) { res.status(404).json({ error: 'Dossier non trouve' }); return }
  const { source_id, role } = req.body
  if (!source_id) { res.status(400).json({ error: 'source_id requis' }); return }
  // Ordre editorial : la nouvelle source va en fin de corpus (MAX+1). On ne touche
  // pas l'ordre en cas de conflit (mise a jour du role seulement).
  const max = (db.prepare('SELECT COALESCE(MAX(ordre), -1) AS m FROM activite_sources WHERE activite_id = ?')
    .get(req.params.id) as { m: number }).m
  db.prepare(`
    INSERT INTO activite_sources (activite_id, source_id, role, ordre)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(activite_id, source_id) DO UPDATE SET role = excluded.role
  `).run(req.params.id, source_id, role || null, max + 1)
  res.status(204).end()
})

// PATCH /api/dossiers/:id/sources/order — réordonner le corpus { source_ids: [] }
router.patch('/:id/sources/order', (req, res) => {
  const { source_ids } = req.body as { source_ids: number[] }
  if (!Array.isArray(source_ids)) { res.status(400).json({ error: 'source_ids requis' }); return }
  const stmt = db.prepare('UPDATE activite_sources SET ordre = ? WHERE activite_id = ? AND source_id = ?')
  const tx = db.transaction(() => { source_ids.forEach((sid, i) => stmt.run(i, req.params.id, sid)) })
  tx()
  res.json({ ok: true })
})

// DELETE /api/dossiers/:id/sources/:sourceId — détacher une source
router.delete('/:id/sources/:sourceId', (req, res) => {
  db.prepare('DELETE FROM activite_sources WHERE activite_id = ? AND source_id = ?')
    .run(req.params.id, req.params.sourceId)
  res.status(204).end()
})

export default router
