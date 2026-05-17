import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../store/useAuth'
import type { Source, ScoreResult, Atelier } from '../types'

interface VivierSource extends Source {
  score: ScoreResult
}

export default function Ateliers() {
  const user = useAuth((s) => s.user)
  const isAnimateur = user?.role === 'animateur' || user?.role === 'admin'
  const [tab, setTab] = useState<'vivier' | 'ateliers'>('vivier')
  const [vivier, setVivier] = useState<VivierSource[]>([])
  const [ateliers, setAteliers] = useState<Atelier[]>([])

  useEffect(() => {
    api.get<VivierSource[]>('/ateliers/vivier').then(setVivier)
    api.get<Atelier[]>('/ateliers').then(setAteliers)
  }, [])

  return (
    <div className="page-ateliers">
      <div className="ateliers-tabs">
        <button className={tab === 'vivier' ? 'tab active' : 'tab'} onClick={() => setTab('vivier')}>
          Vivier ({vivier.length})
        </button>
        <button className={tab === 'ateliers' ? 'tab active' : 'tab'} onClick={() => setTab('ateliers')}>
          Ateliers ({ateliers.length})
        </button>
      </div>

      {tab === 'vivier' && (
        <div className="vivier-list">
          {vivier.length === 0 && <p className="empty">Aucune source au vivier.</p>}
          {vivier.map((s) => (
            <Link key={s.id} to={`/lire/${s.id}`} className="vivier-card">
              <div className="vivier-score">{s.score.scoreTotal}</div>
              <div className="vivier-info">
                <h3>{s.titre}</h3>
                <span>{s.media_nom} — {s.score.nbEvaluations} eval(s)</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {tab === 'ateliers' && (
        <div className="ateliers-list">
          {ateliers.length === 0 && <p className="empty">Aucun atelier.</p>}
          {ateliers.map((a) => (
            <div key={a.id} className="atelier-card">
              <h3>Atelier #{a.numero}</h3>
              <span className={`badge badge-${a.statut}`}>{a.statut}</span>
              {a.date_atelier && <time>{new Date(a.date_atelier).toLocaleDateString('fr-FR')}</time>}
              {a.lieu && <span>{a.lieu}</span>}
            </div>
          ))}
          {isAnimateur && (
            <p className="info">Gestion des ateliers disponible pour les facilitateur·ices.</p>
          )}
        </div>
      )}
    </div>
  )
}
