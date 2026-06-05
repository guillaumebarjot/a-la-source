import { Router } from 'express'
import db from '../lib/db.js'
import { calculerConfianceMedia } from '../lib/score.js'

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

// GET /api/medias/confiance — score de confiance par media
router.get('/confiance', (_req, res) => {
  const medias = db.prepare('SELECT id, nom FROM medias').all() as { id: number; nom: string }[]
  const results = medias.map(m => {
    const conf = calculerConfianceMedia(m.id)
    return { media_id: m.id, media_nom: m.nom, ...conf }
  }).filter(r => r.nbSources > 0)
    .sort((a, b) => a.score - b.score)
  res.json(results)
})

// GET /api/medias/:id/stats — stats d'un media (confiance agregee)
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

  // Score confiance moyen
  const confiance = calculerConfianceMedia(Number(req.params.id))
  const score_confiance_moyen = confiance.nbSources > 0 ? confiance.score : null

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
    score_confiance_moyen,
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

export default router
