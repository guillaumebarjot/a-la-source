import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import type { Source, Tag, Media } from '../types'
import SourceCard from '../components/cards/SourceCard'
import SubmitSource from '../components/forms/SubmitSource'

export default function Flux() {
  const [sources, setSources] = useState<Source[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [medias, setMedias] = useState<Media[]>([])
  const [filterTag, setFilterTag] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterMedia, setFilterMedia] = useState('')
  const [showSubmit, setShowSubmit] = useState(false)

  const loadSources = useCallback(async () => {
    const params = new URLSearchParams()
    params.set('statut', 'veille')
    if (filterTag) params.set('tag', filterTag)
    if (filterType) params.set('type_source', filterType)
    if (filterMedia) params.set('media', filterMedia)
    const data = await api.get<Source[]>(`/sources?${params}`)
    setSources(data)
  }, [filterTag, filterType, filterMedia])

  useEffect(() => { loadSources() }, [loadSources])
  useEffect(() => {
    api.get<Tag[]>('/tags').then(setTags)
    api.get<Media[]>('/medias').then(setMedias)
  }, [])

  // Group by time
  const now = Date.now()
  const dayMs = 86400000
  const recent = sources.filter((s) => now - new Date(s.soumis_le).getTime() < 7 * dayMs)
  const older = sources.filter((s) => now - new Date(s.soumis_le).getTime() >= 7 * dayMs)

  const types = ['presse mainstream', 'PQR', 'pure player', 'video', 'radio', 'rapport', 'lobby', 'associatif', 'officiel', 'tribune']

  return (
    <div className="page-veille">
      <div className="veille-toolbar">
        <div className="veille-filters">
          <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
            <option value="">Tous les tags</option>
            {tags.map((t) => <option key={t.id} value={t.nom}>{t.nom}</option>)}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Tous les types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterMedia} onChange={(e) => setFilterMedia(e.target.value)}>
            <option value="">Tous les medias</option>
            {medias.map((m) => <option key={m.id} value={m.nom}>{m.nom}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setShowSubmit(true)}>
          + Soumettre source
        </button>
      </div>

      {recent.length > 0 && (
        <section>
          <h2 className="section-title">Ces derniers jours</h2>
          <div className="source-grid">
            {recent.map((s) => <SourceCard key={s.id} source={s} />)}
          </div>
        </section>
      )}

      {older.length > 0 && (
        <section>
          <h2 className="section-title">Plus anciennes</h2>
          <div className="source-grid">
            {older.map((s) => <SourceCard key={s.id} source={s} />)}
          </div>
        </section>
      )}

      {sources.length === 0 && <p className="empty">Aucune source dans la veille.</p>}

      {showSubmit && <SubmitSource onCreated={loadSources} onClose={() => setShowSubmit(false)} />}
    </div>
  )
}
