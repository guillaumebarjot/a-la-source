import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { DebunkageDetail, DebunkageSource, ReseauPost } from '../types/debunkage'
import '../styles/debunkage.css'

/**
 * Débunkage (détail) — l'établi de l'adhérent.
 *
 * On édite l'affirmation visée et la démonstration, on mobilise des sources avec
 * un rôle (pour / contre) affichées en cartes image + titre, on consigne les
 * liens des posts publiés (Instagram / Facebook / autre) et on marque le
 * débunkage comme publié.
 */
export default function Debunkage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<DebunkageDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Champs éditables
  const [affirmation, setAffirmation] = useState('')
  const [demonstration, setDemonstration] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // Ajout de source
  const [sourceId, setSourceId] = useState('')
  const [sourceRole, setSourceRole] = useState<'pour' | 'contre'>('pour')

  // Ajout de post
  const [postReseau, setPostReseau] = useState<ReseauPost>('instagram')
  const [postUrl, setPostUrl] = useState('')

  const recharger = useCallback(() => {
    if (!id) return
    return api.get<DebunkageDetail>(`/debunkages/${id}`).then((d) => {
      setData(d)
      setAffirmation(d.pipeline?.affirmation_visee_md ?? '')
      setDemonstration(d.pipeline?.demonstration_md ?? '')
    })
  }, [id])

  useEffect(() => {
    recharger()?.finally(() => setLoading(false))
  }, [recharger])

  async function sauverTexte() {
    if (!id) return
    setSaving(true)
    try {
      await api.put(`/debunkages/${id}`, {
        affirmation_visee_md: affirmation,
        demonstration_md: demonstration,
      })
      setSavedAt(new Date().toLocaleTimeString())
    } finally {
      setSaving(false)
    }
  }

  async function ajouterSource(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !sourceId.trim()) return
    await api.post(`/debunkages/${id}/sources`, {
      source_id: Number(sourceId.trim()),
      role: sourceRole,
    })
    setSourceId('')
    await recharger()
  }

  async function retirerSource(sid: number) {
    if (!id) return
    await api.delete(`/debunkages/${id}/sources/${sid}`)
    await recharger()
  }

  async function ajouterPost(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !postUrl.trim()) return
    await api.post(`/debunkages/${id}/posts`, { reseau: postReseau, url: postUrl.trim() })
    setPostUrl('')
    await recharger()
  }

  async function retirerPost(pid: number) {
    if (!id) return
    await api.delete(`/debunkages/${id}/posts/${pid}`)
    await recharger()
  }

  async function publier() {
    if (!id) return
    await api.post(`/debunkages/${id}/publier`, {})
    await recharger()
  }

  if (loading) return <div className="loading">Chargement du debunkage...</div>
  if (!data) return <div className="debunkage-page"><p className="debunkage-empty">Debunkage introuvable.</p></div>

  const estPublie = data.pipeline?.statut === 'publie'
  const sourcesPour = data.sources.filter((s) => s.role === 'pour')
  const sourcesContre = data.sources.filter((s) => s.role === 'contre')
  const sourcesAutres = data.sources.filter((s) => s.role !== 'pour' && s.role !== 'contre')

  return (
    <div className="debunkage-page">
      <header className="debunkage-header">
        <div className="debunkage-row">
          <h1>{data.titre}</h1>
          <span className={`debunkage-badge${estPublie ? ' publie' : ''}`}>
            {estPublie ? 'Publie' : 'Brouillon'}
          </span>
        </div>
        {data.sujet_slug && (
          <p className="debunkage-card-affirmation">
            Theme : <Link to={`/sujets/${data.sujet_slug}`} className="debunkage-source-titre" style={{ display: 'inline' }}>{data.sujet_titre}</Link>
          </p>
        )}
      </header>

      <section className="debunkage-section">
        <h2>Affirmation visee</h2>
        <textarea
          className="debunkage-textarea"
          value={affirmation}
          onChange={(e) => setAffirmation(e.target.value)}
          placeholder="L'affirmation que l'on veut debunker."
        />
      </section>

      <section className="debunkage-section">
        <h2>Demonstration</h2>
        <textarea
          className="debunkage-textarea"
          value={demonstration}
          onChange={(e) => setDemonstration(e.target.value)}
          placeholder="Le raisonnement, les faits, les sources mobilisees."
        />
        <div className="debunkage-actions">
          <button className="btn btn-primary" onClick={sauverTexte} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {savedAt && <span className="debunkage-card-meta">Enregistre a {savedAt}</span>}
        </div>
      </section>

      <section className="debunkage-section">
        <h2>Sources mobilisees</h2>
        <form className="debunkage-row" onSubmit={ajouterSource} style={{ marginBottom: 'var(--space-md)' }}>
          <input
            className="debunkage-input"
            style={{ maxWidth: 140 }}
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            placeholder="id source"
            inputMode="numeric"
          />
          <select
            className="debunkage-select"
            style={{ maxWidth: 160 }}
            value={sourceRole}
            onChange={(e) => setSourceRole(e.target.value as 'pour' | 'contre')}
          >
            <option value="pour">Pour</option>
            <option value="contre">Contre</option>
          </select>
          <button type="submit" className="btn btn-secondary" disabled={!sourceId.trim()}>Rattacher</button>
        </form>

        <div className="debunkage-sources-cols">
          <div className="debunkage-sources-col">
            <h3>Pour</h3>
            <SourceCards sources={sourcesPour} onRemove={retirerSource} />
          </div>
          <div className="debunkage-sources-col">
            <h3>Contre</h3>
            <SourceCards sources={sourcesContre} onRemove={retirerSource} />
          </div>
        </div>
        {sourcesAutres.length > 0 && (
          <div className="debunkage-sources-col" style={{ marginTop: 'var(--space-md)' }}>
            <h3>Sans role attribue</h3>
            <SourceCards sources={sourcesAutres} onRemove={retirerSource} />
          </div>
        )}
      </section>

      <section className="debunkage-section">
        <h2>Posts publies</h2>
        {data.posts.length === 0 ? (
          <p className="debunkage-empty">Aucun lien de post consigne.</p>
        ) : (
          <ul className="debunkage-posts-list">
            {data.posts.map((p) => (
              <li key={p.id} className="debunkage-post-item">
                <span className="debunkage-post-reseau">{p.reseau ?? 'autre'}</span>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="debunkage-post-url">{p.url}</a>
                <button className="btn btn-secondary btn-sm" onClick={() => retirerPost(p.id)}>Retirer</button>
              </li>
            ))}
          </ul>
        )}
        <form className="debunkage-row" onSubmit={ajouterPost}>
          <select
            className="debunkage-select"
            style={{ maxWidth: 160 }}
            value={postReseau}
            onChange={(e) => setPostReseau(e.target.value as ReseauPost)}
          >
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="autre">Autre</option>
          </select>
          <input
            className="debunkage-input"
            style={{ flex: 1, minWidth: 200 }}
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            placeholder="https://..."
            type="url"
          />
          <button type="submit" className="btn btn-secondary" disabled={!postUrl.trim()}>Ajouter le lien</button>
        </form>
      </section>

      <section className="debunkage-section">
        <div className="debunkage-actions">
          <button className="btn btn-primary" onClick={publier} disabled={estPublie}>
            {estPublie ? 'Deja publie' : 'Marquer comme publie'}
          </button>
        </div>
      </section>
    </div>
  )
}

/** Liste de cartes source (image + titre), rôle dark-safe. */
function SourceCards({ sources, onRemove }: { sources: DebunkageSource[]; onRemove: (id: number) => void }) {
  if (sources.length === 0) return <p className="debunkage-empty">Aucune source.</p>
  return (
    <>
      {sources.map((s) => (
        <div key={s.id} className="debunkage-source-card">
          <div className="debunkage-source-visuel">
            {s.image_url
              ? <img src={s.image_url} alt="" loading="lazy" />
              : <span className="debunkage-source-initiale">{s.titre.charAt(0)}</span>}
          </div>
          <div className="debunkage-source-body">
            {s.url
              ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="debunkage-source-titre">{s.titre}</a>
              : <span className="debunkage-source-titre">{s.titre}</span>}
            {s.media_nom && <span className="debunkage-source-media">{s.media_nom}</span>}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onRemove(s.id)}>Retirer</button>
        </div>
      ))}
    </>
  )
}
