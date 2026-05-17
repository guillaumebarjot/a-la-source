import { useState } from 'react'
import { api } from '../../api/client'

interface Props {
  onCreated: () => void
  onClose: () => void
}

interface PreviewData {
  titre: string | null
  media_nom: string | null
  auteur_nom: string | null
  date_publication: string | null
  paywall: boolean
  accroche: string | null
  mots_cles: string | null
  image_url: string | null
}

type Step = 'url' | 'preview' | 'done'

export default function SubmitSource({ onCreated, onClose }: Props) {
  const [url, setUrl] = useState('')
  const [step, setStep] = useState<Step>('url')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [error, setError] = useState('')

  // Editable overrides
  const [titre, setTitre] = useState('')
  const [mediaNom, setMediaNom] = useState('')
  const [auteurNom, setAuteurNom] = useState('')

  async function fetchPreview() {
    if (!url) return
    setLoading(true)
    setError('')
    try {
      const data = await api.post<PreviewData>('/sources/preview-url', { url })
      setPreview(data)
      setTitre(data.titre || '')
      setMediaNom(data.media_nom || '')
      setAuteurNom(data.auteur_nom || '')
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de recuperer les metadonnees')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      await api.post('/sources/from-url', { url })
      setStep('done')
      setTimeout(() => {
        onCreated()
        onClose()
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la creation')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && step === 'url') {
      e.preventDefault()
      fetchPreview()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-submit" onClick={(e) => e.stopPropagation()}>
        <h2>Soumettre une source</h2>

        {step === 'url' && (
          <>
            <p className="submit-hint">Collez l'URL de l'article. Les metadonnees seront recuperees automatiquement.</p>
            <div className="submit-url-row">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://..."
                autoFocus
                className="submit-url-input"
              />
              <button
                onClick={fetchPreview}
                disabled={!url || loading}
                className="btn btn-primary"
              >
                {loading ? 'Analyse...' : 'Analyser'}
              </button>
            </div>
            {error && <p className="submit-error">{error}</p>}
          </>
        )}

        {step === 'preview' && preview && (
          <>
            <div className="submit-preview">
              {preview.image_url && (
                <img src={preview.image_url} alt="" className="submit-preview-img" />
              )}
              <div className="submit-preview-fields">
                <label>
                  Titre
                  <input value={titre} onChange={(e) => setTitre(e.target.value)} />
                </label>
                <div className="submit-preview-row">
                  <label>
                    Media
                    <input value={mediaNom} onChange={(e) => setMediaNom(e.target.value)} />
                  </label>
                  <label>
                    Auteur
                    <input value={auteurNom} onChange={(e) => setAuteurNom(e.target.value)} />
                  </label>
                </div>
                {preview.date_publication && (
                  <p className="submit-meta">Date : {preview.date_publication}</p>
                )}
                {preview.paywall && (
                  <p className="submit-meta submit-meta--warn">Paywall detecte</p>
                )}
                {preview.accroche && (
                  <p className="submit-accroche">{preview.accroche}</p>
                )}
                {preview.mots_cles && (
                  <div className="submit-keywords">
                    {preview.mots_cles.split(',').map((k, i) => (
                      <span key={i} className="badge badge-mot-clef">{k.trim()}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {error && <p className="submit-error">{error}</p>}
            <div className="modal-actions">
              <button onClick={() => setStep('url')} className="btn btn-secondary">Modifier l'URL</button>
              <button onClick={handleSubmit} disabled={loading} className="btn btn-primary">
                {loading ? 'Creation...' : 'Soumettre + Archiver'}
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <div className="submit-done">
            <p>Source ajoutee ! Archivage en cours...</p>
          </div>
        )}

        {step === 'url' && (
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">Annuler</button>
          </div>
        )}
      </div>
    </div>
  )
}
