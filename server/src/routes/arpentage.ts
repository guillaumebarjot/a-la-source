/**
 * Routes Arpentage — lecture collective fragmentee.
 *
 * L'arpentage decoupe un document long en fragments, attribue chaque fragment a
 * un participant, collecte les restitutions (points cles, citation, question,
 * mecanisme repere) puis aboutit a une synthese collective. Adosse au socle
 * `activites` (type 'arpentage') + extensions `arpentage_pipeline`,
 * `arpentage_fragments`, `arpentage_restitutions`.
 *
 * Gouvernance : tout membre authentifie peut creer et editer un arpentage.
 */
import { Router } from 'express'
import db from '../lib/db.js'
import { requireRole } from '../lib/auth.js'

const router = Router()

// GET /api/arpentages — liste des activites de type arpentage (avec compteurs)
router.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      a.id, a.titre, a.statut AS statut_activite, a.sujet_id, a.cree_le, a.maj_le,
      p.source_id, p.mode_decoupage,
      s.titre AS sujet_titre, s.slug AS sujet_slug,
      src.titre AS source_titre,
      (SELECT COUNT(*) FROM arpentage_fragments f WHERE f.activite_id = a.id) AS nb_fragments,
      (SELECT COUNT(*) FROM arpentage_fragments f
         JOIN arpentage_restitutions r ON r.fragment_id = f.id
         WHERE f.activite_id = a.id) AS nb_restitutions
    FROM activites a
    LEFT JOIN arpentage_pipeline p ON p.activite_id = a.id
    LEFT JOIN sujets s ON s.id = a.sujet_id
    LEFT JOIN sources src ON src.id = p.source_id
    WHERE a.type = 'arpentage'
    ORDER BY a.maj_le DESC, a.cree_le DESC
  `).all()
  res.json(rows)
})

// GET /api/arpentages/:id — detail : activite + pipeline + fragments + restitutions
router.get('/:id', (req, res) => {
  const activite = db.prepare(`
    SELECT a.id, a.titre, a.type, a.statut AS statut_activite, a.sujet_id,
           a.anime_par, a.cree_par, a.cree_le, a.maj_le,
           s.titre AS sujet_titre, s.slug AS sujet_slug
    FROM activites a
    LEFT JOIN sujets s ON s.id = a.sujet_id
    WHERE a.id = ? AND a.type = 'arpentage'
  `).get(req.params.id) as { id: number } | undefined
  if (!activite) { res.status(404).json({ error: 'Arpentage non trouve' }); return }

  const pipeline = db.prepare(`
    SELECT p.activite_id, p.source_id, p.mode_decoupage, p.synthese_md,
           src.titre AS source_titre, src.accroche AS source_accroche, src.url AS source_url
    FROM arpentage_pipeline p
    LEFT JOIN sources src ON src.id = p.source_id
    WHERE p.activite_id = ?
  `).get(activite.id)

  const fragments = db.prepare(`
    SELECT f.id, f.activite_id, f.ordre, f.titre, f.reference, f.contenu_md,
           f.attribue_a, u.nom AS attribue_a_nom
    FROM arpentage_fragments f
    LEFT JOIN utilisateurs u ON u.id = f.attribue_a
    WHERE f.activite_id = ?
    ORDER BY f.ordre ASC, f.id ASC
  `).all(activite.id) as { id: number }[]

  const restitutions = db.prepare(`
    SELECT r.id, r.fragment_id, r.par, r.points_cles_md, r.citation, r.question_md,
           r.mecanisme_id, r.cree_le,
           u.nom AS par_nom, m.nom AS mecanisme_nom
    FROM arpentage_restitutions r
    LEFT JOIN utilisateurs u ON u.id = r.par
    LEFT JOIN mecanismes_reference m ON m.id = r.mecanisme_id
    JOIN arpentage_fragments f ON f.id = r.fragment_id
    WHERE f.activite_id = ?
    ORDER BY r.cree_le ASC, r.id ASC
  `).all(activite.id) as Array<{ id: number }>

  // Jalons de completude FACTUELS (chantier #1, tunnelisation §3.4). Booleens
  // deduits de la presence de donnees (source + decoupage, fragments, attribution,
  // restitutions, synthese), jamais bloquants, jamais un verdict.
  const p = pipeline as {
    source_id?: number | null
    mode_decoupage?: string | null
    synthese_md?: string | null
  } | undefined
  const fragsTypes = fragments as Array<{ id: number; attribue_a?: number | null }>
  const jalons = {
    a_document: p?.source_id != null || !!(p?.mode_decoupage && p.mode_decoupage.trim()),
    a_fragments: fragsTypes.length > 0,
    a_attribution: fragsTypes.some((f) => f.attribue_a != null),
    a_restitutions: restitutions.length > 0,
    a_synthese: !!(p?.synthese_md && p.synthese_md.trim()),
    est_publie: (activite as { statut_activite?: string }).statut_activite === 'publie',
  }

  res.json({ ...activite, pipeline, fragments, restitutions, jalons })
})

// POST /api/arpentages — creer un arpentage (tout membre authentifie)
router.post('/', requireRole('membre', 'animateur', 'admin'), (req, res) => {
  const { titre, sujet_id, source_id, mode_decoupage } = req.body as {
    titre?: string; sujet_id?: number; source_id?: number; mode_decoupage?: string
  }
  if (!titre || !titre.trim()) { res.status(400).json({ error: 'Titre requis' }); return }

  const tx = db.transaction(() => {
    const r = db.prepare(`
      INSERT INTO activites (type, sujet_id, titre, statut, anime_par, cree_par)
      VALUES ('arpentage', ?, ?, 'brouillon', ?, ?)
    `).run(sujet_id || null, titre.trim(), req.user?.id || null, req.user?.id || null)
    const aid = Number(r.lastInsertRowid)
    db.prepare(`
      INSERT INTO arpentage_pipeline (activite_id, source_id, mode_decoupage)
      VALUES (?, ?, ?)
    `).run(aid, source_id || null, mode_decoupage || null)
    return aid
  })
  const id = tx()
  res.status(201).json({ id })
})

// PUT /api/arpentages/:id — editer le pipeline (synthese, source, mode de decoupage) + titre
router.put('/:id', (req, res) => {
  const exists = db.prepare(
    "SELECT 1 FROM activites WHERE id = ? AND type = 'arpentage'"
  ).get(req.params.id)
  if (!exists) { res.status(404).json({ error: 'Arpentage non trouve' }); return }

  const { titre, sujet_id, synthese_md, source_id, mode_decoupage } = req.body as {
    titre?: string; sujet_id?: number; synthese_md?: string
    source_id?: number | null; mode_decoupage?: string
  }

  const tx = db.transaction(() => {
    if (titre !== undefined || sujet_id !== undefined) {
      db.prepare(`
        UPDATE activites
        SET titre = COALESCE(?, titre), sujet_id = COALESCE(?, sujet_id), maj_le = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(titre ?? null, sujet_id ?? null, req.params.id)
    }
    db.prepare('INSERT OR IGNORE INTO arpentage_pipeline (activite_id) VALUES (?)').run(req.params.id)
    db.prepare(`
      UPDATE arpentage_pipeline
      SET synthese_md = COALESCE(?, synthese_md),
          source_id = CASE WHEN ? = 1 THEN ? ELSE source_id END,
          mode_decoupage = COALESCE(?, mode_decoupage)
      WHERE activite_id = ?
    `).run(
      synthese_md ?? null,
      source_id === undefined ? 0 : 1,
      source_id === undefined ? null : (source_id || null),
      mode_decoupage ?? null,
      req.params.id
    )
    db.prepare("UPDATE activites SET maj_le = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id)
  })
  tx()

  res.json(db.prepare('SELECT * FROM arpentage_pipeline WHERE activite_id = ?').get(req.params.id))
})

// POST /api/arpentages/:id/fragments — ajouter un fragment { titre, reference, contenu_md, ordre }
router.post('/:id/fragments', (req, res) => {
  const exists = db.prepare(
    "SELECT 1 FROM activites WHERE id = ? AND type = 'arpentage'"
  ).get(req.params.id)
  if (!exists) { res.status(404).json({ error: 'Arpentage non trouve' }); return }

  const { titre, reference, contenu_md, ordre } = req.body as {
    titre?: string; reference?: string; contenu_md?: string; ordre?: number
  }

  // Ordre par defaut : a la suite du dernier fragment.
  let rang = ordre
  if (rang === undefined || rang === null) {
    rang = (db.prepare(
      'SELECT COALESCE(MAX(ordre), 0) + 1 AS r FROM arpentage_fragments WHERE activite_id = ?'
    ).get(req.params.id) as { r: number }).r
  }

  const r = db.prepare(`
    INSERT INTO arpentage_fragments (activite_id, ordre, titre, reference, contenu_md)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, rang, titre || null, reference || null, contenu_md || null)
  db.prepare("UPDATE activites SET maj_le = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id)
  res.status(201).json({ id: Number(r.lastInsertRowid) })
})

// PUT /api/arpentages/fragments/:fid — editer un fragment (attribution, contenu...)
router.put('/fragments/:fid', (req, res) => {
  const frag = db.prepare(
    'SELECT id, activite_id FROM arpentage_fragments WHERE id = ?'
  ).get(req.params.fid) as { id: number; activite_id: number } | undefined
  if (!frag) { res.status(404).json({ error: 'Fragment non trouve' }); return }

  const { titre, reference, contenu_md, ordre, attribue_a } = req.body as {
    titre?: string; reference?: string; contenu_md?: string
    ordre?: number; attribue_a?: number | null
  }

  db.prepare(`
    UPDATE arpentage_fragments
    SET titre = COALESCE(?, titre),
        reference = COALESCE(?, reference),
        contenu_md = COALESCE(?, contenu_md),
        ordre = COALESCE(?, ordre),
        attribue_a = CASE WHEN ? = 1 THEN ? ELSE attribue_a END
    WHERE id = ?
  `).run(
    titre ?? null,
    reference ?? null,
    contenu_md ?? null,
    ordre ?? null,
    attribue_a === undefined ? 0 : 1,
    attribue_a === undefined ? null : (attribue_a || null),
    req.params.fid
  )
  db.prepare("UPDATE activites SET maj_le = CURRENT_TIMESTAMP WHERE id = ?").run(frag.activite_id)
  res.json(db.prepare('SELECT * FROM arpentage_fragments WHERE id = ?').get(req.params.fid))
})

// DELETE /api/arpentages/fragments/:fid — supprimer un fragment (cascade restitutions)
router.delete('/fragments/:fid', (req, res) => {
  const frag = db.prepare(
    'SELECT id, activite_id FROM arpentage_fragments WHERE id = ?'
  ).get(req.params.fid) as { id: number; activite_id: number } | undefined
  if (!frag) { res.status(404).json({ error: 'Fragment non trouve' }); return }
  db.prepare('DELETE FROM arpentage_fragments WHERE id = ?').run(req.params.fid)
  db.prepare("UPDATE activites SET maj_le = CURRENT_TIMESTAMP WHERE id = ?").run(frag.activite_id)
  res.status(204).end()
})

// POST /api/arpentages/fragments/:fid/restitutions — restitution d'un lecteur (par = req.user.id)
router.post('/fragments/:fid/restitutions', (req, res) => {
  const frag = db.prepare(
    'SELECT id, activite_id FROM arpentage_fragments WHERE id = ?'
  ).get(req.params.fid) as { id: number; activite_id: number } | undefined
  if (!frag) { res.status(404).json({ error: 'Fragment non trouve' }); return }

  const { points_cles_md, citation, question_md, mecanisme_id } = req.body as {
    points_cles_md?: string; citation?: string; question_md?: string; mecanisme_id?: number
  }

  const r = db.prepare(`
    INSERT INTO arpentage_restitutions (fragment_id, par, points_cles_md, citation, question_md, mecanisme_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    req.params.fid,
    req.user?.id || null,
    points_cles_md || null,
    citation || null,
    question_md || null,
    mecanisme_id || null
  )
  db.prepare("UPDATE activites SET maj_le = CURRENT_TIMESTAMP WHERE id = ?").run(frag.activite_id)
  res.status(201).json({ id: Number(r.lastInsertRowid) })
})

export default router
