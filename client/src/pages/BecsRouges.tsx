import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { Contenu } from '../types'

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

function formatDuree(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function BecsRouges() {
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
    <div className="page-becs-rouges">
      <h1>Les Becs Rouges</h1>

      <section className="br-section">
        {presentation ? (
          <p>{presentation.contenu}</p>
        ) : (
          <p>
            Les Becs Rouges produisent des contenus video et audio pour informer
            et sensibiliser sur les enjeux locaux et sociaux en Alsace du Nord.
          </p>
        )}
      </section>

      <section className="br-section">
        <h2>Videos</h2>
        <div className="br-links">
          <a href="https://indymotion.fr/a/nupesalsacenordvosgesdunord/videos" target="_blank" rel="noopener noreferrer" className="btn btn-outline">
            Chaine Indymotion
          </a>
          <a href="https://www.youtube.com/@BecsRouges" target="_blank" rel="noopener noreferrer" className="btn btn-outline">
            Chaine YouTube
          </a>
        </div>

        {loading ? (
          <p className="loading">Chargement des videos...</p>
        ) : videos.length === 0 ? (
          <p className="empty">Aucune video disponible pour le moment.</p>
        ) : (
          <div className="br-video-grid">
            {videos.map((v) => (
              <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" className="br-video-card">
                <div className="br-video-thumb">
                  <img src={v.vignette} alt={v.titre} loading="lazy" referrerPolicy="no-referrer" />
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

      <section className="br-section">
        <h2>Podcasts</h2>
        <p className="empty">Lecteur audio a venir.</p>
      </section>

      <section className="br-section">
        <a href="https://becs-rouges.fr" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
          Visiter becs-rouges.fr
        </a>
      </section>
    </div>
  )
}
