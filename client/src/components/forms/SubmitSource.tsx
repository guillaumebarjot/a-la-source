import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { api } from '../../api/client'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
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
type PaywallMode = 'lien' | 'pdf' | null

export default function SubmitSource({ open, onOpenChange, onCreated }: Props) {
  const [url, setUrl] = useState('')
  const [step, setStep] = useState<Step>('url')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [error, setError] = useState('')

  // Editable overrides
  const [titre, setTitre] = useState('')
  const [mediaNom, setMediaNom] = useState('')
  const [auteurNom, setAuteurNom] = useState('')

  // Résolution paywall
  const [paywallMode, setPaywallMode] = useState<PaywallMode>(null)
  const [altUrl, setAltUrl] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  function resetPaywall() {
    setPaywallMode(null)
    setAltUrl('')
    setPdfFile(null)
  }

  async function fetchPreview() {
    if (!url) return
    setLoading(true)
    setError('')
    resetPaywall()
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

  // Une résolution paywall est jugée fournie si un lien alternatif non vide ou un PDF est donné.
  const paywallResolu =
    (paywallMode === 'lien' && altUrl.trim().length > 0) ||
    (paywallMode === 'pdf' && pdfFile !== null)

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const created = await api.post<{ id: number; paywall: boolean }>('/sources/from-url', { url })
      // Si paywall et qu'un accès complet est fourni, on archive depuis le lien original ou le PDF.
      if (preview?.paywall && paywallResolu) {
        if (paywallMode === 'lien') {
          await api.post(`/sources/${created.id}/archiver`, { url: altUrl.trim() })
        } else if (paywallMode === 'pdf' && pdfFile) {
          const fd = new FormData()
          fd.append('fichier', pdfFile)
          await api.upload(`/sources/${created.id}/archive-fichier`, fd)
        }
      }
      setStep('done')
      setTimeout(() => {
        onCreated()
        onOpenChange(false)
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

  // Libellé du bouton de soumission, sensible au paywall.
  const submitLabel = loading
    ? 'Creation...'
    : preview?.paywall
      ? (paywallResolu ? 'Soumettre + Archiver' : 'Soumettre sans archive complete')
      : 'Soumettre + Archiver'

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="modal-overlay" />
      <Dialog.Content className="modal modal-submit">
        <Dialog.Title>Soumettre une source</Dialog.Title>

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
                <img src={preview.image_url} alt="" className="submit-preview-img" referrerPolicy="no-referrer" />
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

            {preview.paywall && (
              <div className="submit-paywall">
                <p className="submit-meta submit-meta--warn">
                  Paywall detecte. L'archive automatique sera partielle. Pour conserver le contenu complet, fournissez un acces :
                </p>
                <div className="submit-paywall-modes">
                  <label className="submit-paywall-choice">
                    <input
                      type="radio"
                      name="paywall-mode"
                      checked={paywallMode === 'lien'}
                      onChange={() => setPaywallMode('lien')}
                    />
                    Lien original accessible
                  </label>
                  <label className="submit-paywall-choice">
                    <input
                      type="radio"
                      name="paywall-mode"
                      checked={paywallMode === 'pdf'}
                      onChange={() => setPaywallMode('pdf')}
                    />
                    PDF de l'article
                  </label>
                </div>
                {paywallMode === 'lien' && (
                  <input
                    type="url"
                    value={altUrl}
                    onChange={(e) => setAltUrl(e.target.value)}
                    placeholder="https://... (archive, reprise, version libre)"
                    className="submit-url-input"
                  />
                )}
                {paywallMode === 'pdf' && (
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                    className="submit-paywall-file"
                  />
                )}
              </div>
            )}

            {error && <p className="submit-error">{error}</p>}
            <div className="modal-actions">
              <button onClick={() => { setStep('url'); resetPaywall() }} className="btn btn-secondary">Modifier l'URL</button>
              <button onClick={handleSubmit} disabled={loading} className="btn btn-primary">
                {submitLabel}
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
            <button type="button" onClick={() => onOpenChange(false)} className="btn btn-secondary">Annuler</button>
          </div>
        )}
      </Dialog.Content>
    </Dialog.Portal>
  )
}
