import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { Source } from '../types'

export default function Archiver() {
  const [sourcesNonArchivees, setSourcesNonArchivees] = useState<Source[]>([])
  const [url, setUrl] = useState('')
  const [archivageEnCours, setArchivageEnCours] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.get<Source[]>('/sources?sans_archive=1&ordre=consultations')
      .then(setSourcesNonArchivees)
      .catch(() => {})
  }, [])

  const lancerArchivage = async (sourceId: number) => {
    setArchivageEnCours(sourceId)
    setMessage('')
    try {
      await api.post(`/sources/${sourceId}/archiver`, {})
      setMessage(`Source #${sourceId} archivee avec succes`)
      setSourcesNonArchivees((prev) => prev.filter((s) => s.id !== sourceId))
    } catch {
      setMessage(`Echec de l'archivage pour la source #${sourceId}`)
    } finally {
      setArchivageEnCours(null)
    }
  }

  const archiverDepuisUrl = async () => {
    if (!url.trim()) return
    setMessage('')
    try {
      const source = await api.post<Source>('/sources', { url: url.trim(), titre: 'Import depuis Archiver' })
      await api.post(`/sources/${source.id}/archiver`, {})
      setMessage(`Source creee et archivee : ${source.titre}`)
      setUrl('')
    } catch {
      setMessage('Echec — verifiez l\'URL')
    }
  }

  return (
    <div className="page-archiver">
      <h1>Archiver</h1>
      <p className="page-intro">
        L'archivage preserve le contenu des sources contre la disparition des liens.
        Aidez la communaute en archivant les sources les plus consultees.
      </p>

      {message && <div className="alert">{message}</div>}

      <section className="archiver-section">
        <h2>Sources a archiver en priorite</h2>
        <p className="section-subtitle">Les plus consultees et commentees sans archive</p>
        {sourcesNonArchivees.length === 0 ? (
          <p className="empty">Toutes les sources sont archivees !</p>
        ) : (
          <div className="archiver-list">
            {sourcesNonArchivees.map((s) => (
              <div key={s.id} className="archiver-item">
                <div className="archiver-item-info">
                  <strong>{s.titre}</strong>
                  <span className="archiver-item-meta">{s.media_nom}</span>
                </div>
                <button
                  className="btn btn-sm"
                  disabled={archivageEnCours === s.id}
                  onClick={() => lancerArchivage(s.id)}
                >
                  {archivageEnCours === s.id ? 'En cours...' : 'Archiver'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="archiver-section">
        <h2>Archiver une URL</h2>
        <div className="archiver-url-form">
          <input
            type="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="input-url"
          />
          <button className="btn btn-primary" onClick={archiverDepuisUrl}>
            Archiver
          </button>
        </div>
      </section>
    </div>
  )
}
