import { useState } from 'react'
import type { Archive } from '../../types'
import { api } from '../../api/client'
import MarkdownReader from './MarkdownReader'
import ReadabilityReader from './ReadabilityReader'
import PdfReader from './PdfReader'

interface Props {
  archive: Archive | null
  url: string | null
  sourceId: number
  onArchived: () => void
}

export default function Reader({ archive, url, sourceId, onArchived }: Props) {
  if (!archive) {
    return (
      <div className="reader-empty">
        <p>Pas d'archive locale pour cette source.</p>
        {url && (
          <div className="reader-actions">
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              Lire l'original
            </a>
            <ArchiveButton sourceId={sourceId} onArchived={onArchived} />
          </div>
        )}
      </div>
    )
  }

  switch (archive.type) {
    case 'markdown':
      return <MarkdownReader content={archive.contenu || ''} />
    case 'pdf':
      return <PdfReader chemin={archive.chemin} />
    case 'readability':
    case 'html':
      return <ReadabilityReader content={archive.contenu || ''} />
    default:
      return <p>Format non supporte.</p>
  }
}

function ArchiveButton({ sourceId, onArchived }: { sourceId: number; onArchived: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleArchive() {
    setLoading(true)
    try {
      await api.post(`/sources/${sourceId}/archiver`, {})
      onArchived()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button className="btn btn-primary" onClick={handleArchive} disabled={loading}>
      {loading ? 'Archivage...' : 'Archiver maintenant'}
    </button>
  )
}
