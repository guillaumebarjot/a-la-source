import { Router } from 'express'
import db from '../lib/db.js'

const router = Router()

// GET /api/auth/me — utilisateur courant
router.get('/me', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Non authentifie' }); return }
  res.json(req.user)
})

// GET /api/auth/users — liste des utilisateurs (admin)
router.get('/users', (req, res) => {
  if (req.user?.role !== 'admin') { res.status(403).json({ error: 'Admin requis' }); return }
  const users = db.prepare('SELECT id, nom, role, actif, cree_le FROM utilisateurs').all()
  res.json(users)
})

// PATCH /api/auth/users/:id — modifier role (admin)
router.patch('/users/:id', (req, res) => {
  if (req.user?.role !== 'admin') { res.status(403).json({ error: 'Admin requis' }); return }
  const { role, actif } = req.body
  if (role) db.prepare('UPDATE utilisateurs SET role = ? WHERE id = ?').run(role, req.params.id)
  if (actif !== undefined) db.prepare('UPDATE utilisateurs SET actif = ? WHERE id = ?').run(actif ? 1 : 0, req.params.id)
  res.json({ ok: true })
})

// GET /api/auth/lectures — lectures de l'utilisateur courant
router.get('/lectures', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Non authentifie' }); return }
  const lectures = db.prepare(`
    SELECT l.*, s.titre, s.url, m.nom as media_nom
    FROM lectures l
    JOIN sources s ON s.id = l.source_id
    LEFT JOIN medias m ON s.media_id = m.id
    WHERE l.utilisateur_id = ?
    ORDER BY l.date_maj DESC
  `).all(req.user.id)
  res.json(lectures)
})

// POST /api/auth/lectures — marquer lu / a_lire / recommander
router.post('/lectures', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Non authentifie' }); return }
  const { source_id, statut, recommande_a } = req.body
  if (!source_id || !statut) { res.status(400).json({ error: 'source_id et statut requis' }); return }

  db.prepare(`
    INSERT INTO lectures (source_id, utilisateur_id, statut, recommande_a)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(source_id, utilisateur_id) DO UPDATE SET
      statut = excluded.statut,
      recommande_a = excluded.recommande_a,
      date_maj = CURRENT_TIMESTAMP
  `).run(source_id, req.user.id, statut, recommande_a || null)
  res.json({ ok: true })
})

// GET /api/auth/recommandations — recommandations recues
router.get('/recommandations', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Non authentifie' }); return }
  const recs = db.prepare(`
    SELECT l.*, s.titre, s.url, m.nom as media_nom, u.nom as recommande_par_nom
    FROM lectures l
    JOIN sources s ON s.id = l.source_id
    LEFT JOIN medias m ON s.media_id = m.id
    JOIN utilisateurs u ON l.utilisateur_id = u.id
    WHERE l.recommande_a = ? AND l.statut = 'recommande'
    ORDER BY l.date_maj DESC
  `).all(req.user.id)
  res.json(recs)
})

export default router
