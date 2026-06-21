import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Shuffle } from 'lucide-react'
import { api } from '../api/client'
import type { ParcoursListItem } from '../types/parcours'
import '../styles/parcours.css'

// Un groupe de quiz rattaches au meme grand theme (sujet), ou le groupe
// transversal (quiz sans sujet, dont le parcours historique).
interface GroupeQuiz {
  cle: string
  sujet_titre: string | null
  sujet_slug: string | null
  quiz: ParcoursListItem[]
}

export default function Parcours() {
  const [parcours, setParcours] = useState<ParcoursListItem[]>([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    api.get<ParcoursListItem[]>('/parcours')
      .then(setParcours)
      .catch(() => setParcours([]))
      .finally(() => setChargement(false))
  }, [])

  // Regroupement par sujet : un bloc par theme, plus un bloc « transversaux »
  // (sujet_id null) en fin de liste. Plusieurs quiz peuvent partager un theme.
  const groupes = useMemo<GroupeQuiz[]>(() => {
    const parSujet = new Map<string, GroupeQuiz>()
    const transversaux: ParcoursListItem[] = []
    for (const p of parcours) {
      if (p.sujet_id == null) { transversaux.push(p); continue }
      const cle = String(p.sujet_id)
      const g = parSujet.get(cle) ?? {
        cle, sujet_titre: p.sujet_titre, sujet_slug: p.sujet_slug, quiz: [],
      }
      g.quiz.push(p)
      parSujet.set(cle, g)
    }
    const liste = [...parSujet.values()].sort((a, b) =>
      (a.sujet_titre ?? '').localeCompare(b.sujet_titre ?? ''))
    if (transversaux.length > 0) {
      liste.push({ cle: 'transversaux', sujet_titre: null, sujet_slug: null, quiz: transversaux })
    }
    return liste
  }, [parcours])

  return (
    <div className="parcours-page">
      <header className="parcours-page-header">
        <h1>Parcours</h1>
        <p className="parcours-page-intro">
          Entrainez votre oeil a reperer les mecanismes a l'oeuvre sur des sources
          reelles. Les quiz sont ranges par grand theme. Sur chaque source, devinez
          quel mecanisme est mobilise, puis decouvrez la correction : on explore, on
          n'est pas note.
        </p>
      </header>

      {chargement ? (
        <div className="parcours-loading">Chargement...</div>
      ) : parcours.length === 0 ? (
        <div className="parcours-empty">
          Aucun parcours disponible pour le moment.
        </div>
      ) : (
        <div className="parcours-groupes">
          {groupes.map((g) => (
            <section key={g.cle} className="parcours-groupe">
              <header className="parcours-groupe-head">
                <h2 className="parcours-groupe-titre">
                  {g.sujet_titre ?? 'Parcours transversaux'}
                </h2>
                {g.sujet_slug && (
                  <Link to={`/sujets/${g.sujet_slug}`} className="parcours-groupe-lien">
                    Voir le theme
                  </Link>
                )}
              </header>
              <div className="parcours-list">
                {g.quiz.map((p) => (
                  <article key={p.id} className="parcours-card">
                    <h3 className="parcours-card-titre">{p.titre}</h3>
                    {p.description && <p className="parcours-card-desc">{p.description}</p>}
                    <p className="parcours-card-meta">
                      {p.mode === 'tirage' && (
                        <span className="parcours-tag-tirage">
                          <Shuffle size={12} /> Tirage
                        </span>
                      )}
                      {p.nb_questions} question{p.nb_questions > 1 ? 's' : ''}
                    </p>
                    <Link to={`/parcours/${p.id}`} className="parcours-btn">
                      <GraduationCap size={16} /> Commencer
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
