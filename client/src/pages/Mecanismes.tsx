import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { api } from '../api/client'
import type { Contenu } from '../types'

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

  // Aide content
  const [scoring, setScoring] = useState<Contenu | null>(null)
  const [guidelines, setGuidelines] = useState<Contenu | null>(null)
  const [epoche, setEpoche] = useState<Contenu | null>(null)

  // Manuel content
  const [manuel, setManuel] = useState<Contenu | null>(null)

  // Charger les categories au montage
  useEffect(() => {
    api.get<Categorie[]>('/mecanismes/categories').then(setCategories)
  }, [])

  // Charger les mecanismes d'une categorie
  useEffect(() => {
    if (categorie && categorie !== 'aide' && !slug) {
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

  // Charger contenus aide
  useEffect(() => {
    if (categorie === 'aide') {
      api.get<Contenu>('/contenus/scoring').then(setScoring).catch(() => {})
      api.get<Contenu>('/contenus/guidelines').then(setGuidelines).catch(() => {})
      api.get<Contenu>('/contenus/epoche').then(setEpoche).catch(() => {})
    }
  }, [categorie])

  // Charger contenu manuel
  useEffect(() => {
    if (categorie === 'manuel') {
      api.get<Contenu>('/contenus/manuel-deconstruction').then(setManuel).catch(() => {})
    }
  }, [categorie])

  // Redirect /apprendre sans section vers /apprendre (catalogue = pas de categorie)
  // On ne redirige pas ici car l'absence de categorie = index catalogue

  // === Section Manuel de deconstruction ===
  if (categorie === 'manuel') {
    return (
      <div className="page-mecanismes">
        {manuel ? (
          <article className="manuel-content">
            <ReactMarkdown>{manuel.contenu || ''}</ReactMarkdown>
          </article>
        ) : (
          <p className="loading">Chargement du manuel...</p>
        )}
      </div>
    )
  }

  // === Section Aide & Ressources ===
  if (categorie === 'aide') {
    return (
      <div className="page-mecanismes">
        <p className="page-intro">
          Comment fonctionne l'outil et les ressources pour aller plus loin.
        </p>

        <section className="aide-section">
          <h2>Comment fonctionne l'outil</h2>
          <p>
            « A la source » est un outil collaboratif d'education populaire aux medias,
            porte par Rouge Coquelicot. Il permet de collecter des sources mediatiques,
            d'identifier les mecanismes informationnels a l'oeuvre, et de preparer des ateliers
            de decryptage collectif.
          </p>
          <h3>Parcours type</h3>
          <ol>
            <li><strong>Flux</strong> — Soumettre des sources, les taguer, commenter</li>
            <li><strong>Lire</strong> — Lire en detail, identifier des mecanismes, evaluer</li>
            <li><strong>Vivier</strong> — Les meilleures sources remontent dans le pipeline atelier</li>
            <li><strong>Atelier</strong> — Le·la facilitateur·ice selectionne, le groupe decouvre et debat</li>
          </ol>
        </section>

        <section className="aide-section">
          <h2>Mecanismes informationnels</h2>
          <p>
            Pour comprendre comment l'information est fabriquee, il faut savoir identifier les
            procedes recurrents du traitement mediatique. Nous avons documente 25 mecanismes,
            organises en 6 categories, avec des definitions detaillees, des exemples concrets
            et des questions guidees pour les ateliers.
          </p>
          <Link to="/apprendre" className="btn btn-primary" style={{ marginTop: '0.5rem', display: 'inline-block' }}>
            Explorer les mecanismes
          </Link>
        </section>

        {epoche && (
          <section className="aide-section">
            <ReactMarkdown>{epoche.contenu || ''}</ReactMarkdown>
          </section>
        )}

        {scoring && (
          <section className="aide-section">
            <ReactMarkdown>{scoring.contenu || ''}</ReactMarkdown>
          </section>
        )}

        {guidelines && (
          <section className="aide-section">
            <ReactMarkdown>{guidelines.contenu || ''}</ReactMarkdown>
          </section>
        )}
      </div>
    )
  }

  // === Niveau 3 : Fiche individuelle ===
  if (slug && fiche) {
    const questions = (() => {
      try { return JSON.parse(fiche.questions_guidees || '[]') as string[] }
      catch { return [] }
    })()

    return (
      <div className="page-mecanismes">
        <nav className="mecanismes-breadcrumb">
          <Link to="/apprendre">Catalogue</Link>
          <span className="breadcrumb-sep">/</span>
          <Link to={`/apprendre/${fiche.categorie}`}>
            {fiche.categorie_label || CATEGORIE_LABELS[fiche.categorie] || fiche.categorie}
          </Link>
          <span className="breadcrumb-sep">/</span>
          <span>{fiche.nom}</span>
        </nav>

        <article className="mecanisme-fiche">
          <header className="mecanisme-fiche-header">
            <h2>{fiche.nom}</h2>
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
          <Link to="/apprendre">Catalogue</Link>
          <span className="breadcrumb-sep">/</span>
          <span>{catLabel}</span>
        </nav>

        <h2>{catLabel}</h2>
        {catDesc && <p className="page-intro">{catDesc}</p>}

        <div className="mecanismes-liste">
          {mecas.map((m) => (
            <Link key={m.id} to={`/apprendre/${categorie}/${m.slug}`} className="mecanisme-card-large">
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

  // === Niveau 1 : Index des categories (Catalogue) ===
  return (
    <div className="page-mecanismes">
      <h1>Apprendre</h1>
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
          <Link key={cat.categorie} to={`/apprendre/${cat.categorie}`} className="mecanisme-categorie-card">
            <h2>{cat.categorie_label || CATEGORIE_LABELS[cat.categorie] || cat.categorie}</h2>
            <p>{cat.categorie_description}</p>
            <span className="mecanisme-categorie-count">{cat.nb} mecanisme{cat.nb > 1 ? 's' : ''}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
