import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { SourceDetail } from '../types'
import Reader from '../components/reader/Reader'
import Sidebar from '../components/sidebar/Sidebar'

export default function Lire() {
  const { id } = useParams<{ id: string }>()
  const [source, setSource] = useState<SourceDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSource = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const data = await api.get<SourceDetail>(`/sources/${id}`)
    setSource(data)
    setLoading(false)
  }, [id])

  useEffect(() => { loadSource() }, [loadSource])

  if (loading) return <div className="loading">Chargement...</div>
  if (!source) return <div className="error">Source introuvable.</div>

  return (
    <div className="page-lire">
      <div className="lire-header">
        <Link to="/veille" className="back-link">&larr; Retour</Link>
        <h1 className="lire-title">{source.titre}</h1>
        {source.url && (
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">
            Original &nearr;
          </a>
        )}
      </div>
      <div className="lire-body">
        <div className="lire-reader">
          <Reader
            archive={source.archive}
            url={source.url}
            sourceId={source.id}
            onArchived={loadSource}
          />
        </div>
        <Sidebar source={source} onRefresh={loadSource} />
      </div>
    </div>
  )
}
