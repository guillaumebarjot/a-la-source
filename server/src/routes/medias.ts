import { Router } from 'express'
import db from '../lib/db.js'

const router = Router()

// Migration inline : ajouter colonne description si absente
try {
  db.prepare("SELECT description FROM medias LIMIT 1").get()
} catch {
  db.prepare("ALTER TABLE medias ADD COLUMN description TEXT").run()
}

// GET /api/medias
router.get('/', (_req, res) => {
  const medias = db.prepare(`
    SELECT m.*, COUNT(s.id) as nb_sources
    FROM medias m
    LEFT JOIN sources s ON s.media_id = m.id
    GROUP BY m.id
    ORDER BY nb_sources DESC
  `).all()
  res.json(medias)
})

// GET /api/medias/matrice — croise media x mecanisme
router.get('/matrice', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      s.media_id,
      m.nom as media_nom,
      sm.mecanisme_id,
      mr.nom as mecanisme_nom,
      COUNT(sm.id) as nb
    FROM source_mecanismes sm
    JOIN sources s ON s.id = sm.source_id
    JOIN medias m ON m.id = s.media_id
    JOIN mecanismes_reference mr ON mr.id = sm.mecanisme_id
    WHERE s.media_id IS NOT NULL
    GROUP BY s.media_id, sm.mecanisme_id
    ORDER BY m.nom, mr.nom
  `).all()
  res.json(rows)
})

// GET /api/medias/propriete-groupee — médias regroupés par actionnaire ultime / propriétaire
// Lecture seule. Retourne pour chaque groupe propriétaire les médias qui en dépendent,
// avec leur type_propriete et nb_sources. Aucun score, que des faits sourcés.
router.get('/propriete-groupee', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      m.id,
      m.nom,
      m.type,
      m.url_site,
      m.proprietaire,
      m.actionnaire_ultime,
      m.type_propriete,
      m.financement,
      m.annee_creation,
      m.ligne_revendiquee,
      COUNT(s.id) as nb_sources
    FROM medias m
    LEFT JOIN sources s ON s.media_id = m.id
    GROUP BY m.id
    HAVING nb_sources > 0 OR m.proprietaire IS NOT NULL OR m.actionnaire_ultime IS NOT NULL
    ORDER BY nb_sources DESC, m.nom
  `).all() as {
    id: number; nom: string; type: string | null; url_site: string | null;
    proprietaire: string | null; actionnaire_ultime: string | null;
    type_propriete: string | null; financement: string | null;
    annee_creation: number | null; ligne_revendiquee: string | null;
    nb_sources: number;
  }[]

  // Regrouper par actionnaire_ultime (ou propriétaire si pas d'ultime, sinon « Non renseigné »)
  const groupes: Record<string, { medias: typeof rows; type_propriete: string | null }> = {}
  for (const m of rows) {
    const cle = m.actionnaire_ultime || m.proprietaire || '(propriété non renseignée)'
    if (!groupes[cle]) groupes[cle] = { medias: [], type_propriete: m.type_propriete }
    groupes[cle].medias.push(m)
  }

  // Trier les groupes par nombre total de sources décroissant
  const result = Object.entries(groupes)
    .map(([groupe, data]) => ({
      groupe,
      type_propriete: data.type_propriete,
      nb_sources_total: data.medias.reduce((s, m) => s + m.nb_sources, 0),
      nb_medias: data.medias.length,
      medias: data.medias,
    }))
    .sort((a, b) => b.nb_sources_total - a.nb_sources_total)

  res.json(result)
})

// GET /api/medias/:id/stats — compteurs factuels d'un média + sources récentes.
// Aucun score de confiance : on décrit (compteurs), on ne note pas (doctrine epoché).
router.get('/:id/stats', (req, res) => {
  const base = db.prepare(`
    SELECT
      COUNT(DISTINCT s.id) as nb_sources,
      COUNT(DISTINCT e.id) as nb_evaluations,
      COUNT(DISTINCT c.id) as nb_commentaires,
      COUNT(DISTINCT sm.id) as nb_mecanismes
    FROM sources s
    LEFT JOIN evaluations e ON e.source_id = s.id
    LEFT JOIN commentaires c ON c.source_id = s.id
    LEFT JOIN source_mecanismes sm ON sm.source_id = s.id
    WHERE s.media_id = ?
  `).get(req.params.id) as { nb_sources: number; nb_evaluations: number; nb_commentaires: number; nb_mecanismes: number }

  // Mécanismes les plus repérés sur ce média (faits, pas un score)
  const mecanismes_reperes = db.prepare(`
    SELECT mr.nom, COUNT(sm.id) as nb
    FROM source_mecanismes sm
    JOIN sources s ON s.id = sm.source_id
    JOIN mecanismes_reference mr ON mr.id = sm.mecanisme_id
    WHERE s.media_id = ?
    GROUP BY mr.id
    ORDER BY nb DESC
    LIMIT 5
  `).all(req.params.id) as { nom: string; nb: number }[]

  // Sources recentes (5 dernieres)
  const sources_recentes = db.prepare(`
    SELECT id, titre, date_publication
    FROM sources
    WHERE media_id = ?
    ORDER BY date_publication DESC
    LIMIT 5
  `).all(req.params.id) as { id: number; titre: string; date_publication: string | null }[]

  res.json({
    nb_sources: base.nb_sources,
    nb_mecanismes: base.nb_mecanismes,
    nb_commentaires: base.nb_commentaires,
    nb_evaluations: base.nb_evaluations,
    mecanismes_reperes,
    sources_recentes,
  })
})

// GET /api/medias/:id — detail d'un media
router.get('/:id', (req, res) => {
  const media = db.prepare(`
    SELECT m.*, COUNT(s.id) as nb_sources
    FROM medias m
    LEFT JOIN sources s ON s.media_id = m.id
    WHERE m.id = ?
    GROUP BY m.id
  `).get(req.params.id)
  if (!media) { res.status(404).json({ error: 'Media non trouve' }); return }
  res.json(media)
})

// POST /api/medias
router.post('/', (req, res) => {
  const { nom, type, url_site } = req.body
  if (!nom) { res.status(400).json({ error: 'Nom requis' }); return }
  const r = db.prepare('INSERT OR IGNORE INTO medias (nom, type, url_site) VALUES (?, ?, ?)').run(nom, type || null, url_site || null)
  res.status(201).json({ id: Number(r.lastInsertRowid) })
})

// Champs de propriété éditables (Chantier A)
const PROPRIETE_FIELDS = [
  'proprietaire', 'actionnaire_ultime', 'type_propriete',
  'financement', 'annee_creation', 'ligne_revendiquee',
] as const

// PUT /api/medias/:id/propriete — édite la propriété structurée d'un média
router.put('/:id/propriete', (req, res) => {
  const exists = db.prepare('SELECT id FROM medias WHERE id = ?').get(req.params.id)
  if (!exists) { res.status(404).json({ error: 'Media non trouve' }); return }

  const sets: string[] = []
  const values: (string | number | null)[] = []
  for (const f of PROPRIETE_FIELDS) {
    if (f in req.body) {
      sets.push(`${f} = ?`)
      const v = req.body[f]
      values.push(v === '' || v === undefined ? null : v)
    }
  }
  if (sets.length === 0) { res.status(400).json({ error: 'Aucun champ de propriete fourni' }); return }

  values.push(req.params.id)
  db.prepare(`UPDATE medias SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  const media = db.prepare('SELECT * FROM medias WHERE id = ?').get(req.params.id)
  res.json(media)
})

// Profil de transparence (Chantier B) — critères factuels descriptifs, sans score
const TRANSPARENCE_FIELDS = [
  'distingue_info_opinion', 'publie_corrections', 'divulgue_propriete',
  'divulgue_financement', 'sans_publicite', 'credite_auteurs',
  'charte_deontologique', 'source_observation',
] as const

// GET /api/medias/:id/transparence — renvoie le profil (ou null si absent)
router.get('/:id/transparence', (req, res) => {
  const row = db.prepare('SELECT * FROM media_transparence WHERE media_id = ?').get(req.params.id)
  res.json(row ?? null)
})

// PUT /api/medias/:id/transparence — édite le profil de transparence
router.put('/:id/transparence', (req, res) => {
  const exists = db.prepare('SELECT id FROM medias WHERE id = ?').get(req.params.id)
  if (!exists) { res.status(404).json({ error: 'Media non trouve' }); return }

  const cols: string[] = ['media_id']
  const placeholders: string[] = ['@media_id']
  const params: Record<string, unknown> = { media_id: Number(req.params.id) }
  for (const f of TRANSPARENCE_FIELDS) {
    if (f in req.body) {
      cols.push(f)
      placeholders.push(`@${f}`)
      const v = req.body[f]
      params[f] = v === '' || v === undefined ? null : v
    }
  }
  const updates = cols.filter(c => c !== 'media_id').map(c => `${c} = excluded.${c}`).join(', ')
  db.prepare(`
    INSERT INTO media_transparence (${cols.join(', ')}, maj_le)
    VALUES (${placeholders.join(', ')}, CURRENT_TIMESTAMP)
    ON CONFLICT(media_id) DO UPDATE SET ${updates}, maj_le = CURRENT_TIMESTAMP
  `).run(params)

  res.json(db.prepare('SELECT * FROM media_transparence WHERE media_id = ?').get(req.params.id))
})

export default router
