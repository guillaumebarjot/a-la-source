import { useState } from 'react'
import { api } from '../../api/client'

interface Props {
  onCreated: () => void
  onClose: () => void
}

export default function SubmitSource({ onCreated, onClose }: Props) {
  const [titre, setTitre] = useState('')
  const [url, setUrl] = useState('')
  const [mediaNom, setMediaNom] = useState('')
  const [auteurNom, setAuteurNom] = useState('')
  const [typeSource, setTypeSource] = useState('')
  const [datePublication, setDatePublication] = useState('')
  const [paywall, setPaywall] = useState(false)
  const [accroche, setAccroche] = useState('')
  const [loading, setLoading] = useState(false)

  const types = ['presse mainstream', 'PQR', 'pure player', 'video', 'radio', 'rapport', 'lobby', 'associatif', 'officiel', 'tribune']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titre) return
    setLoading(true)
    try {
      await api.post('/sources', {
        titre, url: url || null, media_nom: mediaNom || null,
        auteur_nom: auteurNom || null, type_source: typeSource || null,
        date_publication: datePublication || null, paywall, accroche: accroche || null,
      })
      onCreated()
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>Soumettre une source</h2>
        <label>
          Titre *
          <input value={titre} onChange={(e) => setTitre(e.target.value)} required />
        </label>
        <label>
          URL
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        </label>
        <label>
          Media
          <input value={mediaNom} onChange={(e) => setMediaNom(e.target.value)} placeholder="Le Monde, BFM..." />
        </label>
        <label>
          Auteur
          <input value={auteurNom} onChange={(e) => setAuteurNom(e.target.value)} />
        </label>
        <label>
          Type
          <select value={typeSource} onChange={(e) => setTypeSource(e.target.value)}>
            <option value="">—</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          Date de publication
          <input type="date" value={datePublication} onChange={(e) => setDatePublication(e.target.value)} />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={paywall} onChange={(e) => setPaywall(e.target.checked)} />
          Paywall
        </label>
        <label>
          Accroche
          <textarea value={accroche} onChange={(e) => setAccroche(e.target.value)} rows={2} />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary">Annuler</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Envoi...' : 'Soumettre'}
          </button>
        </div>
      </form>
    </div>
  )
}
