import { Link } from 'react-router-dom'
import type { Source } from '../../types'

interface ScoreOverlay {
  scoreTotal: number
  timing: string
  fraicheur?: number
  nbEvaluations: number
}

interface Props {
  source: Source
  score?: ScoreOverlay
  showFraicheur?: boolean
  action?: React.ReactNode
}

export default function SourceCard({ source, score, showFraicheur, action }: Props) {
  const imgSrc = source.image_url || (source as Record<string, unknown>).og_image as string | undefined
  const hasArchive = !!source.has_archive
  const isPaywall = source.paywall === 1

  return (
    <div className="source-card">
      {imgSrc && (
        <Link to={`/lire/${source.id}`} className="source-card-image">
          <img src={imgSrc} alt="" loading="lazy" />
        </Link>
      )}

      {/* Overlay score pour le vivier */}
      {score && (
        <div className="source-card-score-overlay">
          <span className="score-overlay-value">{score.scoreTotal}</span>
          <span className={`badge-timing badge-timing--${score.timing}`}>{score.timing}</span>
          {showFraicheur && score.fraicheur != null && (
            <span className="score-overlay-fraicheur">{(score.fraicheur * 100).toFixed(0)}%</span>
          )}
        </div>
      )}

      <div className="source-card-body">
        <Link to={`/lire/${source.id}`} className="source-card-title">{source.titre}</Link>
        <div className="source-card-meta">
          {source.media_nom && <span className="source-card-media">{source.media_nom}</span>}
          {source.type_source && <span className="source-card-type">{source.type_source}</span>}
        </div>
        {source.accroche && <p className="source-card-accroche">{source.accroche}</p>}
        <div className="source-card-footer">
          {source.date_publication && (
            <time className="source-card-date">
              {new Date(source.date_publication).toLocaleDateString('fr-FR')}
            </time>
          )}
          <div className="source-card-badges">
            {isPaywall && (
              <span
                className={`badge badge-paywall ${hasArchive && source.archive_statut === 'complete' ? 'badge-paywall--contourne' : ''}`}
                title={hasArchive && source.archive_statut === 'complete' ? 'Paywall contourne (archive complete)' : 'Acces payant'}
              >
                {hasArchive && source.archive_statut === 'complete' ? <s>Paywall</s> : 'Paywall'}
              </span>
            )}
            {hasArchive && source.archive_statut === 'partielle' && (
              <Link to={`/archiver/contribuer?source=${source.id}`} className="badge badge-archive-partielle" title="Archive incomplete — cliquez pour contribuer">
                Archive partielle
              </Link>
            )}
            {hasArchive && source.archive_statut !== 'partielle' && (
              <span className="badge badge-archive-ok" title="Archive disponible">Archive</span>
            )}
            {!hasArchive && !isPaywall && (
              <span className="badge badge-no-archive" title="Pas d'archive">Pas d'archive</span>
            )}
            {score && (
              <span className="badge badge-veille">{score.nbEvaluations} eval</span>
            )}
            {(source.nb_ateliers ?? 0) > 0 && (
              <span className="badge badge-atelier" title={`${source.nb_ateliers} atelier(s)`}>
                Atelier
              </span>
            )}
            {(source.nb_commentaires ?? 0) > 0 && (
              <span className="badge badge-discussion" title={`${source.nb_commentaires} commentaire(s)`}>
                Discussion
              </span>
            )}
          </div>
        </div>
        {action && <div className="source-card-action">{action}</div>}
      </div>
    </div>
  )
}
