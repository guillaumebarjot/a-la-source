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
      {/* Décision produit 27/06 : on supprime l'affichage du score chiffré (/100, Écho/40,
          Pédagogie/50). On garde uniquement le nombre d'évaluations (factuel) et le
          formulaire de contribution. Doctrine : « décrire, ne pas noter ». */}
      {score.nbEvaluations > 0 && (
        <p className="eval-compte">{score.nbEvaluations} membre{score.nbEvaluations > 1 ? 's ont' : ' a'} evalue cette source.</p>
      )}
      {!showForm ? (
        <button className="btn btn-sm" onClick={() => setShowForm(true)}>Evaluer cette source</button>
      ) : (
        <form className="eval-form" onSubmit={handleSubmit}>
          <label>
            Echo mediatique ({echo}/40)
            <span className="slider-saisie">
              <input type="range" min="0" max="40" value={echo} onChange={(e) => setEcho(Number(e.target.value))} />
              <input type="number" min="0" max="40" value={echo}
                onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setEcho(Math.max(0, Math.min(40, v))) }} />
            </span>
          </label>
          <label>
            Qualite pedagogique ({pedagogie}/50)
            <span className="slider-saisie">
              <input type="range" min="0" max="50" value={pedagogie} onChange={(e) => setPedagogie(Number(e.target.value))} />
              <input type="number" min="0" max="50" value={pedagogie}
                onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setPedagogie(Math.max(0, Math.min(50, v))) }} />
            </span>
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
