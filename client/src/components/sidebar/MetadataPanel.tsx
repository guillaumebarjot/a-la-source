import { useState } from 'react'
import { api } from '../../api/client'
import type { Source } from '../../types'
import '../../styles/completude.css'

interface Props {
  source: Source
}

type Completude = 'libre' | 'partiel' | 'integral_offline'

const COMPLETUDE_OPTIONS: { value: '' | Completude; label: string }[] = [
  { value: '', label: 'Non renseignee' },
  { value: 'libre', label: 'Texte integral en acces libre' },
  { value: 'partiel', label: 'Partiel (archive partielle ou paywall)' },
  { value: 'integral_offline', label: 'Integral consulte hors-ligne (Europresse, BnF...)' },
]

export default function MetadataPanel({ source }: Props) {
  const [completude, setCompletude] = useState<'' | Completude>(
    (source.completude as Completude | null) || ''
  )
  const [saving, setSaving] = useState(false)

  async function onChangeCompletude(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value as '' | Completude
    setCompletude(value)
    setSaving(true)
    try {
      await api.patch(`/sources/${source.id}`, { completude: value || null })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <dl className="metadata-list">
        {source.media_nom && <><dt>Media</dt><dd>{source.media_nom}</dd></>}
        {source.auteur_nom && <><dt>Auteur</dt><dd>{source.auteur_nom}</dd></>}
        {source.date_publication && <><dt>Date</dt><dd>{new Date(source.date_publication).toLocaleDateString('fr-FR')}</dd></>}
        {source.type_source && <><dt>Type</dt><dd>{source.type_source}</dd></>}
        {source.paywall === 1 && <><dt>Acces</dt><dd>Paywall</dd></>}
      </dl>
      <div className="completude-editor">
        <label htmlFor={`completude-${source.id}`}>Completude{saving ? ' (enregistrement...)' : ''}</label>
        <select
          id={`completude-${source.id}`}
          value={completude}
          onChange={onChangeCompletude}
          disabled={saving}
        >
          {COMPLETUDE_OPTIONS.map((o) => (
            <option key={o.value || 'none'} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </>
  )
}
