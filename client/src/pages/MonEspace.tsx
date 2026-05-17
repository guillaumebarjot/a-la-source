import { useState, useEffect } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../store/useAuth'
import type { Lecture, Contenu } from '../types'

interface Video {
  id: string
  titre: string
  description: string
  vignette: string
  duree: number
  date: string
  vues: number
  url: string
  plateforme: string
}

interface Chaine {
  nom: string
  description: string
  url: string
  plateforme: string
}

function formatDuree(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}


/* ---------- Section Lectures ---------- */

function SectionLectures() {
  const user = useAuth((s) => s.user)
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [recommandations, setRecommandations] = useState<Lecture[]>([])

  useEffect(() => {
    api.get<Lecture[]>('/auth/lectures').then(setLectures)
    api.get<Lecture[]>('/auth/recommandations').then(setRecommandations)
  }, [])

  if (!user) return <p className="loading">Chargement...</p>

  const aLire = lectures.filter((l) => l.statut === 'a_lire')
  const lus = lectures.filter((l) => l.statut === 'lu')

  return (
    <>
      <section>
        <h2>A lire ({aLire.length})</h2>
        {aLire.length === 0 ? <p className="empty">Rien en file d'attente.</p> : (
          <div className="lecture-list">
            {aLire.map((l) => (
              <Link key={l.source_id} to={`/lire/${l.source_id}`} className="lecture-item">
                <span>{l.titre}</span>
                <span className="lecture-media">{l.media_nom}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {recommandations.length > 0 && (
        <section>
          <h2>Recommandations recues ({recommandations.length})</h2>
          <div className="lecture-list">
            {recommandations.map((r) => (
              <Link key={r.source_id} to={`/lire/${r.source_id}`} className="lecture-item">
                <span>{r.titre}</span>
                <span className="lecture-media">{r.media_nom}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>Deja lus ({lus.length})</h2>
        {lus.length === 0 ? <p className="empty">Aucune source lue.</p> : (
          <div className="lecture-list">
            {lus.slice(0, 10).map((l) => (
              <Link key={l.source_id} to={`/lire/${l.source_id}`} className="lecture-item">
                <span>{l.titre}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

/* ---------- Section Chaines amies ---------- */

const CHAINES_AMIES: Chaine[] = [
  {
    nom: 'Les Becs Rouges',
    description: 'Contenus video et audio pour informer et sensibiliser sur les enjeux locaux et sociaux en Alsace du Nord.',
    url: 'https://becs-rouges.fr',
    plateforme: 'becs-rouges.fr',
  },
  {
    nom: 'Les Becs Rouges — YouTube',
    description: 'Chaine YouTube des Becs Rouges.',
    url: 'https://www.youtube.com/@BecsRouges',
    plateforme: 'YouTube',
  },
  {
    nom: 'Les Becs Rouges - Indymotion',
    description: 'Chaine Indymotion des Becs Rouges (plateforme libre).',
    url: 'https://indymotion.fr/a/nupesalsacenordvosgesdunord/videos',
    plateforme: 'Indymotion',
  },
  {
    nom: 'Rouge Coquelicot',
    description: 'Association d\'education populaire sur l\'information. A venir.',
    url: 'https://rouge-coquelicot.fr',
    plateforme: 'rouge-coquelicot.fr',
  },
]

function SectionChaines() {
  const [presentation, setPresentation] = useState<Contenu | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Contenu>('/contenus/becs-rouges').then(setPresentation).catch(() => {})
    api.get<Video[]>('/becs-rouges/videos/indymotion')
      .then(setVideos)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <section className="chaines-intro">
        <h2>Chaines amies</h2>
        <p>
          Retrouvez ici les chaines de nos collectifs et associations partenaires.
          Des contenus video, audio et ecrits pour s'informer autrement.
        </p>
      </section>

      <section className="chaines-grid">
        {CHAINES_AMIES.map((c) => (
          <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer" className="chaine-card">
            <h3 className="chaine-card-nom">{c.nom}</h3>
            <p className="chaine-card-desc">{c.description}</p>
            <span className="chaine-card-plateforme">{c.plateforme}</span>
          </a>
        ))}
      </section>

      {/* Videos Becs Rouges */}
      <section className="br-section">
        <h2>Dernieres videos — Les Becs Rouges</h2>
        {presentation && <p className="br-presentation">{presentation.contenu}</p>}

        {loading ? (
          <p className="loading">Chargement des videos...</p>
        ) : videos.length === 0 ? (
          <p className="empty">Aucune video disponible pour le moment.</p>
        ) : (
          <div className="br-video-grid">
            {videos.map((v) => (
              <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" className="br-video-card">
                <div className="br-video-thumb">
                  <img src={v.vignette} alt={v.titre} loading="lazy" />
                  <span className="br-video-duration">{formatDuree(v.duree)}</span>
                </div>
                <div className="br-video-info">
                  <h3>{v.titre}</h3>
                  <span className="br-video-meta">
                    {new Date(v.date).toLocaleDateString('fr-FR')} — {v.vues} vues
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

/* ---------- Composant principal ---------- */

export default function MonEspace() {
  const { section } = useParams<{ section?: string }>()
  const user = useAuth((s) => s.user)

  if (!section) return <Navigate to="/perso/lectures" replace />

  return (
    <div className="page-perso">
      <p className="page-intro">Vos lectures sauvegardees et les chaines partenaires a suivre.</p>

      {section === 'lectures' && <SectionLectures />}
      {section === 'chaines' && <SectionChaines />}
    </div>
  )
}
