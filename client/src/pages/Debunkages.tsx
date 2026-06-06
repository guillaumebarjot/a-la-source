import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { DebunkageListItem } from '../types/debunkage'
import '../styles/debunkage.css'

/**
 * Débunkages — activité d'éducation populaire aux médias.
 *
 * Un adhérent vise une affirmation, bâtit une démonstration sourcée (pour /
 * contre) et publie le résultat en post réseau social dont on garde le lien.
 * Cette page liste les débunkages et permet d'en créer un nouveau.
 */
export default function Debunkages() {
  const [items, setItems] = useState<DebunkageListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [titre, setTitre] = useState('')
  const [affirmation, setAffirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get<DebunkageListItem[]>('/debunkages')
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  async function creer(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) return
    setErreur(null)
    try {
      const { id } = await api.post<{ id: number }>('/debunkages', {
        titre: titre.trim(),
        affirmation_visee_md: affirmation.trim() || undefined,
      })
      navigate(`/debunkages/${id}`)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur a la creation')
    }
  }

  if (loading) return <div className="loading">Chargement des debunkages...</div>

  return (
    <div className="debunkage-page">
      <header className="debunkage-header">
        <h1>Debunkages</h1>
        <p className="debunkage-intro">
          On vise une affirmation, on construit une demonstration appuyee sur des sources
          (pour et contre), et on publie le resultat en post sur les reseaux sociaux. La source
          est une carte : une image et un titre. Pour aller plus loin, on s'appuie sur la critique
          des medias d'Acrimed.
        </p>
      </header>

      <section className="debunkage-section">
        {creating ? (
          <form className="debunkage-create-form" onSubmit={creer}>
            <div>
              <label className="debunkage-field-label" htmlFor="deb-titre">Titre du debunkage</label>
              <input
                id="deb-titre"
                className="debunkage-input"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex : Non, l'eau du robinet n'est pas..."
                autoFocus
              />
            </div>
            <div>
              <label className="debunkage-field-label" htmlFor="deb-aff">Affirmation visee (optionnel)</label>
              <textarea
                id="deb-aff"
                className="debunkage-textarea"
                value={affirmation}
                onChange={(e) => setAffirmation(e.target.value)}
                placeholder="L'affirmation que l'on veut debunker."
              />
            </div>
            {erreur && <p className="debunkage-empty">{erreur}</p>}
            <div className="debunkage-actions">
              <button type="submit" className="btn btn-primary" disabled={!titre.trim()}>Creer</button>
              <button type="button" className="btn btn-secondary" onClick={() => setCreating(false)}>Annuler</button>
            </div>
          </form>
        ) : (
          <div className="debunkage-actions">
            <button className="btn btn-primary" onClick={() => setCreating(true)}>Nouveau debunkage</button>
          </div>
        )}
      </section>

      {items.length === 0 ? (
        <p className="debunkage-empty">Aucun debunkage pour l'instant.</p>
      ) : (
        <div className="debunkage-grid">
          {items.map((d) => (
            <Link key={d.id} to={`/debunkages/${d.id}`} className="debunkage-card">
              <h2 className="debunkage-card-titre">{d.titre}</h2>
              {d.sujet_titre && (
                <p className="debunkage-card-affirmation">Theme : {d.sujet_titre}</p>
              )}
              <div className="debunkage-card-meta">
                <span className={`debunkage-badge${d.statut === 'publie' ? ' publie' : ''}`}>
                  {d.statut === 'publie' ? 'Publie' : 'Brouillon'}
                </span>
                <span>{d.nb_sources} source{d.nb_sources > 1 ? 's' : ''}</span>
                <span>{d.nb_posts} post{d.nb_posts > 1 ? 's' : ''}</span>
                {!!d.relaye_site && <span>relaye sur le site</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
