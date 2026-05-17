import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import SubNav from '../components/layout/SubNav'
import FichesMedias from '../components/observatoire/FichesMedias'
import type { MecanismeStat, Media } from '../types'

/* ---------- Types ---------- */

interface TimelineRow {
  mois: string
  mecanisme_id: number
  mecanisme_nom: string
  nb: number
}

interface MatriceRow {
  media_id: number
  media_nom: string
  mecanisme_id: number
  mecanisme_nom: string
  nb: number
}

interface ConfianceRow {
  media_id: number
  media_nom: string
  score: number
  nbSources: number
  nbMecanismesMoyen: number
  diversiteMecanismes: number
}

interface TopSourceRow {
  id: number
  titre: string
  url: string | null
  media_nom: string | null
  nb_mecanismes: number
  nb_evaluations: number
  nb_commentaires: number
  score_richesse: number
}

// Palette fixe pour les mecanismes (8 couleurs distinctes)
const MECA_COLORS = [
  '#c0392b', '#2980b9', '#27ae60', '#f39c12',
  '#8e44ad', '#e67e22', '#16a085', '#d35400'
]

function getMecaColor(index: number): string {
  return MECA_COLORS[index % MECA_COLORS.length]
}

const SUBNAV_ITEMS = [
  { label: 'Mecanismes', to: '/observatoire/mecanismes' },
  { label: 'Medias', to: '/observatoire/medias' },
  { label: 'Fiches medias', to: '/observatoire/fiches' },
  { label: 'Sources', to: '/observatoire/sources' },
]

/* ---------- Section Mecanismes ---------- */

function SectionMecanismes({
  mecanismes,
  timeline,
  medias,
  matrice,
}: {
  mecanismes: MecanismeStat[]
  timeline: TimelineRow[]
  medias: Media[]
  matrice: MatriceRow[]
}) {
  const totalSources = medias.reduce((s, m) => s + (m.nb_sources || 0), 0)

  // Timeline : barres empilees par mois
  const moisList = [...new Set(timeline.map(r => r.mois))].sort()
  const mecaIds = [...new Set(timeline.map(r => r.mecanisme_id))]
  const mecaNoms = new Map(timeline.map(r => [r.mecanisme_id, r.mecanisme_nom]))
  const maxParMois = Math.max(
    ...moisList.map(m => timeline.filter(r => r.mois === m).reduce((s, r) => s + r.nb, 0)),
    1
  )

  // Matrice : media x mecanisme
  const matriceMedias = [...new Set(matrice.map(r => r.media_nom))].sort()
  const matriceMecas = [...new Set(matrice.map(r => r.mecanisme_nom))].sort()
  const matriceMax = Math.max(...matrice.map(r => r.nb), 1)
  function getMatriceNb(mediaNom: string, mecaNom: string): number {
    return matrice.find(r => r.media_nom === mediaNom && r.mecanisme_nom === mecaNom)?.nb || 0
  }

  return (
    <>
      <div className="stats-global">
        <div className="stat-box"><span className="stat-number">{totalSources}</span><span className="stat-label">sources</span></div>
        <div className="stat-box"><span className="stat-number">{mecanismes.length}</span><span className="stat-label">mecanismes</span></div>
        <div className="stat-box"><span className="stat-number">{medias.length}</span><span className="stat-label">medias</span></div>
      </div>

      {/* Timeline mecanismes */}
      <section className="obs-section">
        <h2>Timeline des mecanismes identifies</h2>
        {moisList.length === 0 ? (
          <p className="obs-empty">Pas assez de donnees pour afficher la timeline.</p>
        ) : (
          <>
            <div className="obs-legend">
              {mecaIds.map((id, i) => (
                <span key={id} className="obs-legend-item">
                  <span className="obs-legend-dot" style={{ background: getMecaColor(i) }} />
                  {mecaNoms.get(id)}
                </span>
              ))}
            </div>
            <div className="obs-timeline">
              {moisList.map(mois => {
                const rows = timeline.filter(r => r.mois === mois)
                const total = rows.reduce((s, r) => s + r.nb, 0)
                return (
                  <div key={mois} className="obs-timeline-col">
                    <div className="obs-timeline-bar" title={`${mois} : ${total} identifications`}>
                      {rows.map(r => {
                        const idx = mecaIds.indexOf(r.mecanisme_id)
                        const height = (r.nb / maxParMois) * 100
                        return (
                          <div
                            key={r.mecanisme_id}
                            className="obs-timeline-segment"
                            style={{ height: `${height}%`, background: getMecaColor(idx) }}
                            title={`${r.mecanisme_nom} : ${r.nb}`}
                          />
                        )
                      })}
                    </div>
                    <span className="obs-timeline-label">{mois.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* Matrice media x mecanisme */}
      <section className="obs-section">
        <h2>Matrice media / mecanisme</h2>
        {matrice.length === 0 ? (
          <p className="obs-empty">Pas assez de donnees pour afficher la matrice.</p>
        ) : (
          <div className="obs-matrice-wrap">
            <table className="obs-matrice">
              <thead>
                <tr>
                  <th></th>
                  {matriceMecas.map(m => (
                    <th key={m} className="obs-matrice-th-meca">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matriceMedias.map(media => (
                  <tr key={media}>
                    <td className="obs-matrice-td-media">{media}</td>
                    {matriceMecas.map(meca => {
                      const nb = getMatriceNb(media, meca)
                      const intensity = nb > 0 ? Math.min(1, nb / matriceMax * 2) : 0
                      return (
                        <td
                          key={meca}
                          className="obs-matrice-cell"
                          style={{
                            background: nb > 0 ? `rgba(192, 57, 43, ${0.15 + intensity * 0.7})` : 'transparent'
                          }}
                          title={`${media} / ${meca} : ${nb}`}
                        >
                          {nb > 0 ? nb : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

/* ---------- Section Medias ---------- */

function SectionMedias({
  medias,
  confiance,
}: {
  medias: Media[]
  confiance: ConfianceRow[]
}) {
  return (
    <>
      {/* Stats medias */}
      <section className="obs-section">
        <h2>Sources par media</h2>
        {medias.length === 0 ? (
          <p className="obs-empty">Aucun media reference.</p>
        ) : (
          <div className="obs-top-sources">
            {[...medias]
              .filter(m => (m.nb_sources || 0) > 0)
              .sort((a, b) => (b.nb_sources || 0) - (a.nb_sources || 0))
              .map(m => {
                const max = medias.reduce((mx, x) => Math.max(mx, x.nb_sources || 0), 1)
                const pct = ((m.nb_sources || 0) / max) * 100
                return (
                  <div key={m.id} className="obs-top-row">
                    <div className="obs-top-info">
                      <span className="obs-top-titre">{m.nom}</span>
                      <span className="obs-top-meta">{m.nb_sources} source{(m.nb_sources || 0) > 1 ? 's' : ''}</span>
                    </div>
                    <div className="obs-top-bar-track">
                      <div className="obs-top-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </section>

      {/* Classement confiance media */}
      <section className="obs-section">
        <h2>Indice de confiance par media</h2>
        {confiance.length === 0 ? (
          <p className="obs-empty">Pas assez de donnees pour afficher l'indice de confiance.</p>
        ) : (
          <div className="obs-confiance">
            {confiance.map(c => {
              const color = c.score >= 70 ? 'var(--rc-vert)' : c.score >= 40 ? 'var(--rc-orange)' : 'var(--rc-rouge)'
              return (
                <div key={c.media_id} className="obs-confiance-row">
                  <span className="obs-confiance-nom">{c.media_nom}</span>
                  <div className="obs-confiance-bar-track">
                    <div
                      className="obs-confiance-bar-fill"
                      style={{ width: `${c.score}%`, background: color }}
                    />
                  </div>
                  <span className="obs-confiance-score" style={{ color }}>{c.score}/100</span>
                  <span className="obs-confiance-meta">
                    {c.nbSources} source{c.nbSources > 1 ? 's' : ''} — {c.nbMecanismesMoyen} meca./source
                  </span>
                </div>
              )
            })}
            <p className="obs-confiance-note">
              Score bas = plus de mecanismes de manipulation identifies en moyenne par source.
            </p>
          </div>
        )}
      </section>
    </>
  )
}

/* ---------- Section Sources ---------- */

function SectionSources({ topSources }: { topSources: TopSourceRow[] }) {
  return (
    <section className="obs-section">
      <h2>Top sources les plus evaluees</h2>
      {topSources.length === 0 ? (
        <p className="obs-empty">Pas assez de donnees pour afficher le classement.</p>
      ) : (
        <div className="obs-top-sources">
          {topSources.map((s, i) => {
            const maxScore = topSources[0].score_richesse
            const pct = (s.score_richesse / maxScore) * 100
            return (
              <div key={s.id} className="obs-top-row">
                <span className="obs-top-rank">#{i + 1}</span>
                <div className="obs-top-info">
                  <span className="obs-top-titre">{s.titre}</span>
                  <span className="obs-top-meta">
                    {s.media_nom && <em>{s.media_nom}</em>}
                    {' '}{s.nb_mecanismes} meca. / {s.nb_evaluations} eval. / {s.nb_commentaires} comm.
                  </span>
                </div>
                <div className="obs-top-bar-track">
                  <div className="obs-top-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ---------- Composant principal ---------- */

export default function Observatoire() {
  const { section } = useParams<{ section?: string }>()
  const [mecanismes, setMecanismes] = useState<MecanismeStat[]>([])
  const [medias, setMedias] = useState<Media[]>([])
  const [timeline, setTimeline] = useState<TimelineRow[]>([])
  const [matrice, setMatrice] = useState<MatriceRow[]>([])
  const [confiance, setConfiance] = useState<ConfianceRow[]>([])
  const [topSources, setTopSources] = useState<TopSourceRow[]>([])

  useEffect(() => {
    api.get<MecanismeStat[]>('/mecanismes/stats').then(setMecanismes)
    api.get<Media[]>('/medias').then(setMedias)
    api.get<TimelineRow[]>('/mecanismes/timeline').then(setTimeline)
    api.get<MatriceRow[]>('/medias/matrice').then(setMatrice)
    api.get<ConfianceRow[]>('/medias/confiance').then(setConfiance)
    api.get<TopSourceRow[]>('/sources/top-evaluees').then(setTopSources)
  }, [])

  if (!section) return <Navigate to="/observatoire/mecanismes" replace />

  return (
    <div className="page-observatoire">
      <h1>Observatoire</h1>
      <SubNav items={SUBNAV_ITEMS} />

      {section === 'mecanismes' && (
        <SectionMecanismes
          mecanismes={mecanismes}
          timeline={timeline}
          medias={medias}
          matrice={matrice}
        />
      )}

      {section === 'medias' && (
        <SectionMedias medias={medias} confiance={confiance} />
      )}

      {section === 'fiches' && (
        <FichesMedias />
      )}

      {section === 'sources' && (
        <SectionSources topSources={topSources} />
      )}
    </div>
  )
}
