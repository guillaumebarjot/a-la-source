import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'

interface Mecanisme {
  id: number
  nom: string
  slug: string
  description: string
  definition_longue?: string
  exemple: string
  questions_guidees: string
  categorie: string
  categorie_label?: string
  categorie_description?: string
  sources_reference?: string
}

interface Categorie {
  categorie: string
  categorie_label: string
  categorie_description: string
  nb: number
}

const CATEGORIE_LABELS: Record<string, string> = {
  argumentation: 'Raisonnement et argumentation',
  cadrage: 'Cadrage et mise en scene',
  manipulation: 'Manipulation du langage',
  manipulation_chiffres: 'Manipulation des chiffres',
  manipulation_emotion: "Manipulation par l'emotion",
  selection_info: "Selection de l'information",
}

export default function Mecanismes() {
  const { categorie, slug } = useParams()
  const [categories, setCategories] = useState<Categorie[]>([])
  const [mecas, setMecas] = useState<Mecanisme[]>([])
  const [fiche, setFiche] = useState<Mecanisme | null>(null)

  // Charger les categories au montage
  useEffect(() => {
    api.get<Categorie[]>('/mecanismes/categories').then(setCategories)
  }, [])

  // Charger les mecanismes d'une categorie
  useEffect(() => {
    if (categorie && !slug) {
      api.get<Mecanisme[]>(`/mecanismes/categorie/${categorie}`).then(setMecas)
    }
  }, [categorie, slug])

  // Charger la fiche d'un mecanisme
  useEffect(() => {
    if (slug) {
      api.get<Mecanisme>(`/mecanismes/fiche/${slug}`).then(setFiche)
    } else {
      setFiche(null)
    }
  }, [slug])

  // === Niveau 3 : Fiche individuelle ===
  if (slug && fiche) {
    const questions = (() => {
      try { return JSON.parse(fiche.questions_guidees || '[]') as string[] }
      catch { return [] }
    })()

    return (
      <div className="page-mecanismes">
        <nav className="mecanismes-breadcrumb">
          <Link to="/mecanismes">Mecanismes</Link>
          <span className="breadcrumb-sep">/</span>
          <Link to={`/mecanismes/${fiche.categorie}`}>
            {fiche.categorie_label || CATEGORIE_LABELS[fiche.categorie] || fiche.categorie}
          </Link>
          <span className="breadcrumb-sep">/</span>
          <span>{fiche.nom}</span>
        </nav>

        <article className="mecanisme-fiche">
          <header className="mecanisme-fiche-header">
            <h1>{fiche.nom}</h1>
            <span className="mecanisme-categorie-badge">
              {fiche.categorie_label || CATEGORIE_LABELS[fiche.categorie] || fiche.categorie}
            </span>
          </header>

          <p className="mecanisme-definition-courte">{fiche.description}</p>

          {fiche.definition_longue && (
            <section className="mecanisme-section">
              <h2>Comprendre ce mecanisme</h2>
              <div className="mecanisme-definition-longue">
                {fiche.definition_longue.split('\n\n').map((para, i) => {
                  if (para.startsWith('Exemples multiples :')) {
                    const lines = para.split('\n')
                    return (
                      <div key={i} className="mecanisme-exemples-bloc">
                        <h3>Exemples</h3>
                        <ul>
                          {lines.slice(1).map((l, j) => (
                            <li key={j}>{l.replace(/^- /, '')}</li>
                          ))}
                        </ul>
                      </div>
                    )
                  }
                  return <p key={i}>{para}</p>
                })}
              </div>
            </section>
          )}

          {fiche.exemple && !fiche.definition_longue && (
            <section className="mecanisme-section">
              <h2>Exemple</h2>
              <blockquote className="mecanisme-exemple">{fiche.exemple}</blockquote>
            </section>
          )}

          {questions.length > 0 && (
            <section className="mecanisme-section">
              <h2>Questions guidees pour l'atelier</h2>
              <p className="mecanisme-section-intro">
                Ces questions peuvent etre utilisees en atelier pour guider l'analyse collective
                d'une source ou l'on suspecte ce mecanisme.
              </p>
              <ol className="mecanisme-questions">
                {questions.map((q, i) => <li key={i}>{q}</li>)}
              </ol>
            </section>
          )}

          {fiche.sources_reference && (
            <section className="mecanisme-section">
              <h2>Pour aller plus loin</h2>
              <p className="mecanisme-sources">{fiche.sources_reference}</p>
            </section>
          )}
        </article>
      </div>
    )
  }

  // === Niveau 2 : Mecanismes d'une categorie ===
  if (categorie && mecas.length > 0) {
    const catLabel = mecas[0]?.categorie_label || CATEGORIE_LABELS[categorie] || categorie
    const catDesc = mecas[0]?.categorie_description || ''

    return (
      <div className="page-mecanismes">
        <nav className="mecanismes-breadcrumb">
          <Link to="/mecanismes">Mecanismes</Link>
          <span className="breadcrumb-sep">/</span>
          <span>{catLabel}</span>
        </nav>

        <h1>{catLabel}</h1>
        {catDesc && <p className="page-intro">{catDesc}</p>}

        <div className="mecanismes-liste">
          {mecas.map((m) => (
            <Link key={m.id} to={`/mecanismes/${categorie}/${m.slug}`} className="mecanisme-card-large">
              <h2>{m.nom}</h2>
              <p>{m.description}</p>
              {m.exemple && (
                <blockquote className="mecanisme-card-exemple">
                  {m.exemple.substring(0, 150)}{m.exemple.length > 150 ? '...' : ''}
                </blockquote>
              )}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  // === Niveau 1 : Index des categories ===
  return (
    <div className="page-mecanismes">
      <h1>Mecanismes informationnels</h1>
      <p className="page-intro">
        Ces mecanismes sont des procedes recurrents dans le traitement mediatique de l'information.
        Les identifier permet de mieux comprendre comment une information est construite — pas de
        « denoncer les medias », mais de developper le sens critique de chacun·e.
      </p>
      <p className="page-intro">
        Chaque mecanisme est documente avec une definition, des exemples concrets, et des questions
        guidees utilisables en atelier. Explorez par categorie, puis plongez dans les fiches individuelles.
      </p>

      <div className="mecanismes-categories-grid">
        {categories.map((cat) => (
          <Link key={cat.categorie} to={`/mecanismes/${cat.categorie}`} className="mecanisme-categorie-card">
            <h2>{cat.categorie_label || CATEGORIE_LABELS[cat.categorie] || cat.categorie}</h2>
            <p>{cat.categorie_description}</p>
            <span className="mecanisme-categorie-count">{cat.nb} mecanisme{cat.nb > 1 ? 's' : ''}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
