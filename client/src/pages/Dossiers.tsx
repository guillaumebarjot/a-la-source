import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { DossierListItem } from '../types/dossier'
import '../styles/dossier.css'

/**
 * Dossiers & décryptages — activité d'éducation populaire aux médias.
 *
 * Le dossier est un format de fond sur un thème (mise en perspective, sources,
 * mécanismes récurrents). Le décryptage est un dossier daté « à chaud » sur un
 * événement. Cette page liste les dossiers (filtre fond / à chaud) et permet
 * d'en créer un.
 */

type Filtre = 'tous' | 'fond' | 'chaud'

export default function Dossiers() {
  const [items, setItems] = useState<DossierListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [creating, setCreating] = useState(false)
  const [titre, setTitre] = useState('')
  const [perspective, setPerspective] = useState('')
  const [aChaud, setAChaud] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get<DossierListItem[]>('/dossiers')
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  const visibles = useMemo(() => {
    if (filtre === 'fond') return items.filter((d) => !d.a_chaud)
    if (filtre === 'chaud') return items.filter((d) => !!d.a_chaud)
    return items
  }, [items, filtre])

  async function creer(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) return
    setErreur(null)
    try {
      const { id } = await api.post<{ id: number }>('/dossiers', {
        titre: titre.trim(),
        mise_en_perspective_md: perspective.trim() || undefined,
        a_chaud: aChaud,
      })
      navigate(`/dossiers/${id}`)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur a la creation')
    }
  }

  if (loading) return <div className="loading">Chargement des dossiers...</div>

  const nbFond = items.filter((d) => !d.a_chaud).length
  const nbChaud = items.filter((d) => !!d.a_chaud).length

  return (
    <div className="dossier-page">
      <header className="dossier-header">
        <h1>Dossiers & decryptages</h1>
        <p className="dossier-intro">
          Le dossier est un format de fond sur un theme : on met en perspective, on rassemble des
          sources de reference et on degage les mecanismes recurrents. Le decryptage est un dossier
          date, fait a chaud sur un evenement. La source est une carte : une image et un titre. Pour
          la critique des medias, on s'appuie sur Acrimed.
        </p>
      </header>

      <section className="dossier-section">
        {creating ? (
          <form className="dossier-create-form" onSubmit={creer}>
            <div>
              <label className="dossier-field-label" htmlFor="dos-titre">Titre du dossier</label>
              <input
                id="dos-titre"
                className="dossier-input"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex : Comment les medias traitent..."
                autoFocus
              />
            </div>
            <div>
              <label className="dossier-field-label" htmlFor="dos-persp">Mise en perspective (optionnel)</label>
              <textarea
                id="dos-persp"
                className="dossier-textarea"
                value={perspective}
                onChange={(e) => setPerspective(e.target.value)}
                placeholder="Le cadre, l'angle, ce qui se joue derriere le sujet."
              />
            </div>
            <label className="dossier-toggle">
              <input type="checkbox" checked={aChaud} onChange={(e) => setAChaud(e.target.checked)} />
              <span>Decryptage a chaud (dossier date sur un evenement)</span>
            </label>
            {erreur && <p className="dossier-empty">{erreur}</p>}
            <div className="dossier-actions">
              <button type="submit" className="btn btn-primary" disabled={!titre.trim()}>Creer</button>
              <button type="button" className="btn btn-secondary" onClick={() => setCreating(false)}>Annuler</button>
            </div>
          </form>
        ) : (
          <div className="dossier-toolbar">
            <div className="dossier-filtres" role="tablist">
              <button
                className={`dossier-filtre${filtre === 'tous' ? ' active' : ''}`}
                onClick={() => setFiltre('tous')}
              >
                Tous ({items.length})
              </button>
              <button
                className={`dossier-filtre${filtre === 'fond' ? ' active' : ''}`}
                onClick={() => setFiltre('fond')}
              >
                De fond ({nbFond})
              </button>
              <button
                className={`dossier-filtre${filtre === 'chaud' ? ' active' : ''}`}
                onClick={() => setFiltre('chaud')}
              >
                A chaud ({nbChaud})
              </button>
            </div>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>Nouveau dossier</button>
          </div>
        )}
      </section>

      {visibles.length === 0 ? (
        <p className="dossier-empty">Aucun dossier pour ce filtre.</p>
      ) : (
        <div className="dossier-grid">
          {visibles.map((d) => (
            <Link key={d.id} to={`/dossiers/${d.id}`} className="dossier-card">
              <div className="dossier-card-head">
                <h2 className="dossier-card-titre">{d.titre}</h2>
                {!!d.a_chaud && <span className="dossier-badge chaud">A chaud</span>}
              </div>
              {d.sujet_titre && <p className="dossier-card-sub">Theme : {d.sujet_titre}</p>}
              {!!d.a_chaud && d.evenement_titre && (
                <p className="dossier-card-sub">
                  Evenement : {d.evenement_titre}
                  {d.date_evenement ? ` (${d.date_evenement})` : ''}
                </p>
              )}
              <div className="dossier-card-meta">
                <span className={`dossier-badge${d.statut_activite === 'publie' ? ' publie' : ''}`}>
                  {d.statut_activite === 'publie' ? 'Publie' : 'Brouillon'}
                </span>
                <span>{d.nb_sources} source{d.nb_sources > 1 ? 's' : ''}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
