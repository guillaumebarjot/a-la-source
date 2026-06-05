import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import { api } from '../api/client'
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
  '#D91E2E', '#2980b9', '#27ae60', '#f39c12',
  '#8e44ad', '#e67e22', '#16a085', '#d35400'
]

function getMecaColor(index: number): string {
  return MECA_COLORS[index % MECA_COLORS.length]
}


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

  // Recharts format: [{mois, "Cadrage": 3, ...}, ...]
  const timelineData = moisList.map(mois => {
    const row: Record<string, string | number> = { mois }
    timeline.filter(r => r.mois === mois).forEach(r => { row[r.mecanisme_nom] = r.nb })
    return row
  })
  const mecaNomsList = [...new Set(timeline.map(r => r.mecanisme_nom))]

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
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timelineData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <XAxis dataKey="mois" tickFormatter={(v: string) => v.slice(5)} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              {mecaNomsList.map((nom, i) => (
                <Bar key={nom} dataKey={nom} stackId="a" fill={getMecaColor(i)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
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
                            background: nb > 0 ? `rgba(217, 30, 46, ${0.15 + intensity * 0.7})` : 'transparent'
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
        ) : (() => {
          const filteredMedias = [...medias]
            .filter(m => (m.nb_sources || 0) > 0)
            .sort((a, b) => (b.nb_sources || 0) - (a.nb_sources || 0))
            .map(m => ({ nom: m.nom, nb_sources: m.nb_sources || 0 }))
          return (
            <ResponsiveContainer width="100%" height={Math.max(300, filteredMedias.length * 35)}>
              <BarChart layout="vertical" data={filteredMedias} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <YAxis type="category" dataKey="nom" width={120} tick={{ fontSize: 13 }} />
                <XAxis type="number" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="nb_sources" fill="var(--rc-crimson)" />
              </BarChart>
            </ResponsiveContainer>
          )
        })()}
      </section>

      {/* Classement confiance media */}
      <section className="obs-section">
        <h2>Indice de confiance par media</h2>
        {confiance.length === 0 ? (
          <p className="obs-empty">Pas assez de donnees pour afficher l'indice de confiance.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(300, confiance.length * 40)}>
              <BarChart layout="vertical" data={confiance} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <YAxis type="category" dataKey="media_nom" width={120} tick={{ fontSize: 13 }} />
                <XAxis type="number" domain={[0, 100]} allowDecimals={false} />
                <Tooltip formatter={(value) => [`${value}/100`, 'Score']} />
                <Bar dataKey="score">
                  {confiance.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.score >= 70 ? '#15803d' : entry.score >= 40 ? '#d97706' : '#D91E2E'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="obs-confiance-note">
              Score bas = plus de mecanismes de manipulation identifies en moyenne par source.
            </p>
          </>
        )}
      </section>
    </>
  )
}

/* ---------- Section Sources ---------- */

function TopSourceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.85rem' }}>
      <p style={{ fontWeight: 600 }}>{d.titre}</p>
      {d.media_nom && <p>{d.media_nom}</p>}
      <p>{d.nb_mecanismes} méca. / {d.nb_evaluations} éval. / {d.nb_commentaires} comm.</p>
      <p>Score : {d.score_richesse}</p>
    </div>
  )
}

function SectionSources({ topSources }: { topSources: TopSourceRow[] }) {
  return (
    <section className="obs-section">
      <h2>Top sources les plus evaluees</h2>
      {topSources.length === 0 ? (
        <p className="obs-empty">Pas assez de donnees pour afficher le classement.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(300, topSources.length * 40)}>
          <BarChart layout="vertical" data={topSources} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
            <YAxis type="category" dataKey="titre" width={200} tick={{ fontSize: 12 }} />
            <XAxis type="number" allowDecimals={false} />
            <Tooltip content={<TopSourceTooltip />} />
            <Bar dataKey="score_richesse" fill="var(--rc-crimson)" />
          </BarChart>
        </ResponsiveContainer>
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
