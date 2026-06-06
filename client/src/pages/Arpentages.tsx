import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { ArpentageListItem } from '../types/arpentage'
import '../styles/arpentage.css'

/**
 * Arpentages — lecture collective fragmentee.
 *
 * Un document long est decoupe en fragments, chaque participant lit un
 * fragment, puis on met en commun et on synthetise collectivement. Cette page
 * liste les arpentages et permet d'en creer un. La source est une carte : une
 * image et un titre.
 */
export default function Arpentages() {
  const [items, setItems] = useState<ArpentageListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [titre, setTitre] = useState('')
  const [mode, setMode] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get<ArpentageListItem[]>('/arpentages')
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  async function creer(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) return
    setErreur(null)
    try {
      const { id } = await api.post<{ id: number }>('/arpentages', {
        titre: titre.trim(),
        mode_decoupage: mode.trim() || undefined,
      })
      navigate(`/arpentages/${id}`)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur a la creation')
    }
  }

  if (loading) return <div className="loading">Chargement des arpentages...</div>

  return (
    <div className="arp-page">
      <header className="arp-header">
        <h1>Arpentages</h1>
        <p className="arp-intro">
          L'arpentage est une lecture collective fragmentee : on decoupe un document long en
          morceaux, chaque participant lit un fragment, puis on met en commun les points cles, les
          citations et les questions pour batir une synthese partagee. La source est une carte : une
          image et un titre.
        </p>
      </header>

      <section className="arp-section">
        {creating ? (
          <form className="arp-create-form" onSubmit={creer}>
            <div>
              <label className="arp-field-label" htmlFor="arp-titre">Titre de l'arpentage</label>
              <input
                id="arp-titre"
                className="arp-input"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex : Lecture du rapport..."
                autoFocus
              />
            </div>
            <div>
              <label className="arp-field-label" htmlFor="arp-mode">Mode de decoupage (optionnel)</label>
              <input
                id="arp-mode"
                className="arp-input"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                placeholder="Ex : par chapitre, par nombre de pages egal..."
              />
            </div>
            {erreur && <p className="arp-empty">{erreur}</p>}
            <div className="arp-actions">
              <button type="submit" className="btn btn-primary" disabled={!titre.trim()}>Creer</button>
              <button type="button" className="btn btn-secondary" onClick={() => setCreating(false)}>Annuler</button>
            </div>
          </form>
        ) : (
          <div className="arp-toolbar">
            <span className="arp-count">{items.length} arpentage{items.length > 1 ? 's' : ''}</span>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>Nouvel arpentage</button>
          </div>
        )}
      </section>

      {items.length === 0 ? (
        <p className="arp-empty">Aucun arpentage pour l'instant.</p>
      ) : (
        <div className="arp-grid">
          {items.map((a) => (
            <Link key={a.id} to={`/arpentages/${a.id}`} className="arp-card">
              <div className="arp-card-head">
                <h2 className="arp-card-titre">{a.titre}</h2>
                <span className={`arp-badge${a.statut_activite === 'publie' ? ' publie' : ''}`}>
                  {a.statut_activite === 'publie' ? 'Publie' : 'Brouillon'}
                </span>
              </div>
              {a.sujet_titre && <p className="arp-card-sub">Theme : {a.sujet_titre}</p>}
              {a.source_titre && <p className="arp-card-sub">Document : {a.source_titre}</p>}
              {a.mode_decoupage && <p className="arp-card-sub">Decoupage : {a.mode_decoupage}</p>}
              <div className="arp-card-meta">
                <span>{a.nb_fragments} fragment{a.nb_fragments > 1 ? 's' : ''}</span>
                <span>{a.nb_restitutions} restitution{a.nb_restitutions > 1 ? 's' : ''}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
