import { Link } from 'react-router-dom'
import type { Source } from '../../types'

interface Props {
  source: Source
}

export default function SourceCard({ source }: Props) {
  return (
    <Link to={`/lire/${source.id}`} className="source-card">
      {source.image_url && (
        <div className="source-card-image">
          <img src={source.image_url} alt="" loading="lazy" />
        </div>
      )}
      <div className="source-card-body">
        <h3 className="source-card-title">{source.titre}</h3>
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
            {source.paywall === 1 && <span className="badge badge-paywall" title="Acces payant">Paywall</span>}
            {source.has_archive ? (
              <span className="badge badge-archive-ok" title="Archive disponible">Archive</span>
            ) : (
              <span className="badge badge-no-archive" title="Pas d'archive">Pas d'archive</span>
            )}
            {(source.nb_ateliers ?? 0) > 0 && (
              <span className="badge badge-atelier" title={`Selectionne pour ${source.nb_ateliers} atelier(s)`}>
                Atelier {source.nb_ateliers}
              </span>
            )}
            {(source.nb_commentaires ?? 0) > 0 && (
              <span className="badge badge-discussion" title={`${source.nb_commentaires} commentaire(s)`}>
                Discussion
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
