import { useState, useEffect } from 'react'
import { api } from '../../api/client'
import type { SourceMecanisme, MecanismeReference } from '../../types'

interface Props {
  sourceId: number
  mecanismes: SourceMecanisme[]
  onRefresh: () => void
}

export default function MecanismesPanel({ sourceId, mecanismes, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [refs, setRefs] = useState<MecanismeReference[]>([])
  const [selectedId, setSelectedId] = useState<number | ''>('')
  const [justification, setJustification] = useState('')

  useEffect(() => {
    if (showForm && refs.length === 0) {
      api.get<MecanismeReference[]>('/mecanismes').then(setRefs)
    }
  }, [showForm, refs.length])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    await api.post('/mecanismes/identifier', {
      source_id: sourceId, mecanisme_id: selectedId, justification,
    })
    setShowForm(false)
    setSelectedId('')
    setJustification('')
    onRefresh()
  }

  return (
    <>
      {mecanismes.length === 0 && <p className="empty-small">Aucun mecanisme identifie.</p>}
      {mecanismes.map((m) => (
        <div key={m.id} className="mecanisme-item">
          <strong>{m.mecanisme_nom}</strong>
          {m.identifie_par_nom && <span className="mecanisme-by"> — par {m.identifie_par_nom}</span>}
          {m.justification && <p className="mecanisme-justif">{m.justification}</p>}
        </div>
      ))}
      {!showForm ? (
        <button className="btn btn-sm" onClick={() => setShowForm(true)}>+ Identifier un mecanisme</button>
      ) : (
        <form className="mecanisme-form" onSubmit={handleSubmit}>
          <select value={selectedId} onChange={(e) => setSelectedId(Number(e.target.value) || '')}>
            <option value="">Choisir...</option>
            {refs.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
          </select>
          <textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Justification (optionnel)" rows={2} />
          <div className="form-actions">
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
            <button type="submit" className="btn btn-sm btn-primary">Valider</button>
          </div>
        </form>
      )}
    </>
  )
}
