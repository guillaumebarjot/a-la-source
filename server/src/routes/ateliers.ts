import { Router } from 'express'
import db from '../lib/db.js'
import { requireRole } from '../lib/auth.js'
import { calculerScoreSource } from '../lib/score.js'
import { profilDiversiteCorpus, suggestionsDiversite } from '../lib/diversite.js'

const router = Router()

/*
 * Bascule A1 : l'atelier vit désormais sur le socle commun des activités.
 *  - identité + statut : table `activites` (type='atelier'), l'id atelier = activites.id
 *  - logistique + déroulé : table `atelier_pipeline`
 *  - corpus : `activite_sources` (suppression dure, plus de retiree_le)
 *  - mécanismes de synthèse : `activite_mecanismes`
 * La forme de l'API est INCHANGÉE (mêmes champs renvoyés) : le client ne bouge pas.
 * Les tables legacy `ateliers*` sont conservées en filet (non lues, non écrites ici).
 */

// Fragment SELECT qui reconstitue un objet « atelier » à partir du socle + extension.
const ATELIER_COLS = `
  a.id, a.statut, a.cree_le,
  p.numero, p.date_atelier, p.heure, p.lieu, p.facilitateur_id,
  p.source_choisie_id, p.nb_participants, p.compte_rendu,
  p.observations, p.observations_surprise, p.questions_restantes, p.mecanisme_identifie,
  u.nom as facilitateur_nom
`
const ATELIER_FROM = `
  FROM activites a
  JOIN atelier_pipeline p ON p.activite_id = a.id
  LEFT JOIN utilisateurs u ON u.id = p.facilitateur_id
`

// GET /api/ateliers — list all workshops
router.get('/', (_req, res) => {
  const ateliers = db.prepare(`
    SELECT ${ATELIER_COLS} ${ATELIER_FROM}
    WHERE a.type = 'atelier'
    ORDER BY p.numero DESC
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

  // Liens corpus actifs (pour les badges) : via activite_sources
  const atelierLinks = db.prepare(`
    SELECT asrc.source_id, asrc.activite_id AS atelier_id, p.numero, a.statut AS atelier_statut
    FROM activite_sources asrc
    JOIN activites a ON a.id = asrc.activite_id AND a.type = 'atelier'
    JOIN atelier_pipeline p ON p.activite_id = a.id
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

    const atelierBadges = (linksBySource.get(sid) || []).map(l => ({
      atelier_id: l.atelier_id,
      numero: l.numero,
      statut: l.atelier_statut,
    }))

    const hasEvaluation = score.nbEvaluations >= 1
    // Archive la plus recente : on en retient le statut (complete / partielle / echouee)
    // pour decrire factuellement la completude de la copie locale.
    const archiveRow = db.prepare(
      'SELECT statut FROM archives WHERE source_id = ? ORDER BY cree_le DESC LIMIT 1'
    ).get(sid) as { statut: string | null } | undefined
    const hasArchive = !!archiveRow
    const archiveStatut = archiveRow?.statut ?? null
    const hasAccroche = !!(s.accroche as string | null)
    const qualityGateOk = hasEvaluation && hasArchive && hasAccroche

    // Mecanismes pressentis / identifies sur la source (facette descriptive,
    // pas un verdict) : on compte les mecanismes distincts rattaches.
    const mecaRow = db.prepare(
      'SELECT COUNT(DISTINCT mecanisme_id) AS nb FROM source_mecanismes WHERE source_id = ?'
    ).get(sid) as { nb: number }
    const nbMecanismes = mecaRow?.nb ?? 0

    return {
      ...s,
      tags,
      score,
      // Facettes descriptives (principe « decrire, ne pas noter ») : on expose
      // des faits, jamais un score-verdict. Le bloc `score` reste fourni pour
      // un tri optionnel et la retrocompatibilite, mais n'est plus presente.
      facettes: {
        nbEvaluations: score.nbEvaluations,
        archiveStatut,                 // null | 'complete' | 'partielle' | 'echouee'
        completude: (s.completude as string | null) ?? null, // libre | partiel | integral_offline
        datePublication: (s.date_publication as string | null) ?? null,
        nbMecanismes,
        fraicheur: score.fraicheur,    // 0..1, ancienneté relative
      },
      atelier_badges: atelierBadges,
      quality_gate: { ok: qualityGateOk, hasEvaluation, hasArchive, hasAccroche },
    }
  })

  // Tri par defaut factuel : la requete ordonne deja par soumis_le DESC
  // (source la plus recemment soumise d'abord). Le client propose ensuite ses
  // propres tris factuels ; le score n'est plus le tri par defaut.
  res.json(result)
})

// Sources d'un atelier (corpus), forme identique à l'ancienne (avec ordre).
// On expose aussi has_archive + archive_statut pour que les cartes (SourceCard)
// indiquent correctement la présence d'une copie locale (sinon « Pas de copie
// locale » s'affiche à tort sur des sources pourtant archivées).
function sourcesAtelier(activiteId: string | number) {
  return db.prepare(`
    SELECT s.*, m.nom as media_nom, asrc.ordre,
      EXISTS(SELECT 1 FROM archives a WHERE a.source_id = s.id) AS has_archive,
      (SELECT a.statut FROM archives a WHERE a.source_id = s.id ORDER BY a.cree_le DESC LIMIT 1) AS archive_statut
    FROM activite_sources asrc
    JOIN sources s ON s.id = asrc.source_id
    LEFT JOIN medias m ON s.media_id = m.id
    WHERE asrc.activite_id = ?
    ORDER BY asrc.ordre ASC, s.id ASC
  `).all(activiteId)
}

// GET /api/ateliers/en-cours — workshops in preparation (can be multiple)
router.get('/en-cours', (_req, res) => {
  const ateliers = db.prepare(`
    SELECT ${ATELIER_COLS} ${ATELIER_FROM}
    WHERE a.type = 'atelier' AND a.statut IN ('preparation', 'pret', 'en_cours')
    ORDER BY a.cree_le DESC
  `).all() as Array<{ id: number }>

  const result = ateliers.map(atelier => ({ ...atelier, sources: sourcesAtelier(atelier.id) }))
  res.json(result)
})

// GET /api/ateliers/:id — detail with sources + mecanismes
router.get('/:id', (req, res) => {
  const atelier = db.prepare(`
    SELECT ${ATELIER_COLS} ${ATELIER_FROM}
    WHERE a.type = 'atelier' AND a.id = ?
  `).get(req.params.id)
  if (!atelier) { res.status(404).json({ error: 'Atelier introuvable' }); return }

  const sources = sourcesAtelier(req.params.id) as Array<{ id: number }>

  const mecanismes_identifies = db.prepare(`
    SELECT am.mecanisme_id, mr.nom as mecanisme_nom
    FROM activite_mecanismes am
    JOIN mecanismes_reference mr ON mr.id = am.mecanisme_id
    WHERE am.activite_id = ?
  `).all(req.params.id) as Array<{ mecanisme_id: number }>

  // Jalons de completude FACTUELS (chantier #1, tunnelisation §3.1). L'atelier a
  // un cycle logistique propre (preparation/pret/en_cours/termine) ; les jalons
  // decrivent le deroule (corpus, source choisie, synthese), sans verdict.
  const a = atelier as {
    statut?: string
    source_choisie_id?: number | null
    observations_surprise?: string | null
    questions_restantes?: string | null
  }
  const jalons = {
    a_corpus: sources.length > 0,
    a_source_choisie: a.source_choisie_id != null,
    a_mecanismes: mecanismes_identifies.length > 0,
    a_synthese: !!(a.observations_surprise && a.observations_surprise.trim())
      || !!(a.questions_restantes && a.questions_restantes.trim())
      || mecanismes_identifies.length > 0,
    est_termine: a.statut === 'termine',
  }

  res.json({ ...atelier, sources, mecanismes_identifies, jalons })
})

// POST /api/ateliers — create a workshop (auto-number)
router.post('/', requireRole('animateur', 'admin'), (req, res) => {
  const { date_atelier, heure, lieu } = req.body
  const facilitateur_id = req.user?.id || null

  const maxRow = db.prepare('SELECT MAX(numero) as max_num FROM atelier_pipeline').get() as { max_num: number | null }
  const numero = (maxRow.max_num || 0) + 1

  const out = db.transaction(() => {
    const r = db.prepare(`
      INSERT INTO activites (type, titre, statut, anime_par, cree_par)
      VALUES ('atelier', ?, 'preparation', ?, ?)
    `).run(`Atelier #${numero}`, facilitateur_id, facilitateur_id)
    const aid = Number(r.lastInsertRowid)
    db.prepare(`
      INSERT INTO atelier_pipeline (activite_id, numero, date_atelier, heure, lieu, facilitateur_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(aid, numero, date_atelier || null, heure || null, lieu || null, facilitateur_id)
    return aid
  })()

  res.status(201).json({ id: out, numero })
})

// POST /api/ateliers/:id/sources — add source to workshop (NO statut change)
router.post('/:id/sources', requireRole('animateur', 'admin'), (req, res) => {
  const { source_id } = req.body
  const atelierId = req.params.id

  const maxOrdre = db.prepare(
    'SELECT MAX(ordre) as max_o FROM activite_sources WHERE activite_id = ?'
  ).get(atelierId) as { max_o: number | null }
  const ordre = (maxOrdre?.max_o || 0) + 1

  db.prepare(
    'INSERT OR IGNORE INTO activite_sources (activite_id, source_id, ordre) VALUES (?, ?, ?)'
  ).run(atelierId, source_id, ordre)

  res.json({ ok: true })
})

// DELETE /api/ateliers/:id/sources/:sourceId — remove source from workshop
router.delete('/:id/sources/:sourceId', requireRole('animateur', 'admin'), (req, res) => {
  db.prepare(
    'DELETE FROM activite_sources WHERE activite_id = ? AND source_id = ?'
  ).run(req.params.id, req.params.sourceId)
  res.json({ ok: true })
})

// GET /api/ateliers/:id/diversite — profil de diversite du corpus + suggestions
//
// Methode de selection « decrire, ne pas noter » : on ne renvoie PAS un score de
// l'atelier, mais le PROFIL DE DIVERSITE de son corpus (axes factuels, alertes
// douces, completude) et des SUGGESTIONS de complement (cartes du vivier qui
// comblent un axe faible). Lecture seule, aucun effet de bord. Voir lib/diversite.ts.
router.get('/:id/diversite', (req, res) => {
  const atelier = db.prepare("SELECT id FROM activites WHERE id = ? AND type = 'atelier'").get(req.params.id)
  if (!atelier) { res.status(404).json({ error: 'Atelier introuvable' }); return }

  const corpus = db.prepare(
    'SELECT source_id FROM activite_sources WHERE activite_id = ? ORDER BY ordre ASC'
  ).all(req.params.id) as { source_id: number }[]
  const corpusIds = corpus.map(r => r.source_id)

  const profil = profilDiversiteCorpus(corpusIds)
  const avecSuggestions = String(req.query.suggestions ?? '') === '1'
  const suggestions = avecSuggestions ? suggestionsDiversite(corpusIds) : []

  res.json({ ...profil, suggestions })
})

// PATCH /api/ateliers/:id/sources/order — reorder sources
router.patch('/:id/sources/order', requireRole('animateur', 'admin'), (req, res) => {
  const { source_ids } = req.body as { source_ids: number[] }
  if (!Array.isArray(source_ids)) { res.status(400).json({ error: 'source_ids requis' }); return }

  const stmt = db.prepare(
    'UPDATE activite_sources SET ordre = ? WHERE activite_id = ? AND source_id = ?'
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

  const atelier = db.prepare("SELECT id FROM activites WHERE id = ? AND type = 'atelier'").get(atelierId)
  if (!atelier) { res.status(404).json({ error: 'Atelier introuvable' }); return }

  const tx = db.transaction(() => {
    const updates: string[] = []
    const params: unknown[] = []
    if (observations_surprise !== undefined) { updates.push('observations_surprise = ?'); params.push(observations_surprise) }
    if (questions_restantes !== undefined) { updates.push('questions_restantes = ?'); params.push(questions_restantes) }
    if (nb_participants !== undefined) { updates.push('nb_participants = ?'); params.push(nb_participants) }
    if (updates.length > 0) {
      params.push(atelierId)
      db.prepare(`UPDATE atelier_pipeline SET ${updates.join(', ')} WHERE activite_id = ?`).run(...params)
    }

    if (Array.isArray(mecanisme_ids)) {
      db.prepare('DELETE FROM activite_mecanismes WHERE activite_id = ?').run(atelierId)
      const ins = db.prepare('INSERT OR IGNORE INTO activite_mecanismes (activite_id, mecanisme_id) VALUES (?, ?)')
      for (const mid of mecanisme_ids) ins.run(atelierId, mid)
    }
  })
  tx()

  res.json({ ok: true })
})

// PATCH /api/ateliers/:id — update workshop fields (statut -> activites, le reste -> atelier_pipeline)
router.patch('/:id', requireRole('animateur', 'admin'), (req, res) => {
  const pipelineFields = [
    'source_choisie_id', 'nb_participants', 'compte_rendu',
    'observations', 'observations_surprise', 'questions_restantes',
    'mecanisme_identifie', 'date_atelier', 'heure', 'lieu',
  ]
  const pipUpdates: string[] = []
  const pipParams: unknown[] = []
  let statutValue: unknown
  let hasStatut = false

  for (const [key, value] of Object.entries(req.body)) {
    if (key === 'statut') { hasStatut = true; statutValue = value }
    else if (pipelineFields.includes(key)) { pipUpdates.push(`${key} = ?`); pipParams.push(value) }
  }

  if (!hasStatut && pipUpdates.length === 0) { res.status(400).json({ error: 'Rien a modifier' }); return }

  const tx = db.transaction(() => {
    if (hasStatut) {
      db.prepare("UPDATE activites SET statut = ?, maj_le = CURRENT_TIMESTAMP WHERE id = ? AND type = 'atelier'")
        .run(statutValue, req.params.id)
    }
    if (pipUpdates.length > 0) {
      pipParams.push(req.params.id)
      db.prepare(`UPDATE atelier_pipeline SET ${pipUpdates.join(', ')} WHERE activite_id = ?`).run(...pipParams)
    }
  })
  tx()
  res.json({ ok: true })
})

// GET /api/ateliers/:id/print — printable HTML (neutral fiches for the table)
router.get('/:id/print', (req, res) => {
  const atelier = db.prepare(`
    SELECT ${ATELIER_COLS} ${ATELIER_FROM}
    WHERE a.type = 'atelier' AND a.id = ?
  `).get(req.params.id) as Record<string, unknown> | undefined
  if (!atelier) { res.status(404).json({ error: 'Atelier introuvable' }); return }

  const sources = db.prepare(`
    SELECT s.*, m.nom as media_nom, a2.nom as auteur_nom, asrc.ordre
    FROM activite_sources asrc
    JOIN sources s ON s.id = asrc.source_id
    LEFT JOIN medias m ON s.media_id = m.id
    LEFT JOIN auteurs a2 ON s.auteur_id = a2.id
    WHERE asrc.activite_id = ?
    ORDER BY asrc.ordre ASC, s.id ASC
  `).all(req.params.id) as Array<Record<string, unknown>>

  const sourcesEnriched = sources.map(s => {
    const archive = db.prepare(
      'SELECT contenu FROM archives WHERE source_id = ? ORDER BY cree_le DESC LIMIT 1'
    ).get(s.id as number) as { contenu: string | null } | undefined
    return { ...(s as Record<string, unknown>), archive } as Record<string, unknown> & { archive: { contenu: string | null } | undefined }
  })

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
