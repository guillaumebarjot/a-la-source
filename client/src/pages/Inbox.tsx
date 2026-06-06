import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Source } from '../types'
import '../styles/inbox.css'

/**
 * Inbox a qualifier.
 *
 * Liste les sources entrantes (ex. ingestion Discord) en attente de tri.
 * Chaque source est une carte image + titre + media + origine, avec deux actions :
 * « Qualifier » (envoie en veille) et « Rejeter » (classe en archive).
 */
export default function Inbox() {
  const [sources, setSources] = useState<Source[]>([])
  const [chargement, setChargement] = useState(true)
  const [enCours, setEnCours] = useState<Set<number>>(new Set())

  const charger = useCallback(async () => {
    try {
      const data = await api.get<Source[]>('/sources/inbox')
      setSources(data)
    } finally {
      setChargement(false)
    }
  }, [])

  useEffect(() => { charger() }, [charger])

  const marquerEnCours = (id: number, actif: boolean) => {
    setEnCours((prev) => {
      const next = new Set(prev)
      if (actif) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const qualifier = async (id: number) => {
    marquerEnCours(id, true)
    try {
      await api.post(`/sources/${id}/qualifier`, { statut: 'veille' })
      await charger()
    } finally {
      marquerEnCours(id, false)
    }
  }

  const rejeter = async (id: number) => {
    marquerEnCours(id, true)
    try {
      await api.post(`/sources/${id}/rejeter`, {})
      await charger()
    } finally {
      marquerEnCours(id, false)
    }
  }

  return (
    <div className="inbox-page">
      <div className="inbox-header">
        <h1>Inbox a qualifier</h1>
        <p className="inbox-intro">
          Sources entrantes en attente de tri. Qualifiez-les pour les envoyer dans la veille,
          ou rejetez celles qui ne sont pas pertinentes.
        </p>
      </div>

      {chargement ? (
        <div className="loading">Chargement...</div>
      ) : sources.length === 0 ? (
        <div className="inbox-vide">
          <h2>Rien a qualifier</h2>
          <p>
            L'inbox est vide. Les nouvelles sources detectees apparaitront ici,
            pretes a etre triees.
          </p>
        </div>
      ) : (
        <div className="inbox-grid">
          {sources.map((s) => {
            const occupe = enCours.has(s.id)
            return (
              <div key={s.id} className="inbox-carte">
                {s.image_url && (
                  <Link to={`/lire/${s.id}`} className="inbox-carte-image">
                    <img src={s.image_url} alt="" loading="lazy" />
                  </Link>
                )}
                <div className="inbox-carte-body">
                  <Link to={`/lire/${s.id}`} className="inbox-carte-titre">{s.titre}</Link>
                  <div className="inbox-carte-meta">
                    {s.media_nom && <span className="inbox-carte-badge">{s.media_nom}</span>}
                    <span className="inbox-carte-badge">origine : {s.origine ?? 'web'}</span>
                  </div>
                  <div className="inbox-carte-actions">
                    <button
                      type="button"
                      className="inbox-btn inbox-btn--qualifier"
                      onClick={() => qualifier(s.id)}
                      disabled={occupe}
                    >
                      Qualifier
                    </button>
                    <button
                      type="button"
                      className="inbox-btn"
                      onClick={() => rejeter(s.id)}
                      disabled={occupe}
                    >
                      Rejeter
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
