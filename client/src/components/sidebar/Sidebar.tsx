import { useState } from 'react'
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

function CollapsiblePanel({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="sidebar-panel">
      <h3
        className="sidebar-panel-collapsible"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {title}
      </h3>
      <div className="sidebar-panel-content" aria-hidden={!open}>
        {children}
      </div>
    </div>
  )
}

function MotsClefsPanel({ source }: { source: SourceDetail }) {
  const keywords = (source as Record<string, unknown>).mots_cles as string | undefined
  if (!keywords) return <p className="empty-small">Aucun mot-cle extrait.</p>
  const mots = keywords.split(',').map(m => m.trim()).filter(Boolean)
  return (
    <div className="mots-clefs-list">
      {mots.map((m, i) => (
        <span key={i} className="badge badge-mot-clef">{m}</span>
      ))}
    </div>
  )
}

export default function Sidebar({ source, onRefresh }: Props) {
  return (
    <aside className="sidebar">
      <CollapsiblePanel title="Metadonnees" defaultOpen={false}>
        <MetadataPanel source={source} />
      </CollapsiblePanel>
      <CollapsiblePanel title="Mots-clefs" defaultOpen={false}>
        <MotsClefsPanel source={source} />
      </CollapsiblePanel>
      <CollapsiblePanel title="Tags" defaultOpen={false}>
        <TagsPanel sourceId={source.id} tags={source.tags} onRefresh={onRefresh} />
      </CollapsiblePanel>
      <CollapsiblePanel title="Evaluation" defaultOpen={false}>
        <EvaluationPanel sourceId={source.id} score={source.score} />
      </CollapsiblePanel>
      <CollapsiblePanel title="Mecanismes" defaultOpen={false}>
        <MecanismesPanel sourceId={source.id} mecanismes={source.mecanismes} onRefresh={onRefresh} />
      </CollapsiblePanel>
      <CollapsiblePanel title="Commentaires" defaultOpen={false}>
        <CommentairesPanel sourceId={source.id} />
      </CollapsiblePanel>
    </aside>
  )
}
