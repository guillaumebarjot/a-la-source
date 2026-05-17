import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../store/useAuth'
import type { Lecture } from '../types'

export default function MonEspace() {
  const user = useAuth((s) => s.user)
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [recommandations, setRecommandations] = useState<Lecture[]>([])

  useEffect(() => {
    api.get<Lecture[]>('/auth/lectures').then(setLectures)
    api.get<Lecture[]>('/auth/recommandations').then(setRecommandations)
  }, [])

  if (!user) return <p className="loading">Chargement...</p>

  const aLire = lectures.filter((l) => l.statut === 'a_lire')
  const lus = lectures.filter((l) => l.statut === 'lu')

  return (
    <div className="page-perso">
      <h1>Bonjour, {user.nom}</h1>

      <section>
        <h2>A lire ({aLire.length})</h2>
        {aLire.length === 0 ? <p className="empty">Rien en file d'attente.</p> : (
          <div className="lecture-list">
            {aLire.map((l) => (
              <Link key={l.source_id} to={`/lire/${l.source_id}`} className="lecture-item">
                <span>{l.titre}</span>
                <span className="lecture-media">{l.media_nom}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {recommandations.length > 0 && (
        <section>
          <h2>Recommandations recues ({recommandations.length})</h2>
          <div className="lecture-list">
            {recommandations.map((r) => (
              <Link key={r.source_id} to={`/lire/${r.source_id}`} className="lecture-item">
                <span>{r.titre}</span>
                <span className="lecture-media">{r.media_nom}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>Deja lus ({lus.length})</h2>
        {lus.length === 0 ? <p className="empty">Aucune source lue.</p> : (
          <div className="lecture-list">
            {lus.slice(0, 10).map((l) => (
              <Link key={l.source_id} to={`/lire/${l.source_id}`} className="lecture-item">
                <span>{l.titre}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
