import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api/client'
import type { Source, Tag, Media } from '../types'
import SourceCard from '../components/cards/SourceCard'
import SubmitSource from '../components/forms/SubmitSource'

/* ---------- Periodes temporelles ---------- */

interface Periode {
  label: string
  filter: (date: Date, now: Date) => boolean
}

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const start = new Date(d)
  start.setDate(diff)
  start.setHours(0, 0, 0, 0)
  return start
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3) * 3
  return new Date(d.getFullYear(), q, 1)
}

function startOfSemester(d: Date): Date {
  const s = d.getMonth() < 6 ? 0 : 6
  return new Date(d.getFullYear(), s, 1)
}

const PERIODES: Periode[] = [
  {
    label: 'Cette semaine',
    filter: (date, now) => date >= startOfWeek(now),
  },
  {
    label: 'Ce mois-ci',
    filter: (date, now) => date >= startOfMonth(now) && date < startOfWeek(now),
  },
  {
    label: 'Ce trimestre',
    filter: (date, now) => date >= startOfQuarter(now) && date < startOfMonth(now),
  },
  {
    label: 'Ce semestre',
    filter: (date, now) => date >= startOfSemester(now) && date < startOfQuarter(now),
  },
  {
    label: 'Plus ancien',
    filter: (date, now) => date < startOfSemester(now),
  },
]

/* ---------- Types de source ---------- */

const TYPES_SOURCE = [
  'presse mainstream', 'PQR', 'pure player', 'video', 'radio',
  'rapport', 'lobby', 'associatif', 'officiel', 'tribune',
]

/* ---------- Composant ---------- */

export default function Flux() {
  const [sources, setSources] = useState<Source[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [medias, setMedias] = useState<Media[]>([])
  const [showSubmit, setShowSubmit] = useState(false)

  // Filtres
  const [search, setSearch] = useState('')
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set())
  const [filterMedia, setFilterMedia] = useState('')

  // Sidebar filtres
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Sections repliees
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const loadSources = useCallback(async () => {
    const data = await api.get<Source[]>('/sources')
    setSources(data)
  }, [])

  useEffect(() => { loadSources() }, [loadSources])
  useEffect(() => {
    api.get<Tag[]>('/tags').then(setTags)
    api.get<Media[]>('/medias').then(setMedias)
  }, [])

  // Tags les plus frequents
  const popularTags = useMemo(() => {
    const counts = new Map<string, number>()
    // On utilise les tags de la liste API
    tags.forEach((t) => counts.set(t.nom, 0))
    return tags.slice(0, 15)
  }, [tags])

  // Types utilises dans les sources
  const usedTypes = useMemo(() => {
    const set = new Set<string>()
    sources.forEach((s) => { if (s.type_source) set.add(s.type_source) })
    return TYPES_SOURCE.filter((t) => set.has(t))
  }, [sources])

  // Filtrage
  const filtered = useMemo(() => {
    return sources.filter((s) => {
      if (search) {
        const q = search.toLowerCase()
        const inTitle = s.titre?.toLowerCase().includes(q)
        const inAccroche = s.accroche?.toLowerCase().includes(q)
        const inMedia = s.media_nom?.toLowerCase().includes(q)
        if (!inTitle && !inAccroche && !inMedia) return false
      }
      if (activeTags.size > 0) {
        // Source doit avoir au moins un des tags actifs
        // On n'a pas les tags sur les sources ici, on filtre cote serveur si besoin
        // Pour l'instant, on passe (les tags sont sur les cards mais pas dans Source)
      }
      if (activeTypes.size > 0 && (!s.type_source || !activeTypes.has(s.type_source))) return false
      if (filterMedia && s.media_nom !== filterMedia) return false
      return true
    })
  }, [sources, search, activeTypes, filterMedia, activeTags])

  // Groupement par periode
  const now = useMemo(() => new Date(), [])
  const grouped = useMemo(() => {
    return PERIODES.map((p) => ({
      label: p.label,
      sources: filtered.filter((s) => {
        const date = new Date(s.date_publication || s.soumis_le)
        return p.filter(date, now)
      }),
    })).filter((g) => g.sources.length > 0)
  }, [filtered, now])

  // Toggle tag/type
  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const toggleType = (type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const toggleCollapse = (label: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const activeFilterCount = activeTags.size + activeTypes.size + (filterMedia ? 1 : 0)

  return (
    <div className="page-flux">
      {/* Barre de recherche + bouton soumettre */}
      <div className="flux-top">
        <button
          className={`flux-filter-toggle ${sidebarOpen ? 'flux-filter-toggle--active' : ''}`}
          onClick={() => setSidebarOpen((v) => !v)}
          type="button"
          title="Filtres"
        >
          &#9776; Filtres{activeFilterCount > 0 && <span className="flux-filter-badge">{activeFilterCount}</span>}
        </button>
        <div className="flux-search">
          <input
            type="text"
            className="flux-search-input"
            placeholder="Rechercher dans les sources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => setShowSubmit(true)}>
          + Soumettre source
        </button>
      </div>

      <div className="flux-layout">
        {/* Sidebar filtres (gauche, repliable) */}
        <aside className={`flux-sidebar ${sidebarOpen ? 'flux-sidebar--open' : ''}`}>
          <div className="flux-sidebar-section">
            <h3 className="flux-sidebar-title">Tags</h3>
            <div className="flux-sidebar-chips">
              {popularTags.map((t) => (
                <button
                  key={t.id}
                  className={`flux-chip ${activeTags.has(t.nom) ? 'flux-chip--active' : ''}`}
                  onClick={() => toggleTag(t.nom)}
                  type="button"
                >
                  {t.nom}
                </button>
              ))}
            </div>
          </div>

          {usedTypes.length > 0 && (
            <div className="flux-sidebar-section">
              <h3 className="flux-sidebar-title">Types</h3>
              <div className="flux-sidebar-chips">
                {usedTypes.map((t) => (
                  <button
                    key={t}
                    className={`flux-chip ${activeTypes.has(t) ? 'flux-chip--active' : ''}`}
                    onClick={() => toggleType(t)}
                    type="button"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {medias.length > 0 && (
            <div className="flux-sidebar-section">
              <h3 className="flux-sidebar-title">Media</h3>
              <select
                className="flux-media-select"
                value={filterMedia}
                onChange={(e) => setFilterMedia(e.target.value)}
              >
                <option value="">Tous les medias</option>
                {medias.map((m) => <option key={m.id} value={m.nom}>{m.nom}</option>)}
              </select>
              {filterMedia && (
                <button className="flux-chip flux-chip--active" onClick={() => setFilterMedia('')} type="button">
                  {filterMedia} ×
                </button>
              )}
            </div>
          )}

          {activeFilterCount > 0 && (
            <button
              className="flux-sidebar-reset"
              type="button"
              onClick={() => { setActiveTags(new Set()); setActiveTypes(new Set()); setFilterMedia('') }}
            >
              Reinitialiser les filtres
            </button>
          )}
        </aside>

        {/* Contenu principal */}
        <div className="flux-main">
          {/* Sections temporelles */}
          {grouped.map((group) => (
            <section key={group.label} className="flux-section">
              <button
                className="flux-section-header"
                onClick={() => toggleCollapse(group.label)}
                type="button"
              >
                <h2 className="section-title">
                  {group.label}
                  <span className="flux-section-count">{group.sources.length}</span>
                </h2>
                <span className={`flux-chevron ${collapsed.has(group.label) ? 'flux-chevron--collapsed' : ''}`}>
                  &#9660;
                </span>
              </button>
              {!collapsed.has(group.label) && (
                <div className="source-grid">
                  {group.sources.map((s) => <SourceCard key={s.id} source={s} />)}
                </div>
              )}
            </section>
          ))}

          {filtered.length === 0 && <p className="empty">Aucune source ne correspond aux filtres.</p>}
        </div>
      </div>

      {showSubmit && <SubmitSource onCreated={loadSources} onClose={() => setShowSubmit(false)} />}
    </div>
  )
}
