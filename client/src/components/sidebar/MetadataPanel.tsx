import type { Source } from '../../types'

interface Props {
  source: Source
}

const STATUT_LABELS: Record<string, string> = {
  veille: 'En veille',
  vivier: 'Proposee pour atelier',
  atelier: 'Selectionnee pour atelier',
  archive: 'Archivee',
}

export default function MetadataPanel({ source }: Props) {
  return (
    <dl className="metadata-list">
      {source.media_nom && <><dt>Media</dt><dd>{source.media_nom}</dd></>}
      {source.auteur_nom && <><dt>Auteur</dt><dd>{source.auteur_nom}</dd></>}
      {source.date_publication && <><dt>Date</dt><dd>{new Date(source.date_publication).toLocaleDateString('fr-FR')}</dd></>}
      {source.type_source && <><dt>Type</dt><dd>{source.type_source}</dd></>}
      {source.paywall === 1 && <><dt>Acces</dt><dd>Paywall</dd></>}
    </dl>
  )
}
