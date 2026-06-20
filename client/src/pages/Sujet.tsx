import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { SujetDetail, Source } from '../types'
import CorpusDnD from '../components/corpus/CorpusDnD'
import '../styles/sujet-dnd.css'

/**
 * Page Sujet — détail d'un thème. Recompose, sous l'angle du sujet, des briques
 * du socle : la couverture (événements multisourcés, geste GroundNews) et les
 * sources (veille). Le rattachement de sources se fait par glisser-déposer via
 * le composant réutilisable CorpusDnD (zone unique, sans rôle ni ordre ici).
 */
export default function Sujet() {
  const { slug } = useParams<{ slug: string }>()
  const [sujet, setSujet] = useState<SujetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(false)
  const [veille, setVeille] = useState<Source[]>([])

  // Partage hors appli
  const [copieLien, setCopieLien] = useState(false)
  const [copieYeswiki, setCopieYeswiki] = useState<'idle' | 'ok' | 'erreur'>('idle')

  const loadSujet = useCallback(() => {
    if (!slug) return
    return api.get<SujetDetail>(`/sujets/${slug}`)
      .then(setSujet)
      .catch(() => setErreur(true))
  }, [slug])

  useEffect(() => {
    setLoading(true)
    Promise.resolve(loadSujet()).finally(() => setLoading(false))
  }, [loadSujet])

  // Vivier de candidates (veille), chargé une fois pour le glisser-déposer.
  useEffect(() => {
    api.get<Source[]>('/sources?limit=40').then(setVeille).catch(() => setVeille([]))
  }, [])

  async function rattacher(sourceId: number) {
    if (!sujet) return
    await api.post(`/sujets/${sujet.id}/sources`, { source_id: sourceId })
    await loadSujet()
  }

  async function detacher(sourceId: number) {
    if (!sujet) return
    await api.delete(`/sujets/${sujet.id}/sources/${sourceId}`)
    await loadSujet()
  }

  const lienPublic = sujet ? `${window.location.origin}/partage/sujet/${sujet.slug}` : ''

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
    if (!sujet) return
    setCopieYeswiki('idle')
    try {
      const res = await fetch(`/api/sujets/${sujet.slug}/yeswiki`)
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

  if (loading) return <div className="loading">Chargement du sujet...</div>
  if (erreur || !sujet) return (
    <div className="sujet-page">
      <p className="empty">Sujet introuvable. <Link to="/sujets">Retour aux sujets</Link></p>
    </div>
  )

  const dejaRattachees = new Set(sujet.sources.map((s) => s.id))
  const candidates = veille.filter((s) => !dejaRattachees.has(s.id))

  return (
    <div className="sujet-page">
      <Link to="/sujets" className="sujet-retour">← Sujets</Link>

      <header className="sujet-detail-header">
        <h1>{sujet.titre}</h1>
        {sujet.accroche && <p className="sujet-detail-accroche">{sujet.accroche}</p>}
        {sujet.provenance && (
          <p className="sujet-detail-provenance">Provenance : {sujet.provenance}</p>
        )}
      </header>

      {sujet.description_md && (
        <section className="sujet-detail-section">
          <p>{sujet.description_md}</p>
        </section>
      )}

      <section className="sujet-detail-section">
        <h2>Couverture ({sujet.evenements.length})</h2>
        {sujet.evenements.length === 0 ? (
          <p className="empty">Aucun événement rattaché à ce sujet.</p>
        ) : (
          <ul className="sujet-evenements">
            {sujet.evenements.map((e) => (
              <li key={e.id} className="sujet-evenement">
                <Link to="/observatoire/couverture">{e.titre}</Link>
                {e.date_evenement && <span className="sujet-evenement-date"> ({e.date_evenement})</span>}
                <span className="sujet-evenement-couv">
                  {e.nb_medias ?? 0} média{(e.nb_medias ?? 0) > 1 ? 's' : ''}
                  {(e.nb_types_propriete ?? 0) > 0 && ` · ${e.nb_types_propriete} type${(e.nb_types_propriete ?? 0) > 1 ? 's' : ''} de propriété`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sujet-detail-section">
        <h2>Sources ({sujet.sources.length})</h2>
        <p className="sujet-ajout-hint">Promène une carte de la veille vers les sources du sujet (ou « + Ajouter »).</p>
        <CorpusDnD
          vivier={candidates}
          corpus={sujet.sources}
          onAdd={rattacher}
          onRemove={detacher}
          lienSource={(id) => `/lire/${id}`}
          titreVivier="Veille"
          titreCorpus="Sources du sujet"
          videVivier="Aucune source disponible à rattacher."
          videCorpus="Aucune source rattachée pour l'instant."
        />
      </section>

      <section className="sujet-detail-section">
        <h2>Partager hors appli</h2>
        {sujet.statut !== 'publie' && (
          <p className="empty">
            Le partage public est concu pour un theme publie. Une fois publie, ce theme sera diffusable via une page lisible par tous.
          </p>
        )}
        <div className="sujet-partage">
          <div className="sujet-partage-bloc">
            <span className="sujet-field-label">Page publique (Discord, partage direct)</span>
            <div className="sujet-partage-row">
              <input
                className="sujet-partage-input"
                value={lienPublic}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
              />
              <button type="button" className="btn btn-sm btn-secondary" onClick={copierLien}>
                {copieLien ? 'Lien copie' : 'Copier le lien'}
              </button>
              <a
                className="btn btn-sm btn-secondary sujet-partage-ouvrir"
                href={lienPublic}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ouvrir
              </a>
            </div>
            <p className="sujet-partage-meta">
              Cette page affiche une carte (titre, apercu, image) quand on colle le lien dans Discord.
            </p>
          </div>

          <div className="sujet-partage-bloc">
            <span className="sujet-field-label">Export YesWiki (becs-rouges.fr, rouge-coquelicot.fr)</span>
            <div className="sujet-partage-row">
              <button type="button" className="btn btn-sm btn-secondary" onClick={exporterYeswiki}>
                {copieYeswiki === 'ok'
                  ? 'Texte YesWiki copie'
                  : copieYeswiki === 'erreur'
                    ? 'Echec, reessayez'
                    : 'Exporter en YesWiki'}
              </button>
            </div>
            <p className="sujet-partage-meta">
              Le texte est copie dans le presse-papiers en syntaxe YesWiki, pret a coller dans une page du wiki.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
