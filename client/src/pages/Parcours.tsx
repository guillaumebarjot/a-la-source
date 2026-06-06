import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { api } from '../api/client'
import type { ParcoursListItem } from '../types/parcours'
import '../styles/parcours.css'

export default function Parcours() {
  const [parcours, setParcours] = useState<ParcoursListItem[]>([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    api.get<ParcoursListItem[]>('/parcours')
      .then(setParcours)
      .catch(() => setParcours([]))
      .finally(() => setChargement(false))
  }, [])

  return (
    <div className="parcours-page">
      <header className="parcours-page-header">
        <h1>Parcours</h1>
        <p className="parcours-page-intro">
          Entrainez votre oeil a reperer les mecanismes a l'oeuvre sur des sources
          reelles. Sur chaque source, devinez quel mecanisme est mobilise, puis
          decouvrez la correction. Le score mesure votre progression.
        </p>
      </header>

      {chargement ? (
        <div className="parcours-loading">Chargement...</div>
      ) : parcours.length === 0 ? (
        <div className="parcours-empty">
          Aucun parcours disponible pour le moment.
        </div>
      ) : (
        <div className="parcours-list">
          {parcours.map((p) => (
            <article key={p.id} className="parcours-card">
              <h2 className="parcours-card-titre">{p.titre}</h2>
              {p.description && <p className="parcours-card-desc">{p.description}</p>}
              <p className="parcours-card-meta">
                {p.nb_questions} question{p.nb_questions > 1 ? 's' : ''}
              </p>
              <Link to={`/parcours/${p.id}`} className="parcours-btn">
                <GraduationCap size={16} /> Commencer
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
