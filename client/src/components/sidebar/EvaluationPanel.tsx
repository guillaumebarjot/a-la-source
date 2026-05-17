import { useState } from 'react'
import { api } from '../../api/client'
import type { ScoreResult } from '../../types'

interface Props {
  sourceId: number
  score: ScoreResult
}

export default function EvaluationPanel({ sourceId, score }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [echo, setEcho] = useState(20)
  const [pedagogie, setPedagogie] = useState(25)
  const [commentaire, setCommentaire] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await api.post('/evaluations', {
      source_id: sourceId, score_echo: echo, score_pedagogie: pedagogie, commentaire: commentaire || null,
    })
    setShowForm(false)
  }

  return (
    <>
      <div className="score-summary">
        <div className="score-total">{score.scoreTotal}</div>
        <div className="score-details">
          <span>Echo: {Math.round(score.moyEcho)}/40</span>
          <span>Pedagogie: {Math.round(score.moyPedagogie)}/50</span>
          <span>Fraicheur: x{score.fraicheur.toFixed(2)}</span>
          <span>{score.nbEvaluations} eval{score.nbEvaluations > 1 ? 's' : ''}</span>
        </div>
      </div>
      {!showForm ? (
        <button className="btn btn-sm" onClick={() => setShowForm(true)}>Evaluer</button>
      ) : (
        <form className="eval-form" onSubmit={handleSubmit}>
          <label>
            Echo mediatique ({echo}/40)
            <input type="range" min="0" max="40" value={echo} onChange={(e) => setEcho(Number(e.target.value))} />
          </label>
          <label>
            Qualite pedagogique ({pedagogie}/50)
            <input type="range" min="0" max="50" value={pedagogie} onChange={(e) => setPedagogie(Number(e.target.value))} />
          </label>
          <label>
            Commentaire
            <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2} />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
            <button type="submit" className="btn btn-sm btn-primary">Envoyer</button>
          </div>
        </form>
      )}
    </>
  )
}
