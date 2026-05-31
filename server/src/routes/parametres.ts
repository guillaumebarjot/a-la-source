import { Router } from 'express'
import db from '../lib/db.js'
import { requireRole } from '../lib/auth.js'

const router = Router()

// GET /api/parametres — liste tous les parametres
router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT cle, valeur, modifie_le FROM parametres ORDER BY cle').all() as {
    cle: string; valeur: string; modifie_le: string
  }[]
  const result = rows.map((r) => ({
    cle: r.cle,
    valeur: JSON.parse(r.valeur),
    modifie_le: r.modifie_le
  }))
  res.json(result)
})

// GET /api/parametres/:cle — un parametre
router.get('/:cle', (req, res) => {
  const row = db.prepare('SELECT cle, valeur, modifie_le FROM parametres WHERE cle = ?').get(req.params.cle) as {
    cle: string; valeur: string; modifie_le: string
  } | undefined
  if (!row) return res.status(404).json({ error: 'Parametre introuvable' })
  res.json({ cle: row.cle, valeur: JSON.parse(row.valeur), modifie_le: row.modifie_le })
})

// PUT /api/parametres/:cle — creer ou mettre a jour (admin only)
router.put('/:cle', requireRole('admin'), (req, res) => {
  const { valeur } = req.body
  if (valeur === undefined) return res.status(400).json({ error: 'valeur requise' })

  const json = JSON.stringify(valeur)
  db.prepare(`
    INSERT INTO parametres (cle, valeur, modifie_le) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur, modifie_le = CURRENT_TIMESTAMP
  `).run(req.params.cle, json)

  res.json({ cle: req.params.cle, valeur, modifie_le: new Date().toISOString() })
})

// DELETE /api/parametres/:cle (admin only)
router.delete('/:cle', requireRole('admin'), (req, res) => {
  const result = db.prepare('DELETE FROM parametres WHERE cle = ?').run(req.params.cle)
  if (result.changes === 0) return res.status(404).json({ error: 'Parametre introuvable' })
  res.json({ ok: true })
})

export default router
