import { useState } from 'react'
import { api } from '../../api/client'
import type { Tag } from '../../types'

interface Props {
  sourceId: number
  tags: Tag[]
  onRefresh: () => void
}

export default function TagsPanel({ sourceId, tags, onRefresh }: Props) {
  const [newTag, setNewTag] = useState('')

  async function addTag(e: React.FormEvent) {
    e.preventDefault()
    if (!newTag.trim()) return
    await api.post(`/tags/source/${sourceId}`, { tag_nom: newTag.trim() })
    setNewTag('')
    onRefresh()
  }

  async function removeTag(tagId: number) {
    if (!window.confirm('Supprimer ce tag ?')) return
    await api.delete(`/tags/source/${sourceId}/${tagId}`)
    onRefresh()
  }

  return (
    <>
      <div className="tags-list">
        {tags.map((t) => (
          <span key={t.id} className={`badge badge-tag ${t.couleur ? 'badge-tag--colored' : ''}`} style={t.couleur ? { backgroundColor: t.couleur } : undefined}>
            {t.nom}
            <button className="badge-remove" onClick={() => removeTag(t.id)}>&times;</button>
          </span>
        ))}
      </div>
      <form className="tags-add" onSubmit={addTag}>
        <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Ajouter un tag..." />
        <button type="submit" className="btn btn-sm">+</button>
      </form>
    </>
  )
}
