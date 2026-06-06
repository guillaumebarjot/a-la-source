import { Link } from 'react-router-dom'
import { Unlock, Lock, FileWarning, FileCheck, File, Star, Target, MessageCircle } from 'lucide-react'
import type { Source } from '../../types'
import '../../styles/attribution.css'

interface ScoreOverlay {
  scoreTotal: number
  timing: string
  fraicheur?: number
  nbEvaluations: number
}

interface AtelierBadge {
  atelier_id: number
  numero: number
  statut: string
}

interface Props {
  source: Source
  score?: ScoreOverlay
  showFraicheur?: boolean
  action?: React.ReactNode
  atelierBadges?: AtelierBadge[]
  /* Contexte atelier/projection : carte nue, on masque l'attribution pour ne pas biaiser. */
  hideAttribution?: boolean
}

export default function SourceCard({ source, score, showFraicheur, action, atelierBadges, hideAttribution }: Props) {
  const imgSrc = source.image_url || (source as unknown as Record<string, unknown>).og_image as string | undefined
  const hasArchive = !!source.has_archive
  const isPaywall = source.paywall === 1

  // Atelier badges: "retenue #N" for active, "utilisee #N" for terminated
  const retenues = atelierBadges?.filter(b => b.statut !== 'termine') || []
  const utilisees = atelierBadges?.filter(b => b.statut === 'termine') || []
  const isUsed = utilisees.length > 0 && retenues.length === 0

  return (
    <div className={`source-card${isUsed ? ' source-card--used' : ''}`}>
      {imgSrc && (
        <Link to={`/lire/${source.id}`} className="source-card-image">
          <img src={imgSrc} alt="" loading="lazy" />
        </Link>
      )}

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

        {/* Atelier badges */}
        {(retenues.length > 0 || utilisees.length > 0) && (
          <div className="source-card-atelier-badges">
            {retenues.map(b => (
              <span key={b.atelier_id} className="badge-atelier badge-atelier--retenue" title={`Retenue pour l'atelier #${b.numero}`}>
                retenue #{b.numero}
              </span>
            ))}
            {utilisees.map(b => (
              <span key={b.atelier_id} className="badge-atelier badge-atelier--utilisee" title={`Utilisee dans l'atelier #${b.numero}`}>
                utilisee #{b.numero}
              </span>
            ))}
          </div>
        )}

        <div className="source-card-footer">
          {source.date_publication && (
            <time className="source-card-date">
              {new Date(source.date_publication).toLocaleDateString('fr-FR')}
            </time>
          )}
          <div className="source-card-badges">
            {isPaywall && (
              <span
                className={`badge-icon ${hasArchive && source.archive_statut === 'complete' ? 'badge-icon--success' : 'badge-icon--warning'}`}
                title={hasArchive && source.archive_statut === 'complete' ? 'Paywall contourne (copie locale complete)' : 'Acces payant'}
              >
                {hasArchive && source.archive_statut === 'complete' ? <Unlock size={14} /> : <Lock size={14} />}
              </span>
            )}
            {hasArchive && source.archive_statut === 'partielle' && (
              <Link
                to={`/archiver/contribuer?source=${source.id}`}
                className="badge-icon badge-icon--warning"
                title="Copie locale incomplete — cliquez pour completer"
              >
                <FileWarning size={14} />
              </Link>
            )}
            {hasArchive && source.archive_statut !== 'partielle' && (
              <span className="badge-icon badge-icon--success" title="Copie locale disponible"><FileCheck size={14} /></span>
            )}
            {!hasArchive && !isPaywall && (
              <span className="badge-icon badge-icon--muted" title="Pas de copie locale"><File size={14} /></span>
            )}
            {score && (
              <span className="badge-icon" title={`${score.nbEvaluations} evaluation(s)`}>
                <Star size={14} />{score.nbEvaluations}
              </span>
            )}
            {(source.nb_ateliers ?? 0) > 0 && !atelierBadges && (
              <span className="badge-icon" title={`${source.nb_ateliers} atelier(s)`}><Target size={14} /></span>
            )}
            {(source.nb_commentaires ?? 0) > 0 && (
              <span className="badge-icon" title={`${source.nb_commentaires} commentaire(s)`}>
                <MessageCircle size={14} />{source.nb_commentaires}
              </span>
            )}
          </div>
        </div>
        {!hideAttribution && source.soumis_par_nom && (
          <div className="attribution source-card-attribution">propose par {source.soumis_par_nom}</div>
        )}
        {action && <div className="source-card-action">{action}</div>}
      </div>
    </div>
  )
}
