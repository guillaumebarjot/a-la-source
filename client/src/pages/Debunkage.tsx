import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { DebunkageDetail, ReseauPost } from '../types/debunkage'
import type { Source } from '../types'
import CorpusDnD from '../components/corpus/CorpusDnD'
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

  // Vivier de candidates (veille) pour le glisser-déposer
  const [veille, setVeille] = useState<Source[]>([])

  // Ajout de post
  const [postReseau, setPostReseau] = useState<ReseauPost>('instagram')
  const [postUrl, setPostUrl] = useState('')

  // Partage hors appli
  const [copieLien, setCopieLien] = useState(false)
  const [copieYeswiki, setCopieYeswiki] = useState<'idle' | 'ok' | 'erreur'>('idle')

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
    api.get<Source[]>('/sources?limit=40').then(setVeille).catch(() => setVeille([]))
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

  async function ajouterSource(sid: number, role?: string) {
    if (!id) return
    await api.post(`/debunkages/${id}/sources`, { source_id: sid, role: role || undefined })
    await recharger()
  }

  async function retirerSource(sid: number) {
    if (!id) return
    await api.delete(`/debunkages/${id}/sources/${sid}`)
    await recharger()
  }

  async function reordonner(ids: number[]) {
    if (!id) return
    await api.patch(`/debunkages/${id}/sources/order`, { source_ids: ids })
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

  // Lien public absolu vers la page autoportante (hors /api).
  const lienPublic = id ? `${window.location.origin}/partage/debunkage/${id}` : ''

  async function copierLien() {
    if (!lienPublic) return
    try {
      await navigator.clipboard.writeText(lienPublic)
      setCopieLien(true)
      setTimeout(() => setCopieLien(false), 2000)
    } catch {
      setCopieLien(false)
    }
  }

  async function exporterYeswiki() {
    if (!id) return
    setCopieYeswiki('idle')
    try {
      const res = await fetch(`/api/debunkages/${id}/yeswiki`)
      if (!res.ok) throw new Error('export indisponible')
      const texte = await res.text()
      await navigator.clipboard.writeText(texte)
      setCopieYeswiki('ok')
      setTimeout(() => setCopieYeswiki('idle'), 2500)
    } catch {
      setCopieYeswiki('erreur')
      setTimeout(() => setCopieYeswiki('idle'), 2500)
    }
  }

  if (loading) return <div className="loading">Chargement du debunkage...</div>
  if (!data) return <div className="debunkage-page"><p className="debunkage-empty">Debunkage introuvable.</p></div>

  const estPublie = data.pipeline?.statut === 'publie'
  const roleById = new Map(data.sources.map((s) => [s.id, s.role]))
  const candidates = veille.filter((s) => !data.sources.some((d) => d.id === s.id))

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
        <p className="debunkage-card-meta">Promène une carte de la veille vers le corpus, choisis son rôle pour / contre, réordonne par la poignée.</p>
        <CorpusDnD
          vivier={candidates}
          corpus={data.sources}
          onAdd={(sid) => ajouterSource(sid)}
          onRemove={retirerSource}
          onReorder={reordonner}
          lienSource={(sid) => `/lire/${sid}`}
          titreVivier="Veille"
          titreCorpus="Sources du débunkage"
          videVivier="Aucune source disponible."
          videCorpus="Aucune source rattachée."
          renderExtra={(c) => (
            <select
              className="debunkage-select"
              style={{ maxWidth: 160, marginTop: 4 }}
              value={roleById.get(c.id) || ''}
              onChange={(e) => ajouterSource(c.id, e.target.value)}
            >
              <option value="">Sans rôle</option>
              <option value="pour">Pour</option>
              <option value="contre">Contre</option>
            </select>
          )}
        />
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
        <h2>Partager hors appli</h2>
        {!estPublie && (
          <p className="debunkage-empty">
            Le partage public est concu pour un debunkage publie. Marquez-le comme publie ci-dessous pour diffuser une page lisible par tous.
          </p>
        )}
        <div className="debunkage-partage">
          <div className="debunkage-partage-bloc">
            <span className="debunkage-field-label">Page publique (Discord, partage direct)</span>
            <div className="debunkage-row">
              <input
                className="debunkage-input"
                style={{ flex: 1, minWidth: 200 }}
                value={lienPublic}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
              />
              <button type="button" className="btn btn-secondary" onClick={copierLien}>
                {copieLien ? 'Lien copie' : 'Copier le lien'}
              </button>
              <a
                className="btn btn-secondary"
                href={lienPublic}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ouvrir
              </a>
            </div>
            <p className="debunkage-card-meta">
              Cette page affiche une carte (titre, apercu, image) quand on colle le lien dans Discord.
            </p>
          </div>

          <div className="debunkage-partage-bloc">
            <span className="debunkage-field-label">Export YesWiki (becs-rouges.fr, rouge-coquelicot.fr)</span>
            <div className="debunkage-row">
              <button type="button" className="btn btn-secondary" onClick={exporterYeswiki}>
                {copieYeswiki === 'ok'
                  ? 'Texte YesWiki copie'
                  : copieYeswiki === 'erreur'
                    ? 'Echec, reessayez'
                    : 'Exporter en YesWiki'}
              </button>
            </div>
            <p className="debunkage-card-meta">
              Le texte est copie dans le presse-papiers en syntaxe YesWiki, pret a coller dans une page du wiki.
            </p>
          </div>
        </div>
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
