import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

interface SourceProjection {
  id: number
  titre: string
  accroche: string | null
  image_url: string | null
  media_nom: string | null
  type_source: string | null
  date_publication: string | null
}

type Phase = 'selection' | 'pourquoi' | 'lecture'

export default function Projection() {
  const navigate = useNavigate()
  const [sources, setSources] = useState<SourceProjection[]>([])
  const [phase, setPhase] = useState<Phase>('selection')
  const [sourceChoisie, setSourceChoisie] = useState<SourceProjection | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Charger les sources de l'atelier en cours
    api.get<{ sources: SourceProjection[] } | null>('/ateliers/en-cours')
      .then((data) => {
        if (data?.sources) setSources(data.sources)
      })
      .finally(() => setLoading(false))
  }, [])

  // Plein ecran
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  // Quitter la projection
  const quitter = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    navigate('/ateliers')
  }

  // Phase selection : choisir une source
  const choisirSource = (source: SourceProjection) => {
    setSourceChoisie(source)
    setPhase('pourquoi')
  }

  // Phase pourquoi → lecture
  const lancerLecture = () => {
    if (sourceChoisie) {
      navigate(`/lire/${sourceChoisie.id}`)
    }
  }

  // Retour a la selection
  const retourSelection = () => {
    setPhase('selection')
    setSourceChoisie(null)
  }

  if (loading) {
    return (
      <div className="projection">
        <p className="projection-loading">Chargement de l'atelier...</p>
      </div>
    )
  }

  if (sources.length === 0) {
    return (
      <div className="projection">
        <div className="projection-empty">
          <h2>Aucune source dans l'atelier en cours</h2>
          <p>Ajoutez des sources depuis le pipeline Ateliers.</p>
          <button className="projection-btn" onClick={quitter}>Retour</button>
        </div>
      </div>
    )
  }

  return (
    <div className="projection">
      {/* Barre de controle (discrete, en haut) */}
      <div className="projection-controls">
        <button className="projection-ctrl-btn" onClick={quitter} title="Quitter">
          Quitter
        </button>
        <span className="projection-ctrl-titre">A la source — Atelier</span>
        <button className="projection-ctrl-btn" onClick={toggleFullscreen} title="Plein ecran">
          Plein ecran
        </button>
      </div>

      {/* Phase 1 : Selection collective (cartes style reseau social) */}
      {phase === 'selection' && (
        <div className="projection-selection">
          <h2 className="projection-consigne">
            Quel sujet souhaitez-vous explorer aujourd'hui ?
          </h2>
          <div className="projection-grid">
            {sources.map((s) => (
              <button
                key={s.id}
                className="projection-card"
                onClick={() => choisirSource(s)}
                type="button"
              >
                {s.image_url && (
                  <div className="projection-card-img">
                    <img src={s.image_url} alt="" loading="lazy" />
                  </div>
                )}
                <div className="projection-card-body">
                  <h3 className="projection-card-titre">{s.titre}</h3>
                  {s.accroche && (
                    <p className="projection-card-accroche">{s.accroche}</p>
                  )}
                  <span className="projection-card-meta">
                    {s.media_nom}{s.type_source ? ` — ${s.type_source}` : ''}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Phase 2 : Pourquoi celui-la ? */}
      {phase === 'pourquoi' && sourceChoisie && (
        <div className="projection-pourquoi">
          <div className="projection-pourquoi-card">
            {sourceChoisie.image_url && (
              <img src={sourceChoisie.image_url} alt="" className="projection-pourquoi-img" />
            )}
            <h2>{sourceChoisie.titre}</h2>
            {sourceChoisie.accroche && <p className="projection-pourquoi-accroche">{sourceChoisie.accroche}</p>}
            <span className="projection-pourquoi-meta">
              {sourceChoisie.media_nom}{sourceChoisie.date_publication ? ` — ${new Date(sourceChoisie.date_publication).toLocaleDateString('fr-FR')}` : ''}
            </span>
          </div>

          <div className="projection-pourquoi-question">
            <h3>Pourquoi ce sujet vous interesse-t-il ?</h3>
            <p>Avant de lire ensemble, prenez un moment pour echanger :<br />
              Qu'est-ce qui vous attire ? Qu'en savez-vous deja ? Qu'esperez-vous y trouver ?
            </p>
          </div>

          <div className="projection-pourquoi-actions">
            <button className="projection-btn projection-btn-secondary" onClick={retourSelection}>
              Choisir un autre sujet
            </button>
            <button className="projection-btn projection-btn-primary" onClick={lancerLecture}>
              Lancer la lecture collective
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
