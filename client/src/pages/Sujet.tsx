import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { SujetDetail } from '../types'

/**
 * Page Sujet — détail d'un thème. Recompose, sous l'angle du sujet, des briques
 * du socle : les sources (veille), les événements (couverture). Les activités
 * du sujet viendront avec le Chantier A.
 */
export default function Sujet() {
  const { slug } = useParams<{ slug: string }>()
  const [sujet, setSujet] = useState<SujetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(false)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    api.get<SujetDetail>(`/sujets/${slug}`)
      .then(setSujet)
      .catch(() => setErreur(true))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <div className="loading">Chargement du sujet...</div>
  if (erreur || !sujet) return (
    <div className="sujet-page">
      <p className="empty">Sujet introuvable. <Link to="/sujets">Retour aux sujets</Link></p>
    </div>
  )

  return (
    <div className="sujet-page">
      <Link to="/sujets" className="sujet-retour">← Sujets</Link>

      <header className="sujet-detail-header">
        <h1>{sujet.titre}</h1>
        {sujet.accroche && <p className="sujet-detail-accroche">{sujet.accroche}</p>}
        {sujet.provenance && (
          <p className="sujet-detail-provenance">Provenance : {sujet.provenance}</p>
        )}
      </header>

      {sujet.description_md && (
        <section className="sujet-detail-section">
          <p>{sujet.description_md}</p>
        </section>
      )}

      <section className="sujet-detail-section">
        <h2>Couverture ({sujet.evenements.length})</h2>
        {sujet.evenements.length === 0 ? (
          <p className="empty">Aucun événement rattaché à ce sujet.</p>
        ) : (
          <ul className="sujet-evenements">
            {sujet.evenements.map((e) => (
              <li key={e.id}>
                <Link to={`/observatoire/couverture`}>{e.titre}</Link>
                {e.date_evenement && <span className="sujet-evenement-date"> ({e.date_evenement})</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sujet-detail-section">
        <h2>Sources ({sujet.sources.length})</h2>
        {sujet.sources.length === 0 ? (
          <p className="empty">Aucune source rattachée à ce sujet pour l'instant.</p>
        ) : (
          <div className="sujet-sources-grid">
            {sujet.sources.map((s) => (
              <Link key={s.id} to={`/lire/${s.id}`} className="sujet-source-card">
                <div className="sujet-source-visuel">
                  {s.image_url
                    ? <img src={s.image_url} alt="" loading="lazy" />
                    : <span className="sujet-source-initiale">{(s.media_nom || s.titre).charAt(0)}</span>}
                </div>
                <div className="sujet-source-body">
                  <h3 className="sujet-source-titre">{s.titre}</h3>
                  {s.media_nom && <span className="sujet-source-media">{s.media_nom}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
