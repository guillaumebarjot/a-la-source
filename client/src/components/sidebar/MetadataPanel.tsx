import type { Source } from '../../types'

interface Props {
  source: Source
}

export default function MetadataPanel({ source }: Props) {
  return (
    <div className="sidebar-panel">
      <h3>Metadonnees</h3>
      <dl className="metadata-list">
        {source.media_nom && <><dt>Media</dt><dd>{source.media_nom}</dd></>}
        {source.auteur_nom && <><dt>Auteur</dt><dd>{source.auteur_nom}</dd></>}
        {source.date_publication && <><dt>Date</dt><dd>{new Date(source.date_publication).toLocaleDateString('fr-FR')}</dd></>}
        {source.type_source && <><dt>Type</dt><dd>{source.type_source}</dd></>}
        <dt>Paywall</dt><dd>{source.paywall ? 'Oui' : 'Non'}</dd>
        <dt>Statut</dt><dd className={`badge badge-${source.statut}`}>{source.statut}</dd>
      </dl>
    </div>
  )
}
