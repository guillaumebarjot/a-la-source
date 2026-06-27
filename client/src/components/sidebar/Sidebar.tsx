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
  const toggle = () => setOpen((o) => !o)
  return (
    <div className="sidebar-panel">
      {/* role="button" + tabIndex + onKeyDown : rend le repli accessible au clavier (C1). */}
      <h3
        className="sidebar-panel-collapsible"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
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
  const keywords = (source as unknown as Record<string, unknown>).mots_cles as string | undefined
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
      {/* Décision produit 27/06 : Mécanismes et Commentaires ouverts par défaut (D5)
          car ce sont les actions cœur de la lecture analytique. */}
      <CollapsiblePanel title="Mecanismes" defaultOpen={true}>
        <MecanismesPanel sourceId={source.id} mecanismes={source.mecanismes} onRefresh={onRefresh} />
      </CollapsiblePanel>
      <CollapsiblePanel title="Commentaires" defaultOpen={true}>
        <CommentairesPanel sourceId={source.id} />
      </CollapsiblePanel>
    </aside>
  )
}
