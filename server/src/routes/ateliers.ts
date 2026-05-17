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

// GET /api/ateliers/:id/print — version imprimable HTML (pour PDF via navigateur)
router.get('/:id/print', (req, res) => {
  const atelier = db.prepare('SELECT * FROM ateliers WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!atelier) { res.status(404).json({ error: 'Atelier introuvable' }); return }

  const sources = db.prepare(`
    SELECT s.*, m.nom as media_nom, a.nom as auteur_nom
    FROM atelier_sources as2
    JOIN sources s ON s.id = as2.source_id
    LEFT JOIN medias m ON s.media_id = m.id
    LEFT JOIN auteurs a ON s.auteur_id = a.id
    WHERE as2.atelier_id = ? AND as2.retiree_le IS NULL
  `).all(req.params.id) as Array<Record<string, unknown>>

  // Pour chaque source, recuperer les mecanismes et l'archive
  const sourcesEnriched = sources.map(s => {
    const mecanismes = db.prepare(`
      SELECT mr.nom, sm.justification, sm.extrait
      FROM source_mecanismes sm
      JOIN mecanismes_reference mr ON sm.mecanisme_id = mr.id
      WHERE sm.source_id = ?
    `).all(s.id as number) as Array<{ nom: string; justification: string | null; extrait: string | null }>

    const archive = db.prepare(
      'SELECT contenu, nb_mots FROM archives WHERE source_id = ? ORDER BY cree_le DESC LIMIT 1'
    ).get(s.id as number) as { contenu: string | null; nb_mots: number | null } | undefined

    return { ...s, mecanismes, archive }
  })

  // Generer HTML imprimable
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
    h3 { font-size: 12pt; margin: 1em 0 0.3em; }
    .meta { font-size: 9pt; color: #666; margin-bottom: 1em; }
    .source-block { page-break-inside: avoid; border: 1px solid #ddd; padding: 1em; margin-bottom: 1.5em; border-radius: 4px; }
    .source-titre { font-size: 13pt; font-weight: bold; margin-bottom: 0.3em; }
    .source-meta { font-size: 9pt; color: #666; margin-bottom: 0.5em; }
    .mecanismes { margin-top: 0.5em; padding-top: 0.5em; border-top: 1px dashed #ccc; }
    .mecanisme { margin-bottom: 0.3em; }
    .mecanisme-nom { font-weight: bold; color: #c0392b; }
    .extrait { font-style: italic; color: #555; font-size: 10pt; }
    .archive-content { margin-top: 1em; font-size: 10pt; line-height: 1.5; max-height: none; }
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
    ${atelier.lieu ? ` | <strong>Lieu :</strong> ${atelier.lieu}` : ''}
    ${atelier.nb_participants ? ` | <strong>Participants :</strong> ${atelier.nb_participants}` : ''}
  </div>

  ${atelier.compte_rendu ? `<h2>Compte rendu</h2><p>${(atelier.compte_rendu as string).replace(/\n/g, '<br>')}</p>` : ''}
  ${atelier.observations ? `<h2>Observations</h2><p>${(atelier.observations as string).replace(/\n/g, '<br>')}</p>` : ''}

  <div class="page-selection">
    <h2>Sources candidates (page de selection)</h2>
    <div class="selection-grid">
      ${sourcesEnriched.map((s, i) => `
        <div class="selection-card">
          <h3>${i + 1}. ${s.titre}</h3>
          <p>${s.media_nom || ''} ${s.auteur_nom ? '— ' + s.auteur_nom : ''}</p>
          <p>${s.accroche ? (s.accroche as string).substring(0, 120) + '...' : ''}</p>
          <p>${s.mecanismes.length} mecanisme(s) identifie(s)</p>
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
        ${s.url ? ' | <a href="' + s.url + '">' + s.url + '</a>' : ''}
      </div>
      ${s.accroche ? `<p><em>${s.accroche}</em></p>` : ''}
      ${s.mecanismes.length > 0 ? `
        <div class="mecanismes">
          <h3>Mecanismes identifies</h3>
          ${s.mecanismes.map(m => `
            <div class="mecanisme">
              <span class="mecanisme-nom">${m.nom}</span>
              ${m.justification ? ` — ${m.justification}` : ''}
              ${m.extrait ? `<div class="extrait">${m.extrait}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${s.archive?.contenu ? `
        <div class="archive-content">
          <h3>Contenu archive</h3>
          ${s.archive.contenu}
        </div>
      ` : ''}
    </div>
  `).join('')}
</body>
</html>`

  res.type('html').send(html)
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
