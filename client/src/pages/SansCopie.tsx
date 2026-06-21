import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import SourceCard from '../components/cards/SourceCard'
import type { Source } from '../types'

/**
 * Sources sans copie locale, hors video/audio.
 *
 * Vue d'ensemble de ce qu'il reste a archiver : les sources dont on n'a pas
 * encore le texte integral en local (ni archive complete, ni completude
 * « integral hors-ligne »). Les sources video et radio sont exclues : on
 * n'archive pas le texte d'une video ou d'une emission.
 *
 * Doctrine « la source est une carte qu'on promene » : on reutilise SourceCard.
 * Chaque carte mene a la lecture ; l'action propose d'archiver (extraction
 * automatique) ou de completer si une archive partielle existe deja.
 */
export default function SansCopie() {
  const [sources, setSources] = useState<Source[]>([])
  const [chargement, setChargement] = useState(true)
  const [archivageEnCours, setArchivageEnCours] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.get<Source[]>('/sources/sans-copie-locale')
      .then(setSources)
      .catch(() => {})
      .finally(() => setChargement(false))
  }, [])

  const archiver = async (sourceId: number) => {
    setArchivageEnCours(sourceId)
    setMessage('')
    try {
      const res = await api.post<{ ok: boolean; statut: string }>(`/sources/${sourceId}/archiver`, {})
      if (res.statut === 'partielle') {
        // Extraction partielle (paywall probable) : la source reste a completer
        // ailleurs, on la retire de la liste « sans copie » mais on l'indique.
        setMessage(`Source #${sourceId} archivee partiellement (paywall probable) — a completer.`)
      } else {
        setMessage(`Source #${sourceId} archivee.`)
      }
      setSources((prev) => prev.filter((s) => s.id !== sourceId))
    } catch {
      setMessage(`Echec de l'archivage automatique pour la source #${sourceId}. Vous pouvez la completer a la main.`)
    } finally {
      setArchivageEnCours(null)
    }
  }

  return (
    <div className="page-sans-copie">
      <p className="page-intro">
        Les sources dont nous n'avons pas encore le texte integral en local, hors
        video et audio (on n'archive pas le texte d'une video ou d'une emission).
        Un coup d'oeil pour voir ce qu'il reste a archiver.
      </p>

      {message && <div className="alert">{message}</div>}

      {chargement ? (
        <p className="empty">Chargement...</p>
      ) : sources.length === 0 ? (
        <p className="empty">Aucune source en attente : tout le texte archivable est en local.</p>
      ) : (
        <>
          <p className="section-subtitle">
            {sources.length} source{sources.length > 1 ? 's' : ''} a archiver, de la plus recente a la plus ancienne.
          </p>
          <div className="source-grid">
            {sources.map((s) => {
              // Une archive partielle existe deja ailleurs : on oriente vers
              // l'ecran de contribution pour la completer, plutot que de relancer
              // une extraction qui retomberait partielle.
              const aArchivePartielle = !!s.has_archive && s.archive_statut === 'partielle'
              return (
                <SourceCard
                  key={s.id}
                  source={s}
                  action={
                    aArchivePartielle ? (
                      <Link to={`/archiver/contribuer?source=${s.id}`} className="btn btn-sm btn-primary">
                        Completer
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={archivageEnCours === s.id}
                        onClick={() => archiver(s.id)}
                      >
                        {archivageEnCours === s.id ? 'En cours...' : 'Archiver'}
                      </button>
                    )
                  }
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
