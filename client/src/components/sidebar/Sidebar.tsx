import type { SourceDetail } from '../../types'
import MetadataPanel from './MetadataPanel'
import TagsPanel from './TagsPanel'
import MecanismesPanel from './MecanismesPanel'
import CommentairesPanel from './CommentairesPanel'
import EvaluationPanel from './EvaluationPanel'

interface Props {
  source: SourceDetail
  onRefresh: () => void
}

export default function Sidebar({ source, onRefresh }: Props) {
  return (
    <aside className="sidebar">
      <MetadataPanel source={source} />
      <TagsPanel sourceId={source.id} tags={source.tags} onRefresh={onRefresh} />
      <MecanismesPanel sourceId={source.id} mecanismes={source.mecanismes} onRefresh={onRefresh} />
      <EvaluationPanel sourceId={source.id} score={source.score} />
      <CommentairesPanel sourceId={source.id} />
      <SidebarActions source={source} onRefresh={onRefresh} />
    </aside>
  )
}

import { api } from '../../api/client'
import { useAuth } from '../../store/useAuth'

function SidebarActions({ source, onRefresh }: { source: SourceDetail; onRefresh: () => void }) {
  const user = useAuth((s) => s.user)

  async function marquerLu() {
    await api.post('/auth/lectures', { source_id: source.id, statut: 'lu' })
  }

  async function proposerVivier() {
    await api.patch(`/sources/${source.id}`, { statut: 'vivier' })
    onRefresh()
  }

  return (
    <div className="sidebar-panel sidebar-actions">
      <button className="btn btn-secondary" onClick={marquerLu}>Marquer lu</button>
      {source.statut === 'veille' && (
        <button className="btn btn-primary" onClick={proposerVivier}>Proposer au vivier</button>
      )}
      {user && source.statut === 'veille' && (
        <button className="btn btn-secondary" onClick={async () => {
          await api.post('/auth/lectures', { source_id: source.id, statut: 'a_lire' })
        }}>A lire plus tard</button>
      )}
    </div>
  )
}
