import { useState, useEffect } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../store/useAuth'
import type { Commentaire } from '../../types'
import '../../styles/attribution.css'

interface Props {
  sourceId: number
}

export default function CommentairesPanel({ sourceId }: Props) {
  const user = useAuth((s) => s.user)
  const [commentaires, setCommentaires] = useState<Commentaire[]>([])
  const [newComment, setNewComment] = useState('')
  const [type, setType] = useState<string>('commentaire')

  // Edition en place d'un commentaire (par son auteur ou un admin).
  const [editId, setEditId] = useState<number | null>(null)
  const [editContenu, setEditContenu] = useState('')
  const [editUrl, setEditUrl] = useState('')

  function recharger() {
    return api.get<Commentaire[]>(`/commentaires/${sourceId}`).then(setCommentaires)
  }

  useEffect(() => {
    recharger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    await api.post('/commentaires', { source_id: sourceId, contenu: newComment, type })
    setNewComment('')
    await recharger()
  }

  function peutEditer(c: Commentaire) {
    return !!user && (user.id === c.auteur_id || user.role === 'admin')
  }

  function demarrerEdition(c: Commentaire) {
    setEditId(c.id)
    setEditContenu(c.contenu)
    setEditUrl(c.url ?? '')
  }

  async function enregistrerEdition(c: Commentaire) {
    if (!editContenu.trim()) return
    await api.put(`/commentaires/${c.id}`, {
      contenu: editContenu,
      ...(c.type === 'lien' ? { url: editUrl } : {}),
    })
    setEditId(null)
    await recharger()
  }

  async function supprimer(c: Commentaire) {
    await api.delete(`/commentaires/${c.id}`)
    if (editId === c.id) setEditId(null)
    await recharger()
  }

  return (
    <>
      <div className="commentaires-list">
        {commentaires.map((c) => (
          <div key={c.id} className="commentaire-item">
            <div className="commentaire-header">
              <strong className="attribution commentaire-attribution">par {c.auteur_nom || 'anonyme'}</strong>
              <span className="commentaire-type">{c.type}</span>
              {c.origine === 'discord' && <span className="commentaire-origine">via Discord</span>}
              <time>{new Date(c.cree_le).toLocaleDateString('fr-FR')}</time>
            </div>

            {editId === c.id ? (
              <div className="commentaire-edition">
                <textarea
                  value={editContenu}
                  onChange={(e) => setEditContenu(e.target.value)}
                  rows={2}
                />
                {c.type === 'lien' && (
                  <input
                    type="url"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    placeholder="https://..."
                  />
                )}
                <div className="commentaire-actions">
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => enregistrerEdition(c)}>Enregistrer</button>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditId(null)}>Annuler</button>
                </div>
              </div>
            ) : (
              <>
                {c.type === 'lien' && c.url
                  ? <p><a href={c.url} target="_blank" rel="noopener noreferrer">{c.contenu || c.url}</a></p>
                  : <p>{c.contenu}</p>}
                {peutEditer(c) && (
                  <div className="commentaire-actions">
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => demarrerEdition(c)}>Modifier</button>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => { if (window.confirm('Supprimer ce commentaire ?')) supprimer(c) }}>Supprimer</button>
                  </div>
                )}
              </>
            )}
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
    </>
  )
}
