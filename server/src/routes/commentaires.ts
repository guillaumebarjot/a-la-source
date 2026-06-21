import { Router } from 'express'
import db from '../lib/db.js'

const router = Router()

// GET /api/commentaires/:sourceId
router.get('/:sourceId', (req, res) => {
  const commentaires = db.prepare(`
    SELECT c.*, u.nom as auteur_nom
    FROM commentaires c
    LEFT JOIN utilisateurs u ON c.auteur_id = u.id
    WHERE c.source_id = ?
    ORDER BY c.cree_le DESC
  `).all(req.params.sourceId)
  res.json(commentaires)
})

// POST /api/commentaires
router.post('/', (req, res) => {
  const { source_id, contenu, type, url } = req.body
  if (!source_id || !contenu || !req.user) {
    res.status(400).json({ error: 'source_id, contenu et auth requis' }); return
  }

  const r = db.prepare(`
    INSERT INTO commentaires (source_id, auteur_id, type, contenu, url)
    VALUES (?, ?, ?, ?, ?)
  `).run(source_id, req.user.id, type || 'commentaire', contenu, url || null)

  res.status(201).json({ id: Number(r.lastInsertRowid) })
})

// PUT /api/commentaires/:id — édition d'un commentaire.
// Un commentaire créé via Discord (origine='discord') n'est PAS verrouillé : il est
// éditable dans l'app par son auteur rapproché (le membre crédité auteur_id) ou par
// un admin, exactement comme un commentaire créé dans l'app. Pas de distinction de
// traitement par origine — la colonne `origine` ne sert qu'à l'affichage côté client.
router.put('/:id', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Auth requise' }); return }
  const { contenu, url } = req.body
  if (typeof contenu !== 'string' || !contenu.trim()) {
    res.status(400).json({ error: 'contenu requis' }); return
  }

  const c = db.prepare('SELECT id, auteur_id FROM commentaires WHERE id = ?').get(req.params.id) as { id: number; auteur_id: number | null } | undefined
  if (!c) { res.status(404).json({ error: 'Commentaire introuvable' }); return }

  const estAuteur = c.auteur_id != null && c.auteur_id === req.user.id
  if (!estAuteur && req.user.role !== 'admin') {
    res.status(403).json({ error: 'Seul l\'auteur ou un admin peut modifier ce commentaire' }); return
  }

  // url : optionnel, modifiable uniquement si fourni explicitement (commentaires type 'lien').
  if (url !== undefined) {
    db.prepare('UPDATE commentaires SET contenu = ?, url = ? WHERE id = ?').run(contenu.trim(), url || null, c.id)
  } else {
    db.prepare('UPDATE commentaires SET contenu = ? WHERE id = ?').run(contenu.trim(), c.id)
  }
  res.json({ ok: true })
})

// DELETE /api/commentaires/:id — auteur rapproché ou admin.
router.delete('/:id', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Auth requise' }); return }
  const c = db.prepare('SELECT id, auteur_id FROM commentaires WHERE id = ?').get(req.params.id) as { id: number; auteur_id: number | null } | undefined
  if (!c) { res.json({ ok: true }); return }
  const estAuteur = c.auteur_id != null && c.auteur_id === req.user.id
  if (!estAuteur && req.user.role !== 'admin') {
    res.status(403).json({ error: 'Seul l\'auteur ou un admin peut supprimer ce commentaire' }); return
  }
  db.prepare('DELETE FROM commentaires WHERE id = ?').run(c.id)
  res.json({ ok: true })
})

export default router
