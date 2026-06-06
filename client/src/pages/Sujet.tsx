import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { SujetDetail, Source } from '../types'

/**
 * Page Sujet — détail d'un thème. Recompose, sous l'angle du sujet, des briques
 * du socle : la couverture (événements multisourcés, geste GroundNews) et les
 * sources (veille). On peut rattacher des cartes-sources de la veille au sujet.
 *
 * NB : le rattachement se fait ici par bouton ; le glisser-déposer (dnd-kit,
 * « promener la carte ») est le raffinement UX prévu ensuite.
 */
export default function Sujet() {
  const { slug } = useParams<{ slug: string }>()
  const [sujet, setSujet] = useState<SujetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(false)

  // Panneau d'ajout de sources (rattachement veille -> sujet)
  const [ajout, setAjout] = useState(false)
  const [veille, setVeille] = useState<Source[]>([])

  const loadSujet = useCallback(() => {
    if (!slug) return
    return api.get<SujetDetail>(`/sujets/${slug}`)
      .then(setSujet)
      .catch(() => setErreur(true))
  }, [slug])

  useEffect(() => {
    setLoading(true)
    Promise.resolve(loadSujet()).finally(() => setLoading(false))
  }, [loadSujet])

  function ouvrirAjout() {
    setAjout(true)
    api.get<Source[]>('/sources?limit=40').then(setVeille).catch(() => setVeille([]))
  }

  async function rattacher(sourceId: number) {
    if (!sujet) return
    await api.post(`/sujets/${sujet.id}/sources`, { source_id: sourceId })
    await loadSujet()
  }

  async function detacher(sourceId: number) {
    if (!sujet) return
    await api.delete(`/sujets/${sujet.id}/sources/${sourceId}`)
    await loadSujet()
  }

  if (loading) return <div className="loading">Chargement du sujet...</div>
  if (erreur || !sujet) return (
    <div className="sujet-page">
      <p className="empty">Sujet introuvable. <Link to="/sujets">Retour aux sujets</Link></p>
    </div>
  )

  const dejaRattachees = new Set(sujet.sources.map((s) => s.id))
  const candidates = veille.filter((s) => !dejaRattachees.has(s.id))

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
              <li key={e.id} className="sujet-evenement">
                <Link to="/observatoire/couverture">{e.titre}</Link>
                {e.date_evenement && <span className="sujet-evenement-date"> ({e.date_evenement})</span>}
                <span className="sujet-evenement-couv">
                  {e.nb_medias ?? 0} média{(e.nb_medias ?? 0) > 1 ? 's' : ''}
                  {(e.nb_types_propriete ?? 0) > 0 && ` · ${e.nb_types_propriete} type${(e.nb_types_propriete ?? 0) > 1 ? 's' : ''} de propriété`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sujet-detail-section">
        <div className="sujet-section-head">
          <h2>Sources ({sujet.sources.length})</h2>
          <button className="btn btn-sm btn-secondary" onClick={ajout ? () => setAjout(false) : ouvrirAjout} type="button">
            {ajout ? 'Fermer' : 'Ajouter des sources'}
          </button>
        </div>

        {sujet.sources.length === 0 ? (
          <p className="empty">Aucune source rattachée à ce sujet pour l'instant.</p>
        ) : (
          <div className="sujet-sources-grid">
            {sujet.sources.map((s) => (
              <div key={s.id} className="sujet-source-card sujet-source-card--attachee">
                <Link to={`/lire/${s.id}`} className="sujet-source-visuel">
                  {s.image_url
                    ? <img src={s.image_url} alt="" loading="lazy" />
                    : <span className="sujet-source-initiale">{(s.media_nom || s.titre).charAt(0)}</span>}
                </Link>
                <div className="sujet-source-body">
                  <h3 className="sujet-source-titre">{s.titre}</h3>
                  {s.media_nom && <span className="sujet-source-media">{s.media_nom}</span>}
                  <button className="sujet-source-detacher" onClick={() => detacher(s.id)} type="button">Détacher</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {ajout && (
          <div className="sujet-ajout">
            <p className="sujet-ajout-hint">Cartes de la veille à rattacher à ce sujet :</p>
            {candidates.length === 0 ? (
              <p className="empty">Aucune source disponible à rattacher.</p>
            ) : (
              <div className="sujet-sources-grid">
                {candidates.map((s) => (
                  <div key={s.id} className="sujet-source-card">
                    <div className="sujet-source-visuel">
                      {s.image_url
                        ? <img src={s.image_url} alt="" loading="lazy" />
                        : <span className="sujet-source-initiale">{(s.media_nom || s.titre).charAt(0)}</span>}
                    </div>
                    <div className="sujet-source-body">
                      <h3 className="sujet-source-titre">{s.titre}</h3>
                      {s.media_nom && <span className="sujet-source-media">{s.media_nom}</span>}
                      <button className="btn btn-sm btn-primary" onClick={() => rattacher(s.id)} type="button">+ Rattacher</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
