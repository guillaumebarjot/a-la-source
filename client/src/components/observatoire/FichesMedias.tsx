import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

/* ---------- Types ---------- */

interface MediaFiche {
  id: number
  nom: string
  type: string | null
  url_site: string | null
  description: string | null
  proprietaire: string | null
  actionnaire_ultime: string | null
  type_propriete: string | null
  financement: string | null
  annee_creation: number | null
  ligne_revendiquee: string | null
  nb_sources: number
}

// Libellés lisibles des types de propriété (Chantier A)
const TYPE_PROPRIETE_LABELS: Record<string, string> = {
  conglomerat: 'Conglomérat',
  capital_prive: 'Capital privé / milliardaire',
  groupe_industriel: 'Groupe industriel',
  public: 'Public / service public',
  cooperative: 'Coopérative / société de personnels',
  associatif: 'Associatif / dons',
  independant: 'Indépendant',
  autre: 'Autre',
}

interface MediaStats {
  nb_sources: number
  nb_mecanismes: number
  nb_commentaires: number
  nb_evaluations: number
  mecanismes_reperes: { nom: string; nb: number }[]
  sources_recentes: { id: number; titre: string; date_publication: string | null }[]
}

/* ---------- Helpers ---------- */

type TypeGroupe = 'presse' | 'PQR' | 'web' | 'tv' | 'radio' | 'institutionnel' | 'associatif'

const GROUPES: { key: TypeGroupe; label: string; types: string[] }[] = [
  { key: 'presse', label: 'Presse nationale', types: ['presse', 'presse nationale'] },
  { key: 'PQR', label: 'PQR (Presse Quotidienne Regionale)', types: ['PQR', 'pqr'] },
  { key: 'web', label: 'Pure players / Web', types: ['web', 'pure player'] },
  { key: 'radio', label: 'Radio & TV', types: ['radio', 'tv', 'television'] },
  { key: 'institutionnel', label: 'Institutionnel', types: ['institutionnel'] },
  { key: 'associatif', label: 'Associatif', types: ['associatif'] },
]

function getGroupe(type: string | null): TypeGroupe {
  if (!type) return 'web'
  const t = type.toLowerCase()
  for (const g of GROUPES) {
    if (g.types.some(gt => t.includes(gt))) return g.key
  }
  return 'web'
}

/* ---------- Composant principal ---------- */

export default function FichesMedias() {
  const [medias, setMedias] = useState<MediaFiche[]>([])
  const [filtreReferencies, setFiltreReferencies] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [stats, setStats] = useState<MediaStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    api.get<MediaFiche[]>('/medias').then(setMedias)
  }, [])

  const selectMedia = useCallback((id: number) => {
    setSelectedId(id)
    setLoadingStats(true)
    api.get<MediaStats>(`/medias/${id}/stats`).then(s => {
      setStats(s)
      setLoadingStats(false)
    }).catch(() => setLoadingStats(false))
  }, [])

  const backToList = useCallback(() => {
    setSelectedId(null)
    setStats(null)
  }, [])

  // Vue detail
  if (selectedId !== null) {
    const media = medias.find(m => m.id === selectedId)
    if (!media) return null

    return (
      <div className="media-detail">
        <button className="media-detail-back" onClick={backToList}>
          ← Retour a la liste
        </button>
        <div className="media-detail-header">
          <div className="media-card-initial">{media.nom.charAt(0).toUpperCase()}</div>
          <div>
            <h2 style={{ margin: 0 }}>{media.nom}</h2>
            <span className="media-card-meta">
              {media.type || 'Non classe'}
              {media.url_site && (
                <>
                  {' — '}
                  <a href={media.url_site} target="_blank" rel="noopener noreferrer">
                    {media.url_site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                </>
              )}
            </span>
          </div>
        </div>

        {media.description && (
          <p className="media-detail-description">{media.description}</p>
        )}

        {(media.proprietaire || media.actionnaire_ultime || media.type_propriete || media.financement || media.annee_creation || media.ligne_revendiquee) && (
          <section className="media-propriete">
            <h3>Propriété et financement</h3>
            <table className="media-detail-table">
              <tbody>
                {media.proprietaire && (
                  <tr><th>Propriétaire</th><td>{media.proprietaire}</td></tr>
                )}
                {media.actionnaire_ultime && (
                  <tr><th>Au bout de la chaîne</th><td>{media.actionnaire_ultime}</td></tr>
                )}
                {media.type_propriete && (
                  <tr><th>Type de propriété</th><td>{TYPE_PROPRIETE_LABELS[media.type_propriete] ?? media.type_propriete}</td></tr>
                )}
                {media.financement && (
                  <tr><th>Financement</th><td>{media.financement}</td></tr>
                )}
                {media.annee_creation && (
                  <tr><th>Création</th><td>{media.annee_creation}</td></tr>
                )}
                {media.ligne_revendiquee && (
                  <tr><th>Ligne revendiquée</th><td>{media.ligne_revendiquee}</td></tr>
                )}
              </tbody>
            </table>
            <p className="media-propriete-note">
              Données de propriété à valider avec la carte Acrimed « Médias français, qui possède quoi ? ». On décrit la propriété, on ne note pas le média.
            </p>
          </section>
        )}

        {loadingStats ? (
          <p className="loading">Chargement des statistiques...</p>
        ) : stats ? (
          <>
            <table className="media-detail-table">
              <tbody>
                <tr><th>Sources dans la base</th><td>{stats.nb_sources}</td></tr>
                <tr><th>Mécanismes identifiés</th><td>{stats.nb_mecanismes}</td></tr>
                <tr><th>Commentaires</th><td>{stats.nb_commentaires}</td></tr>
                <tr><th>Évaluations en atelier</th><td>{stats.nb_evaluations}</td></tr>
              </tbody>
            </table>

            {stats.mecanismes_reperes.length > 0 && (
              <section className="media-detail-mecas">
                <h3>Mécanismes les plus repérés sur ce média</h3>
                <p className="media-propriete-note">
                  Mécanismes identifiés par les membres sur les sources de ce média dans notre veille. Ce sont des faits d'analyse, pas un classement du média.
                </p>
                <ul className="media-detail-mecas-liste">
                  {stats.mecanismes_reperes.map(m => (
                    <li key={m.nom} className="media-detail-meca-item">
                      <span className="media-detail-meca-nom">{m.nom}</span>
                      <span className="media-detail-meca-nb">{m.nb} fois</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {stats.sources_recentes.length > 0 && (
              <section>
                <h3>Sources récentes</h3>
                <ul>
                  {stats.sources_recentes.map(s => (
                    <li key={s.id}>
                      {s.titre}
                      {s.date_publication && <span className="media-card-meta"> ({s.date_publication})</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : null}
      </div>
    )
  }

  // Vue liste
  const mediasAffiches = filtreReferencies
    ? medias.filter(m => m.nb_sources > 0)
    : medias

  const groupes = GROUPES.map(g => {
    const items = mediasAffiches.filter(m => getGroupe(m.type) === g.key)
    return { ...g, items }
  }).filter(g => g.items.length > 0)

  return (
    <div className="fiches-medias">
      <div className="medias-toggle">
        <button
          className={`medias-toggle-btn ${filtreReferencies ? 'medias-toggle-btn--active' : ''}`}
          onClick={() => setFiltreReferencies(true)}
        >
          Medias references
        </button>
        <button
          className={`medias-toggle-btn ${!filtreReferencies ? 'medias-toggle-btn--active' : ''}`}
          onClick={() => setFiltreReferencies(false)}
        >
          Tous les medias
        </button>
      </div>

      {groupes.map(g => {
        const hasSourcesInGroup = g.items.some(m => m.nb_sources > 0)
        return (
          <details key={g.key} className="medias-group" open={hasSourcesInGroup}>
            <summary>{g.label} ({g.items.length})</summary>
            <div className="medias-grid">
              {g.items
                .sort((a, b) => b.nb_sources - a.nb_sources)
                .map(m => (
                  <div key={m.id} className="media-card" onClick={() => selectMedia(m.id)}>
                    <div className="media-card-initial">{m.nom.charAt(0).toUpperCase()}</div>
                    <div className="media-card-nom">{m.nom}</div>
                    <div className="media-card-meta">
                      {m.nb_sources > 0
                        ? `${m.nb_sources} source${m.nb_sources > 1 ? 's' : ''}`
                        : 'Aucune source'}
                    </div>
                  </div>
                ))}
            </div>
          </details>
        )
      })}
    </div>
  )
}
