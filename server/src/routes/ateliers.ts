import { Router } from 'express'
import db from '../lib/db.js'
import { requireRole } from '../lib/auth.js'
import { calculerScoreSource } from '../lib/score.js'

const router = Router()

// GET /api/ateliers — list all workshops
router.get('/', (_req, res) => {
  const ateliers = db.prepare(`
    SELECT a.*, u.nom as facilitateur_nom
    FROM ateliers a
    LEFT JOIN utilisateurs u ON a.facilitateur_id = u.id
    ORDER BY a.numero DESC
  `).all()
  res.json(ateliers)
})

// GET /api/ateliers/vivier — sources at vivier with scores + tags + atelier badges
router.get('/vivier', (_req, res) => {
  const sources = db.prepare(`
    SELECT s.*, m.nom as media_nom
    FROM sources s
    LEFT JOIN medias m ON s.media_id = m.id
    WHERE s.statut = 'vivier'
    ORDER BY s.soumis_le DESC
  `).all() as Array<Record<string, unknown>>

  // Get all active atelier_sources links (for badge info)
  const atelierLinks = db.prepare(`
    SELECT asrc.source_id, asrc.atelier_id, a.numero, a.statut as atelier_statut
    FROM atelier_sources asrc
    JOIN ateliers a ON a.id = asrc.atelier_id
    WHERE asrc.retiree_le IS NULL
  `).all() as Array<{ source_id: number; atelier_id: number; numero: number; atelier_statut: string }>

  const linksBySource = new Map<number, typeof atelierLinks>()
  for (const link of atelierLinks) {
    const existing = linksBySource.get(link.source_id) || []
    existing.push(link)
    linksBySource.set(link.source_id, existing)
  }

  const result = sources.map(s => {
    const sid = s.id as number
    const tags = db.prepare(`
      SELECT t.id, t.nom, t.couleur, t.categorie
      FROM tags t JOIN source_tags st ON st.tag_id = t.id
      WHERE st.source_id = ?
    `).all(sid) as Array<{ id: number; nom: string; couleur: string | null; categorie: string }>

    const score = calculerScoreSource(sid, s.date_publication as string | null, s.type_source as string | null)

    // Badge info: which ateliers reference this source
    const atelierBadges = (linksBySource.get(sid) || []).map(l => ({
      atelier_id: l.atelier_id,
      numero: l.numero,
      statut: l.atelier_statut,
    }))

    // Quality gate check
    const hasEvaluation = score.nbEvaluations >= 1
    const hasArchive = db.prepare(
      'SELECT 1 FROM archives WHERE source_id = ? LIMIT 1'
    ).get(sid)
    const hasAccroche = !!(s.accroche as string | null)
    const qualityGateOk = hasEvaluation && !!hasArchive && hasAccroche

    return {
      ...s,
      tags,
      score,
      atelier_badges: atelierBadges,
      quality_gate: { ok: qualityGateOk, hasEvaluation, hasArchive: !!hasArchive, hasAccroche },
    }
  })

  result.sort((a, b) => b.score.scoreTotal - a.score.scoreTotal)
  res.json(result)
})

// GET /api/ateliers/en-cours — workshops in preparation (can be multiple)
router.get('/en-cours', (_req, res) => {
  const ateliers = db.prepare(`
    SELECT a.*, u.nom as facilitateur_nom
    FROM ateliers a
    LEFT JOIN utilisateurs u ON a.facilitateur_id = u.id
    WHERE a.statut IN ('preparation', 'pret', 'en_cours')
    ORDER BY a.cree_le DESC
  `).all() as Array<Record<string, unknown>>

  const result = ateliers.map(atelier => {
    const sources = db.prepare(`
      SELECT s.*, m.nom as media_nom, asrc.ordre
      FROM atelier_sources asrc
      JOIN sources s ON s.id = asrc.source_id
      LEFT JOIN medias m ON s.media_id = m.id
      WHERE asrc.atelier_id = ? AND asrc.retiree_le IS NULL
      ORDER BY asrc.ordre ASC, asrc.ajoutee_le ASC
    `).all((atelier as { id: number }).id)
    return { ...atelier, sources }
  })

  res.json(result)
})

// GET /api/ateliers/:id — detail with sources + mecanismes
router.get('/:id', (req, res) => {
  const atelier = db.prepare(`
    SELECT a.*, u.nom as facilitateur_nom
    FROM ateliers a
    LEFT JOIN utilisateurs u ON a.facilitateur_id = u.id
    WHERE a.id = ?
  `).get(req.params.id)
  if (!atelier) { res.status(404).json({ error: 'Atelier introuvable' }); return }

  const sources = db.prepare(`
    SELECT s.*, m.nom as media_nom, asrc.ordre
    FROM atelier_sources asrc
    JOIN sources s ON s.id = asrc.source_id
    LEFT JOIN medias m ON s.media_id = m.id
    WHERE asrc.atelier_id = ? AND asrc.retiree_le IS NULL
    ORDER BY asrc.ordre ASC, asrc.ajoutee_le ASC
  `).all(req.params.id)

  const mecanismes_identifies = db.prepare(`
    SELECT am.mecanisme_id, mr.nom as mecanisme_nom
    FROM atelier_mecanismes am
    JOIN mecanismes_reference mr ON mr.id = am.mecanisme_id
    WHERE am.atelier_id = ?
  `).all(req.params.id)

  res.json({ ...atelier, sources, mecanismes_identifies })
})

// POST /api/ateliers — create a workshop (auto-number)
router.post('/', requireRole('animateur', 'admin'), (req, res) => {
  const { date_atelier, heure, lieu } = req.body
  const facilitateur_id = req.user?.id

  // Auto-number: max + 1
  const maxRow = db.prepare('SELECT MAX(numero) as max_num FROM ateliers').get() as { max_num: number | null }
  const numero = (maxRow.max_num || 0) + 1

  const r = db.prepare(`
    INSERT INTO ateliers (numero, date_atelier, heure, lieu, facilitateur_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(numero, date_atelier || null, heure || null, lieu || null, facilitateur_id || null)
  res.status(201).json({ id: Number(r.lastInsertRowid), numero })
})

// POST /api/ateliers/:id/sources — add source to workshop (NO statut change)
router.post('/:id/sources', requireRole('animateur', 'admin'), (req, res) => {
  const { source_id } = req.body
  const atelierId = req.params.id

  // Get max order
  const maxOrdre = db.prepare(
    'SELECT MAX(ordre) as max_o FROM atelier_sources WHERE atelier_id = ? AND retiree_le IS NULL'
  ).get(atelierId) as { max_o: number | null }
  const ordre = (maxOrdre?.max_o || 0) + 1

  db.prepare(
    'INSERT OR IGNORE INTO atelier_sources (atelier_id, source_id, ordre) VALUES (?, ?, ?)'
  ).run(atelierId, source_id, ordre)

  // Source stays at vivier (new model — no statut change)
  res.json({ ok: true })
})

// DELETE /api/ateliers/:id/sources/:sourceId — remove source from workshop
router.delete('/:id/sources/:sourceId', requireRole('animateur', 'admin'), (req, res) => {
  db.prepare(
    "UPDATE atelier_sources SET retiree_le = CURRENT_TIMESTAMP WHERE atelier_id = ? AND source_id = ?"
  ).run(req.params.id, req.params.sourceId)
  // Source stays at vivier (no statut change)
  res.json({ ok: true })
})

// PATCH /api/ateliers/:id/sources/order — reorder sources
router.patch('/:id/sources/order', requireRole('animateur', 'admin'), (req, res) => {
  const { source_ids } = req.body as { source_ids: number[] }
  if (!Array.isArray(source_ids)) { res.status(400).json({ error: 'source_ids requis' }); return }

  const stmt = db.prepare(
    'UPDATE atelier_sources SET ordre = ? WHERE atelier_id = ? AND source_id = ? AND retiree_le IS NULL'
  )
  const tx = db.transaction(() => {
    source_ids.forEach((sid, i) => stmt.run(i, req.params.id, sid))
  })
  tx()
  res.json({ ok: true })
})

// POST /api/ateliers/:id/synthese — save structured synthesis
router.post('/:id/synthese', requireRole('animateur', 'admin'), (req, res) => {
  const { mecanisme_ids, observations_surprise, questions_restantes, nb_participants } = req.body
  const atelierId = req.params.id

  const atelier = db.prepare('SELECT id FROM ateliers WHERE id = ?').get(atelierId)
  if (!atelier) { res.status(404).json({ error: 'Atelier introuvable' }); return }

  const tx = db.transaction(() => {
    // Update atelier fields
    const updates: string[] = []
    const params: unknown[] = []
    if (observations_surprise !== undefined) { updates.push('observations_surprise = ?'); params.push(observations_surprise) }
    if (questions_restantes !== undefined) { updates.push('questions_restantes = ?'); params.push(questions_restantes) }
    if (nb_participants !== undefined) { updates.push('nb_participants = ?'); params.push(nb_participants) }
    if (updates.length > 0) {
      params.push(atelierId)
      db.prepare(`UPDATE ateliers SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    }

    // Replace mecanismes
    if (Array.isArray(mecanisme_ids)) {
      db.prepare('DELETE FROM atelier_mecanismes WHERE atelier_id = ?').run(atelierId)
      const ins = db.prepare('INSERT OR IGNORE INTO atelier_mecanismes (atelier_id, mecanisme_id) VALUES (?, ?)')
      for (const mid of mecanisme_ids) {
        ins.run(atelierId, mid)
      }
    }
  })
  tx()

  res.json({ ok: true })
})

// PATCH /api/ateliers/:id — update workshop fields
router.patch('/:id', requireRole('animateur', 'admin'), (req, res) => {
  const allowed = [
    'statut', 'source_choisie_id', 'nb_participants', 'compte_rendu',
    'observations', 'observations_surprise', 'questions_restantes',
    'mecanisme_identifie', 'date_atelier', 'heure', 'lieu',
  ]
  const updates: string[] = []
  const params: unknown[] = []

  for (const [key, value] of Object.entries(req.body)) {
    if (allowed.includes(key)) { updates.push(`${key} = ?`); params.push(value) }
  }

  if (updates.length === 0) { res.status(400).json({ error: 'Rien a modifier' }); return }

  // If setting statut to 'termine', sources stay at vivier but we can track it
  params.push(req.params.id)
  db.prepare(`UPDATE ateliers SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  res.json({ ok: true })
})

// GET /api/ateliers/:id/print — printable HTML (neutral fiches for the table)
router.get('/:id/print', (req, res) => {
  const atelier = db.prepare('SELECT * FROM ateliers WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!atelier) { res.status(404).json({ error: 'Atelier introuvable' }); return }

  const sources = db.prepare(`
    SELECT s.*, m.nom as media_nom, a2.nom as auteur_nom, asrc.ordre
    FROM atelier_sources asrc
    JOIN sources s ON s.id = asrc.source_id
    LEFT JOIN medias m ON s.media_id = m.id
    LEFT JOIN auteurs a2 ON s.auteur_id = a2.id
    WHERE asrc.atelier_id = ? AND asrc.retiree_le IS NULL
    ORDER BY asrc.ordre ASC, asrc.ajoutee_le ASC
  `).all(req.params.id) as Array<Record<string, unknown>>

  // For each source: archive content only (neutral — no mechanisms, no scores)
  const sourcesEnriched = sources.map(s => {
    const archive = db.prepare(
      'SELECT contenu FROM archives WHERE source_id = ? ORDER BY cree_le DESC LIMIT 1'
    ).get(s.id as number) as { contenu: string | null } | undefined

    return { ...(s as Record<string, unknown>), archive } as Record<string, unknown> & { archive: { contenu: string | null } | undefined }
  })

  // Neutral printable HTML — no scores, no mechanisms (for the table)
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Atelier #${atelier.numero} — A la source</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a; padding: 2cm; }
    h1 { font-size: 18pt; color: #c0392b; margin-bottom: 0.5em; border-bottom: 2px solid #c0392b; padding-bottom: 0.3em; }
    h2 { font-size: 14pt; color: #2d2d2d; margin: 1.5em 0 0.5em; page-break-after: avoid; }
    .meta { font-size: 9pt; color: #666; margin-bottom: 1em; }
    .source-block { page-break-inside: avoid; border: 1px solid #ddd; padding: 1em; margin-bottom: 1.5em; border-radius: 4px; }
    .source-titre { font-size: 13pt; font-weight: bold; margin-bottom: 0.3em; }
    .source-meta { font-size: 9pt; color: #666; margin-bottom: 0.5em; }
    .source-duree { font-size: 9pt; color: #888; }
    .archive-content { margin-top: 1em; font-size: 10pt; line-height: 1.5; }
    .archive-content img { max-width: 100%; }
    .page-selection { page-break-before: always; }
    .selection-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1em; }
    .selection-card { border: 2px solid #c0392b; padding: 0.8em; border-radius: 4px; }
    .selection-card h3 { font-size: 11pt; margin: 0 0 0.3em; }
    .selection-card p { font-size: 9pt; color: #666; margin: 0; }
    @media print {
      body { padding: 1cm; }
      .no-print { display: none; }
    }
    .btn-print { position: fixed; top: 1em; right: 1em; padding: 0.5em 1em; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12pt; }
  </style>
</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">Imprimer / PDF</button>
  <h1>Atelier #${atelier.numero} — A la source</h1>
  <div class="meta">
    ${atelier.date_atelier ? `<strong>Date :</strong> ${atelier.date_atelier}` : ''}
    ${atelier.heure ? ` a ${atelier.heure}` : ''}
    ${atelier.lieu ? ` | <strong>Lieu :</strong> ${atelier.lieu}` : ''}
  </div>

  <div class="page-selection">
    <h2>Sources candidates</h2>
    <div class="selection-grid">
      ${sourcesEnriched.map((s, i) => `
        <div class="selection-card">
          <h3>${i + 1}. ${s.titre}</h3>
          <p>${s.media_nom || ''} ${s.auteur_nom ? '— ' + s.auteur_nom : ''}</p>
          <p>${s.accroche ? (s.accroche as string).substring(0, 120) + '...' : ''}</p>
          ${s.duree_minutes ? `<p class="source-duree">${s.duree_minutes} min</p>` : ''}
        </div>
      `).join('')}
    </div>
  </div>

  ${sourcesEnriched.map((s, i) => `
    <div class="source-block" style="page-break-before: always;">
      <div class="source-titre">${i + 1}. ${s.titre}</div>
      <div class="source-meta">
        ${s.media_nom || ''} ${s.auteur_nom ? '— ' + s.auteur_nom : ''}
        ${s.date_publication ? ' | ' + s.date_publication : ''}
        ${s.duree_minutes ? ' | ' + s.duree_minutes + ' min' : ''}
      </div>
      ${s.accroche ? `<p><em>${s.accroche}</em></p>` : ''}
      ${s.archive?.contenu ? `
        <div class="archive-content">
          ${s.archive.contenu}
        </div>
      ` : ''}
    </div>
  `).join('')}
</body>
</html>`

  res.type('html').send(html)
})

export default router
