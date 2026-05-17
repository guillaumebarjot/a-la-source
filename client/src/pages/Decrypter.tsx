import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { MecanismeStat, Media } from '../types'

export default function Decrypter() {
  const [mecanismes, setMecanismes] = useState<MecanismeStat[]>([])
  const [medias, setMedias] = useState<Media[]>([])

  useEffect(() => {
    api.get<MecanismeStat[]>('/mecanismes/stats').then(setMecanismes)
    api.get<Media[]>('/medias').then(setMedias)
  }, [])

  const totalSources = medias.reduce((s, m) => s + (m.nb_sources || 0), 0)
  const maxMeca = Math.max(...mecanismes.map((m) => m.nb_sources), 1)

  return (
    <div className="page-decrypter">
      <h1>Observatoire</h1>

      <div className="stats-global">
        <div className="stat-box"><span className="stat-number">{totalSources}</span><span className="stat-label">sources</span></div>
        <div className="stat-box"><span className="stat-number">{mecanismes.length}</span><span className="stat-label">mecanismes</span></div>
        <div className="stat-box"><span className="stat-number">{medias.length}</span><span className="stat-label">medias</span></div>
      </div>

      <section className="decrypter-section">
        <h2>Par mecanisme</h2>
        <div className="mecanisme-bars">
          {mecanismes.map((m) => (
            <div key={m.id} className="bar-row">
              <span className="bar-label">{m.nom}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(m.nb_sources / maxMeca) * 100}%` }} />
              </div>
              <span className="bar-value">{m.nb_sources}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="decrypter-section">
        <h2>Par media</h2>
        <div className="media-table">
          <table>
            <thead>
              <tr><th>Media</th><th>Sources</th></tr>
            </thead>
            <tbody>
              {medias.filter(m => m.nb_sources && m.nb_sources > 0).map((m) => (
                <tr key={m.id}>
                  <td>{m.nom}</td>
                  <td>{m.nb_sources}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
