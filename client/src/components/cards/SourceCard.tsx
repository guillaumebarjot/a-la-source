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
          {source.paywall === 1 && <span className="badge badge-paywall">Paywall</span>}
        </div>
        {source.accroche && <p className="source-card-accroche">{source.accroche}</p>}
        {source.date_publication && (
          <time className="source-card-date">
            {new Date(source.date_publication).toLocaleDateString('fr-FR')}
          </time>
        )}
      </div>
    </Link>
  )
}
