import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../store/useAuth'
import { api } from '../api/client'
import SubNav from '../components/layout/SubNav'

interface Parametre {
  cle: string
  valeur: unknown
  modifie_le: string
}

const SUBNAV_ITEMS = [
  { label: 'Parametrage', to: '/admin/parametrage' },
  { label: 'Utilisateurs', to: '/admin/utilisateurs' },
]

export default function AdminParametrage() {
  const { section } = useParams<{ section?: string }>()
  const user = useAuth((s) => s.user)
  const [parametres, setParametres] = useState<Parametre[]>([])
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.get<Parametre[]>('/parametres').then(setParametres).catch(() => {})
  }, [])

  if (!user || user.role !== 'admin') {
    return <Navigate to="/flux" replace />
  }

  const startEdit = (p: Parametre) => {
    setEditKey(p.cle)
    setEditValue(JSON.stringify(p.valeur, null, 2))
  }

  const saveParam = async () => {
    if (!editKey) return
    try {
      const valeur = JSON.parse(editValue)
      await api.put(`/parametres/${editKey}`, { valeur })
      setParametres((prev) =>
        prev.map((p) => p.cle === editKey ? { ...p, valeur, modifie_le: new Date().toISOString() } : p)
      )
      setEditKey(null)
      setMessage('Parametre sauvegarde')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('JSON invalide')
    }
  }

  const addParam = async () => {
    const cle = prompt('Cle du parametre :')
    if (!cle) return
    try {
      await api.put(`/parametres/${cle}`, { valeur: {} })
      setParametres((prev) => [...prev, { cle, valeur: {}, modifie_le: new Date().toISOString() }])
    } catch {
      setMessage('Erreur lors de la creation')
    }
  }

  return (
    <div className="page-admin">
      <h1>Administration</h1>
      <SubNav items={SUBNAV_ITEMS} />
      <p className="page-intro">
        Configuration des courbes de fraicheur, poids du score atelier, et formule de confiance media.
      </p>

      {message && <div className="alert">{message}</div>}

      {(!section || section === 'parametrage') && (
        <section className="admin-section">
          <h2>Parametres</h2>
          <button className="btn btn-sm" onClick={addParam}>+ Ajouter un parametre</button>

          <div className="parametres-list">
            {parametres.map((p) => (
              <div key={p.cle} className="parametre-item">
                <div className="parametre-header">
                  <code className="parametre-cle">{p.cle}</code>
                  <small className="parametre-date">Modifie le {new Date(p.modifie_le).toLocaleDateString('fr-FR')}</small>
                  <button className="btn btn-sm" onClick={() => startEdit(p)}>Modifier</button>
                </div>
                {editKey === p.cle ? (
                  <div className="parametre-edit">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={6}
                      className="parametre-textarea"
                    />
                    <div className="parametre-actions">
                      <button className="btn btn-primary btn-sm" onClick={saveParam}>Sauvegarder</button>
                      <button className="btn btn-sm" onClick={() => setEditKey(null)}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <pre className="parametre-valeur">{JSON.stringify(p.valeur, null, 2)}</pre>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {section === 'utilisateurs' && (
        <section className="admin-section">
          <h2>Utilisateurs</h2>
          <p className="empty">Section a venir.</p>
        </section>
      )}
    </div>
  )
}
