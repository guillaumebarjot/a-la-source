/**
 * ClustersMedias — vue de clustering des médias par groupe propriétaire et par famille éditoriale.
 *
 * Deux modes de regroupement :
 *   - "Qui possède quoi ?" (groupe_proprietaire) : distingue service public / État, groupes privés,
 *     indéterminé. Chaque groupe est un accordéon de cartes médias cliquables.
 *   - "Par famille éditoriale" (famille) : presse nationale, PQR, TV, radio, pure player, etc.
 *
 * Pédagogie : une phrase d'intro explique l'intérêt sans jargon.
 * Valeurs nulles : section "Propriété indéterminée" / "Famille indéterminée" en fin de liste.
 * Design : sobre, dark-safe absolu, carte canonique existante, pas de rouge sur fond sombre.
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'
import type { ClusterProprietaire, ClusterFamille, Media } from '../../types'

/* ---------- Types locaux ---------- */

type ModeVue = 'proprietaire' | 'famille'

interface MediaStats {
  nb_sources: number
  nb_mecanismes: number
  nb_commentaires: number
  nb_evaluations: number
  mecanismes_reperes: { nom: string; nb: number }[]
  sources_recentes: { id: number; titre: string; date_publication: string | null }[]
}

/* ---------- Constantes ---------- */

// Groupes qu'on considère comme "service public / État / institutions"
const GROUPES_PUBLIC = new Set([
  'Service public audiovisuel',
  'Etat et institutions publiques',
  'Collectivites territoriales',
])

// Familles qu'on considère institutionnelles / publiques
const FAMILLES_PUBLIQUES = new Set([
  'Institutionnel / officiel',
  'Collectivite territoriale',
])

const LABEL_INDETERMINE_PROP = 'Propriété indéterminée'
const LABEL_INDETERMINE_FAM = 'Famille indéterminée'

/* ---------- Sous-composant : carte média ---------- */

function CarteMedia({
  media,
  onClick,
}: {
  media: Media
  onClick: (m: Media) => void
}) {
  return (
    <button
      className="media-card clusters-media-card"
      onClick={() => onClick(media)}
      type="button"
    >
      <div className="media-card-initial">{media.nom.charAt(0).toUpperCase()}</div>
      <div className="media-card-nom">{media.nom}</div>
      <div className="media-card-meta">
        {media.famille && (
          <span className="obs-prop-badge clusters-badge-famille">{media.famille}</span>
        )}
        {media.groupe_proprietaire && (
          <span className="obs-prop-badge clusters-badge-groupe">{media.groupe_proprietaire}</span>
        )}
        {(media.nb_sources ?? 0) > 0
          ? <span>{media.nb_sources} source{(media.nb_sources ?? 0) > 1 ? 's' : ''}</span>
          : <span>Aucune source</span>
        }
      </div>
    </button>
  )
}

/* ---------- Sous-composant : fiche détail média ---------- */

function FicheMedia({
  media,
  onBack,
}: {
  media: Media
  onBack: () => void
}) {
  const [stats, setStats] = useState<MediaStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get<MediaStats>(`/medias/${media.id}/stats`)
      .then(s => { setStats(s); setLoading(false) })
      .catch(() => setLoading(false))
  }, [media.id])

  return (
    <div className="media-detail">
      <button className="media-detail-back" onClick={onBack} type="button">
        ← Retour aux clusters
      </button>
      <div className="media-detail-header">
        <div className="media-card-initial">{media.nom.charAt(0).toUpperCase()}</div>
        <div>
          <h2 style={{ margin: 0 }}>{media.nom}</h2>
          <span className="media-card-meta">
            {media.type || 'Non classé'}
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

      <section className="media-propriete">
        <h3>Propriété et famille éditoriale</h3>
        <table className="media-detail-table">
          <tbody>
            {media.groupe_proprietaire && (
              <tr>
                <th>Groupe propriétaire</th>
                <td>{media.groupe_proprietaire}</td>
              </tr>
            )}
            {media.famille && (
              <tr>
                <th>Famille éditoriale</th>
                <td>{media.famille}</td>
              </tr>
            )}
            {media.proprietaire && (
              <tr>
                <th>Propriétaire direct</th>
                <td>{media.proprietaire}</td>
              </tr>
            )}
            {media.actionnaire_ultime && (
              <tr>
                <th>Au bout de la chaîne</th>
                <td>{media.actionnaire_ultime}</td>
              </tr>
            )}
            {media.type_propriete && (
              <tr>
                <th>Type de propriété</th>
                <td>{media.type_propriete}</td>
              </tr>
            )}
            {media.financement && (
              <tr>
                <th>Financement</th>
                <td>{media.financement}</td>
              </tr>
            )}
            {media.annee_creation && (
              <tr>
                <th>Création</th>
                <td>{media.annee_creation}</td>
              </tr>
            )}
            {media.ligne_revendiquee && (
              <tr>
                <th>Ligne revendiquée</th>
                <td>{media.ligne_revendiquee}</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="media-propriete-note">
          Données de propriété à valider avec la carte Acrimed « Médias français, qui possède quoi ? ». On décrit la structure, on ne note pas le média.
        </p>
      </section>

      {loading ? (
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
                Identifiés par les membres sur les sources de ce média. Des faits d'analyse, pas un classement.
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
        </>
      ) : null}
    </div>
  )
}

/* ---------- Section clusters par groupe propriétaire ---------- */

function SectionClustersProprietaire({
  onSelectMedia,
}: {
  onSelectMedia: (m: Media) => void
}) {
  const [clusters, setClusters] = useState<ClusterProprietaire[]>([])
  const [loading, setLoading] = useState(true)
  const [ouvert, setOuvert] = useState<string | null>(null)

  useEffect(() => {
    api.get<ClusterProprietaire[]>('/medias/clusters-proprietaire')
      .then(data => { setClusters(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <p className="loading">Chargement...</p>

  // Séparer : service public/État, groupes privés, indéterminé
  const secteurPublic = clusters.filter(c => c.groupe !== null && GROUPES_PUBLIC.has(c.groupe))
  const secteurPrive = clusters.filter(c => c.groupe !== null && !GROUPES_PUBLIC.has(c.groupe))
  const indetermine = clusters.filter(c => c.groupe === null)

  const totalMedias = clusters.reduce((s, c) => s + c.nb_medias, 0)
  const totalGroupes = clusters.filter(c => c.groupe !== null).length

  const toggleGroupe = (cle: string) => setOuvert(p => p === cle ? null : cle)

  const renderCluster = (c: ClusterProprietaire, cle: string, estPublic?: boolean) => (
    <div
      key={cle}
      className={[
        'obs-prop-groupe clusters-groupe',
        ouvert === cle ? 'obs-prop-groupe--ouvert' : '',
        estPublic ? 'clusters-groupe--public' : '',
        c.groupe === null ? 'obs-prop-groupe--inconnu' : '',
      ].filter(Boolean).join(' ')}
    >
      <button
        className="obs-prop-groupe-header"
        onClick={() => toggleGroupe(cle)}
        aria-expanded={ouvert === cle}
        type="button"
      >
        <span className={['obs-prop-groupe-nom', c.groupe === null ? 'obs-prop-groupe-nom--inconnu' : ''].filter(Boolean).join(' ')}>
          {c.groupe ?? LABEL_INDETERMINE_PROP}
          {estPublic && <span className="clusters-badge-public">Public</span>}
        </span>
        <span className="obs-prop-groupe-meta">
          <span className="obs-prop-badge">
            {c.nb_medias} média{c.nb_medias > 1 ? 's' : ''}
          </span>
          {c.nb_sources_total > 0 && (
            <span className="obs-prop-badge obs-prop-badge--sources">
              {c.nb_sources_total} source{c.nb_sources_total > 1 ? 's' : ''}
            </span>
          )}
        </span>
        <span className="obs-prop-chevron" aria-hidden="true">
          {ouvert === cle ? '▲' : '▼'}
        </span>
      </button>
      {ouvert === cle && (
        <div className="medias-grid clusters-medias-grid">
          {c.medias.map(m => (
            <CarteMedia key={m.id} media={m} onClick={onSelectMedia} />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
      <div className="obs-intro-bloc">
        <p>
          Voir qui possède quoi : les médias sont regroupés par groupe propriétaire (actionnaire
          au bout de la chaîne). Le service public et les institutions sont distingués des groupes
          privés. Repérer la concentration permet de comprendre les intérêts qui pèsent sur
          l'information. Les données décrivent la structure, elles ne notent pas les médias.
        </p>
      </div>

      <div className="obs-prop-compteurs">
        <div className="stat-box">
          <span className="stat-number">{totalGroupes}</span>
          <span className="stat-label">groupes propriétaires identifiés</span>
        </div>
        <div className="stat-box">
          <span className="stat-number">{totalMedias}</span>
          <span className="stat-label">médias dans la base</span>
        </div>
        <div className="stat-box">
          <span className="stat-number">{secteurPublic.reduce((s, c) => s + c.nb_medias, 0)}</span>
          <span className="stat-label">médias du secteur public</span>
        </div>
      </div>

      {clusters.length === 0 && (
        <p className="obs-empty">Aucune donnée de groupe propriétaire renseignée pour l'instant.</p>
      )}

      {secteurPublic.length > 0 && (
        <section className="clusters-section">
          <h2 className="clusters-section-titre clusters-section-titre--public">
            Service public et institutions
          </h2>
          <p className="clusters-section-desc">
            Médias financés par la collectivité ou adossés à une institution publique.
          </p>
          <div className="obs-prop-groupes">
            {secteurPublic.map(c => renderCluster(c, c.groupe!, true))}
          </div>
        </section>
      )}

      {secteurPrive.length > 0 && (
        <section className="clusters-section">
          <h2 className="clusters-section-titre">Groupes privés</h2>
          <p className="clusters-section-desc">
            Médias détenus par des groupes industriels, des conglomérats ou des capitaux privés.
          </p>
          <div className="obs-prop-groupes">
            {secteurPrive.map(c => renderCluster(c, c.groupe!))}
          </div>
        </section>
      )}

      {indetermine.length > 0 && indetermine[0].nb_medias > 0 && (
        <section className="clusters-section">
          <div className="obs-prop-groupes">
            {renderCluster(indetermine[0], '__indetermine_prop')}
          </div>
        </section>
      )}
    </>
  )
}

/* ---------- Section clusters par famille éditoriale ---------- */

function SectionClustersFamille({
  onSelectMedia,
}: {
  onSelectMedia: (m: Media) => void
}) {
  const [clusters, setClusters] = useState<ClusterFamille[]>([])
  const [loading, setLoading] = useState(true)
  const [ouvert, setOuvert] = useState<string | null>(null)

  useEffect(() => {
    api.get<ClusterFamille[]>('/medias/clusters-famille')
      .then(data => { setClusters(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <p className="loading">Chargement...</p>

  const familles = clusters.filter(c => c.famille !== null)
  const indetermine = clusters.filter(c => c.famille === null)
  const totalMedias = clusters.reduce((s, c) => s + c.nb_medias, 0)

  const toggleFamille = (cle: string) => setOuvert(p => p === cle ? null : cle)

  const renderCluster = (c: ClusterFamille, cle: string) => {
    const estPublic = c.famille !== null && FAMILLES_PUBLIQUES.has(c.famille)
    return (
      <div
        key={cle}
        className={[
          'obs-prop-groupe clusters-groupe',
          ouvert === cle ? 'obs-prop-groupe--ouvert' : '',
          c.famille === null ? 'obs-prop-groupe--inconnu' : '',
        ].filter(Boolean).join(' ')}
      >
        <button
          className="obs-prop-groupe-header"
          onClick={() => toggleFamille(cle)}
          aria-expanded={ouvert === cle}
          type="button"
        >
          <span className={['obs-prop-groupe-nom', c.famille === null ? 'obs-prop-groupe-nom--inconnu' : ''].filter(Boolean).join(' ')}>
            {c.famille ?? LABEL_INDETERMINE_FAM}
            {estPublic && <span className="clusters-badge-public">Public</span>}
          </span>
          <span className="obs-prop-groupe-meta">
            <span className="obs-prop-badge">
              {c.nb_medias} média{c.nb_medias > 1 ? 's' : ''}
            </span>
            {c.nb_sources_total > 0 && (
              <span className="obs-prop-badge obs-prop-badge--sources">
                {c.nb_sources_total} source{c.nb_sources_total > 1 ? 's' : ''}
              </span>
            )}
          </span>
          <span className="obs-prop-chevron" aria-hidden="true">
            {ouvert === cle ? '▲' : '▼'}
          </span>
        </button>
        {ouvert === cle && (
          <div className="medias-grid clusters-medias-grid">
            {c.medias.map(m => (
              <CarteMedia key={m.id} media={m} onClick={onSelectMedia} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="obs-intro-bloc">
        <p>
          Parcourir les médias par type de presse et de diffusion : presse nationale, régionale,
          économique, télévision, radio, pure players, médias scientifiques, associatifs, think
          tanks. Repérer quelle famille est la mieux représentée dans notre veille, et lesquelles
          sont absentes.
        </p>
      </div>

      <div className="obs-prop-compteurs">
        <div className="stat-box">
          <span className="stat-number">{familles.length}</span>
          <span className="stat-label">familles éditoriales</span>
        </div>
        <div className="stat-box">
          <span className="stat-number">{totalMedias}</span>
          <span className="stat-label">médias dans la base</span>
        </div>
      </div>

      {clusters.length === 0 && (
        <p className="obs-empty">Aucune famille éditoriale renseignée pour l'instant.</p>
      )}

      <div className="obs-prop-groupes">
        {familles.map(c => renderCluster(c, c.famille!))}
        {indetermine.length > 0 && indetermine[0].nb_medias > 0 &&
          renderCluster(indetermine[0], '__indetermine_fam')
        }
      </div>
    </>
  )
}

/* ---------- Composant principal exporté ---------- */

export default function ClustersMedias() {
  const [mode, setMode] = useState<ModeVue>('proprietaire')
  const [mediaSelectionne, setMediaSelectionne] = useState<Media | null>(null)

  const selectionnerMedia = useCallback((m: Media) => setMediaSelectionne(m), [])
  const retourListe = useCallback(() => setMediaSelectionne(null), [])

  if (mediaSelectionne) {
    return <FicheMedia media={mediaSelectionne} onBack={retourListe} />
  }

  return (
    <div className="clusters-medias">
      <div className="clusters-bascule">
        <button
          className={`medias-toggle-btn${mode === 'proprietaire' ? ' medias-toggle-btn--active' : ''}`}
          onClick={() => setMode('proprietaire')}
          type="button"
        >
          Qui possède quoi ?
        </button>
        <button
          className={`medias-toggle-btn${mode === 'famille' ? ' medias-toggle-btn--active' : ''}`}
          onClick={() => setMode('famille')}
          type="button"
        >
          Par famille éditoriale
        </button>
      </div>

      {mode === 'proprietaire'
        ? <SectionClustersProprietaire onSelectMedia={selectionnerMedia} />
        : <SectionClustersFamille onSelectMedia={selectionnerMedia} />
      }
    </div>
  )
}
