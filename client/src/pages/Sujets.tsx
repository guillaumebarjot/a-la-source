import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Sujet } from '../types'

/**
 * Accueil — entrée par les Sujets (refonte par sujets, façon GroundNews).
 * Grille de cartes-thèmes. Chaque sujet agrège veille, couverture et activités.
 */
export default function Sujets() {
  const [sujets, setSujets] = useState<Sujet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Sujet[]>('/sujets?statut=publie')
      .then(setSujets)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Chargement des sujets...</div>

  return (
    <div className="sujets-page">
      <header className="sujets-header">
        <h1>Sujets</h1>
        <p className="sujets-intro">
          Les thèmes que nous suivons. Chaque sujet rassemble la veille, la couverture des médias et les activités d'éducation populaire.
        </p>
      </header>

      {sujets.length === 0 ? (
        <p className="empty">Aucun sujet publié pour l'instant.</p>
      ) : (
        <div className="sujets-grid">
          {sujets.map((s) => (
            <Link key={s.id} to={`/sujets/${s.slug}`} className="sujet-card">
              <div
                className="sujet-card-visuel"
                style={s.couleur ? { background: s.couleur } : undefined}
              >
                {s.image_url
                  ? <img src={s.image_url} alt="" loading="lazy" />
                  : <span className="sujet-card-initiale">{s.titre.charAt(0)}</span>}
              </div>
              <div className="sujet-card-body">
                <h2 className="sujet-card-titre">{s.titre}</h2>
                {s.accroche && <p className="sujet-card-accroche">{s.accroche}</p>}
                <div className="sujet-card-meta">
                  <span>{s.nb_sources ?? 0} source{(s.nb_sources ?? 0) > 1 ? 's' : ''}</span>
                  <span>{s.nb_evenements ?? 0} événement{(s.nb_evenements ?? 0) > 1 ? 's' : ''}</span>
                  {s.provenance && <span className="sujet-card-provenance">{s.provenance}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
