import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { api } from '../../api/client'
import '../../styles/global-search.css'

interface Resultat {
  id: number
  titre: string
  accroche: string | null
  media_nom: string | null
  extrait: string | null
}

// Rend l'extrait FTS en surlignant <mark> SANS exposer le HTML de l'article :
// on echappe tout, puis on restaure uniquement les balises <mark> de snippet().
function extraitSafe(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/&lt;mark&gt;/g, '<mark>').replace(/&lt;\/mark&gt;/g, '</mark>')
}

/**
 * Recherche globale, branchee sur le FTS5 serveur (/api/recherche). Disponible
 * partout depuis le Header. Le serveur fait le gros du travail (index ranke,
 * extraits surlignes, LIMIT 20) : cote client un simple input debounce suffit,
 * pas de dependance nouvelle.
 */
export default function GlobalSearch() {
  const [q, setQ] = useState('')
  const [resultats, setResultats] = useState<Resultat[]>([])
  const [ouvert, setOuvert] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const terme = q.trim()
    if (terme.length < 2) { setResultats([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await api.get<Resultat[]>(`/recherche?q=${encodeURIComponent(terme)}`)
        setResultats(r); setOuvert(true)
      } catch { setResultats([]) }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const aller = (id: number) => {
    setQ(''); setResultats([]); setOuvert(false)
    navigate(`/lire/${id}`)
  }

  return (
    <div className="global-search" ref={boxRef}>
      <Search size={15} className="global-search-icon" aria-hidden="true" />
      <input
        type="search"
        className="global-search-input"
        placeholder="Rechercher une source..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => resultats.length > 0 && setOuvert(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOuvert(false)
          if (e.key === 'Enter' && resultats[0]) aller(resultats[0].id)
        }}
        aria-label="Rechercher une source"
      />
      {ouvert && q.trim().length >= 2 && (
        <div className="global-search-results" role="listbox">
          {resultats.length === 0 ? (
            <div className="global-search-empty">Aucun resultat</div>
          ) : (
            resultats.map((r) => (
              <button key={r.id} type="button" role="option" className="global-search-item" onClick={() => aller(r.id)}>
                <span className="global-search-item-titre">{r.titre}</span>
                {r.media_nom && <span className="global-search-item-media">{r.media_nom}</span>}
                {r.extrait && (
                  <span
                    className="global-search-item-extrait"
                    dangerouslySetInnerHTML={{ __html: extraitSafe(r.extrait) }}
                  />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
