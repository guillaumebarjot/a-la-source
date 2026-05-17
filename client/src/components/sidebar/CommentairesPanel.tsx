import { useState, useEffect } from 'react'
import { api } from '../../api/client'
import type { Commentaire } from '../../types'

interface Props {
  sourceId: number
}

export default function CommentairesPanel({ sourceId }: Props) {
  const [commentaires, setCommentaires] = useState<Commentaire[]>([])
  const [newComment, setNewComment] = useState('')
  const [type, setType] = useState<string>('commentaire')

  useEffect(() => {
    api.get<Commentaire[]>(`/commentaires/${sourceId}`).then(setCommentaires)
  }, [sourceId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    await api.post('/commentaires', { source_id: sourceId, contenu: newComment, type })
    setNewComment('')
    const data = await api.get<Commentaire[]>(`/commentaires/${sourceId}`)
    setCommentaires(data)
  }

  return (
    <div className="sidebar-panel">
      <h3>Commentaires ({commentaires.length})</h3>
      <div className="commentaires-list">
        {commentaires.map((c) => (
          <div key={c.id} className="commentaire-item">
            <div className="commentaire-header">
              <strong>{c.auteur_nom}</strong>
              <span className="commentaire-type">{c.type}</span>
              <time>{new Date(c.cree_le).toLocaleDateString('fr-FR')}</time>
            </div>
            <p>{c.contenu}</p>
          </div>
        ))}
      </div>
      <form className="commentaire-form" onSubmit={handleSubmit}>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="commentaire">Commentaire</option>
          <option value="analyse">Analyse</option>
          <option value="question">Question</option>
          <option value="lien">Lien</option>
        </select>
        <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Votre commentaire..." rows={2} />
        <button type="submit" className="btn btn-sm btn-primary">Envoyer</button>
      </form>
    </div>
  )
}
