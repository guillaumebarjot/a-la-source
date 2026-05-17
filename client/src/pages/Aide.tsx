import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { api } from '../api/client'
import type { Contenu } from '../types'

export default function Aide() {
  const [scoring, setScoring] = useState<Contenu | null>(null)
  const [guidelines, setGuidelines] = useState<Contenu | null>(null)
  const [epoche, setEpoche] = useState<Contenu | null>(null)

  useEffect(() => {
    api.get<Contenu>('/contenus/scoring').then(setScoring).catch(() => {})
    api.get<Contenu>('/contenus/guidelines').then(setGuidelines).catch(() => {})
    api.get<Contenu>('/contenus/epoche').then(setEpoche).catch(() => {})
  }, [])

  return (
    <div className="page-aide">
      <h1>Aide</h1>

      <section className="aide-section">
        <h2>Comment fonctionne l'outil</h2>
        <p>
          « A la source » est un outil collaboratif d'education populaire sur l'information,
          porte par Rouge Coquelicot. Il permet de collecter des sources mediatiques,
          d'identifier les mecanismes informationnels a l'oeuvre, et de preparer des ateliers
          de decryptage collectif.
        </p>
        <h3>Parcours type</h3>
        <ol>
          <li><strong>Veille</strong> — Soumettre des sources, les taguer, commenter</li>
          <li><strong>Lire</strong> — Lire en detail, identifier des mecanismes, evaluer</li>
          <li><strong>Vivier</strong> — Les meilleures sources remontent dans le pipeline atelier</li>
          <li><strong>Atelier</strong> — Le·la facilitateur·ice selectionne, le groupe decouvre et debat</li>
        </ol>
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
