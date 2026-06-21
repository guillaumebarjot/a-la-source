import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { api } from '../api/client'
import FichesMedias from '../components/observatoire/FichesMedias'
import Couverture from '../components/observatoire/Couverture'
import type { MecanismeStat } from '../types'

/* ---------- Types locaux ---------- */

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

interface MediaProprietaire {
  id: number
  nom: string
  type: string | null
  url_site: string | null
  proprietaire: string | null
  actionnaire_ultime: string | null
  type_propriete: string | null
  financement: string | null
  annee_creation: number | null
  ligne_revendiquee: string | null
  nb_sources: number
}

interface GroupePropriete {
  groupe: string
  type_propriete: string | null
  nb_sources_total: number
  nb_medias: number
  medias: MediaProprietaire[]
}

interface MecanismeFiche {
  id: number
  nom: string
  slug: string
  description: string | null
  exemple: string | null
  definition_longue: string | null
  questions_guidees: string | null
  categorie: string
  categorie_label: string
  exemples: {
    id: number
    extrait: string | null
    justification: string | null
    identifie_le: string
    source_id: number
    titre: string
    image_url: string | null
    media_nom: string | null
    identifie_par_nom: string | null
  }[]
}

interface MecanismeComplet {
  id: number
  nom: string
  slug: string
  description: string | null
  exemple: string | null
  categorie: string
  categorie_label: string
  categorie_description: string | null
}

/* ---------- Palette données-viz (8 couleurs distinctes) ---------- */

const MECA_COLORS = [
  '#D91E2E', '#2980b9', '#27ae60', '#f39c12',
  '#8e44ad', '#e67e22', '#16a085', '#d35400',
]
function getMecaColor(index: number): string {
  return MECA_COLORS[index % MECA_COLORS.length]
}

/* ---------- Labels lisibles des types de propriété ---------- */

const TYPE_PROPRIETE_LABELS: Record<string, string> = {
  conglomerat: 'Conglomérat',
  capital_prive: 'Capital privé',
  groupe_industriel: 'Groupe industriel',
  public: 'Public / service public',
  cooperative: 'Coopérative',
  associatif: 'Associatif / dons',
  independant: 'Indépendant',
  autre: 'Autre',
}

/* =============================================================================
   Section 1 — Propriété et concentration des médias
   ============================================================================= */

function SectionProprietaire({ groupes }: { groupes: GroupePropriete[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null)

  const avecProp = groupes.filter(g => g.groupe !== '(propriété non renseignée)')
  const sansInfo = groupes.filter(g => g.groupe === '(propriété non renseignée)')

  return (
    <>
      <div className="obs-intro-bloc">
        <p>
          Cartographie factuelle de la propriété des médias présents dans notre veille.
          Les médias sont regroupés par actionnaire ultime (ou propriétaire si pas d'actionnaire connu).
          Données à valider et compléter avec la carte Acrimed « Médias français, qui possède quoi ? ».
          On décrit la structure, on ne note pas les médias.
        </p>
      </div>

      <div className="obs-prop-compteurs">
        <div className="stat-box">
          <span className="stat-number">{avecProp.length}</span>
          <span className="stat-label">groupes propriétaires identifiés</span>
        </div>
        <div className="stat-box">
          <span className="stat-number">{groupes.reduce((s, g) => s + g.nb_medias, 0)}</span>
          <span className="stat-label">médias dans la base</span>
        </div>
        <div className="stat-box">
          <span className="stat-number">{sansInfo[0]?.nb_medias ?? 0}</span>
          <span className="stat-label">médias sans info propriété</span>
        </div>
      </div>

      {groupes.length === 0 && (
        <p className="obs-empty">Aucune donnée de propriété renseignée pour l'instant. Complétez les fiches médias.</p>
      )}

      <div className="obs-prop-groupes">
        {avecProp.map(g => (
          <div
            key={g.groupe}
            className={`obs-prop-groupe${ouvert === g.groupe ? ' obs-prop-groupe--ouvert' : ''}`}
          >
            <button
              className="obs-prop-groupe-header"
              onClick={() => setOuvert(ouvert === g.groupe ? null : g.groupe)}
              aria-expanded={ouvert === g.groupe}
            >
              <span className="obs-prop-groupe-nom">{g.groupe}</span>
              <span className="obs-prop-groupe-meta">
                <span className="obs-prop-badge">
                  {g.nb_medias} média{g.nb_medias > 1 ? 's' : ''}
                </span>
                {g.type_propriete && (
                  <span className="obs-prop-badge">
                    {TYPE_PROPRIETE_LABELS[g.type_propriete] ?? g.type_propriete}
                  </span>
                )}
                <span className="obs-prop-badge obs-prop-badge--sources">
                  {g.nb_sources_total} source{g.nb_sources_total > 1 ? 's' : ''}
                </span>
              </span>
              <span className="obs-prop-chevron" aria-hidden="true">{ouvert === g.groupe ? '▲' : '▼'}</span>
            </button>

            {ouvert === g.groupe && (
              <ul className="obs-prop-medias">
                {g.medias.map(m => (
                  <li key={m.id} className="obs-prop-media-item">
                    <span className="obs-prop-media-nom">{m.nom}</span>
                    <span className="obs-prop-media-meta">
                      {m.type && <span className="obs-prop-badge">{m.type}</span>}
                      {m.type_propriete && m.type_propriete !== g.type_propriete && (
                        <span className="obs-prop-badge">
                          {TYPE_PROPRIETE_LABELS[m.type_propriete] ?? m.type_propriete}
                        </span>
                      )}
                      {m.annee_creation && (
                        <span className="obs-prop-annee">Créé en {m.annee_creation}</span>
                      )}
                      {m.financement && (
                        <span className="obs-prop-annee">{m.financement}</span>
                      )}
                      <span className="obs-prop-badge obs-prop-badge--sources">
                        {m.nb_sources} source{m.nb_sources > 1 ? 's' : ''}
                      </span>
                    </span>
                    {m.ligne_revendiquee && (
                      <span className="obs-prop-ligne">Ligne : {m.ligne_revendiquee}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {sansInfo.length > 0 && sansInfo[0].nb_medias > 0 && (
          <div className={`obs-prop-groupe obs-prop-groupe--inconnu${ouvert === '__inconnu' ? ' obs-prop-groupe--ouvert' : ''}`}>
            <button
              className="obs-prop-groupe-header"
              onClick={() => setOuvert(ouvert === '__inconnu' ? null : '__inconnu')}
              aria-expanded={ouvert === '__inconnu'}
            >
              <span className="obs-prop-groupe-nom obs-prop-groupe-nom--inconnu">
                Propriété non renseignée
              </span>
              <span className="obs-prop-groupe-meta">
                <span className="obs-prop-badge obs-prop-badge--sources">
                  {sansInfo[0].nb_medias} média{sansInfo[0].nb_medias > 1 ? 's' : ''}
                </span>
              </span>
              <span className="obs-prop-chevron" aria-hidden="true">{ouvert === '__inconnu' ? '▲' : '▼'}</span>
            </button>
            {ouvert === '__inconnu' && (
              <ul className="obs-prop-medias">
                {sansInfo[0].medias.map(m => (
                  <li key={m.id} className="obs-prop-media-item">
                    <span className="obs-prop-media-nom">{m.nom}</span>
                    <span className="obs-prop-media-meta">
                      {m.type && <span className="obs-prop-badge">{m.type}</span>}
                      <span className="obs-prop-badge obs-prop-badge--sources">
                        {m.nb_sources} source{m.nb_sources > 1 ? 's' : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  )
}

/* =============================================================================
   Section 2 — Catalogue des mécanismes (pôle savoir)
   ============================================================================= */

function SectionCatalogueV2() {
  const [mecas, setMecas] = useState<MecanismeComplet[]>([])
  const [stats, setStats] = useState<Record<number, number>>({})
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [fiche, setFiche] = useState<MecanismeFiche | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get<MecanismeComplet[]>('/mecanismes').then(setMecas)
    api.get<MecanismeStat[]>('/mecanismes/stats').then(rows => {
      const map: Record<number, number> = {}
      rows.forEach(r => { map[r.id] = r.nb_sources })
      setStats(map)
    })
  }, [])

  const ouvrirFiche = (slug: string) => {
    setSelectedSlug(slug)
    setLoading(true)
    setFiche(null)
    api.get<MecanismeFiche>(`/mecanismes/fiche/${slug}`)
      .then(f => { setFiche(f); setLoading(false) })
      .catch(() => setLoading(false))
  }

  const fermerFiche = () => { setSelectedSlug(null); setFiche(null) }

  if (selectedSlug) {
    return (
      <div className="obs-meca-fiche">
        <button className="media-detail-back" onClick={fermerFiche}>
          ← Retour au catalogue
        </button>
        {loading && <p className="loading">Chargement...</p>}
        {fiche && (
          <>
            <div className="obs-meca-fiche-header">
              <h2>{fiche.nom}</h2>
              <span className="obs-prop-badge">{fiche.categorie_label}</span>
            </div>
            {fiche.definition_longue && (
              <p className="obs-meca-fiche-desc">{fiche.definition_longue}</p>
            )}
            {fiche.description && !fiche.definition_longue && (
              <p className="obs-meca-fiche-desc">{fiche.description}</p>
            )}
            {fiche.exemple && (
              <div className="obs-meca-exemple-generique">
                <strong>Exemple type :</strong> {fiche.exemple}
              </div>
            )}
            {fiche.questions_guidees && (
              <div className="obs-meca-questions">
                <strong>Questions pour identifier ce mécanisme :</strong>
                <p>{fiche.questions_guidees}</p>
              </div>
            )}

            {fiche.exemples.length > 0 ? (
              <section className="obs-meca-exemples">
                <h3>
                  {fiche.exemples.length} exemple{fiche.exemples.length > 1 ? 's' : ''} réel{fiche.exemples.length > 1 ? 's' : ''} dans notre veille
                </h3>
                <ul className="obs-meca-exemples-liste">
                  {fiche.exemples.map(ex => (
                    <li key={ex.id} className="obs-meca-exemple-item">
                      <div className="obs-meca-exemple-source">{ex.titre}</div>
                      {ex.media_nom && (
                        <div className="obs-meca-exemple-media">{ex.media_nom}</div>
                      )}
                      {ex.extrait && (
                        <blockquote className="obs-meca-exemple-extrait">
                          « {ex.extrait} »
                        </blockquote>
                      )}
                      {ex.justification && (
                        <p className="obs-meca-exemple-justif">{ex.justification}</p>
                      )}
                      {ex.identifie_par_nom && (
                        <div className="obs-meca-exemple-par">
                          Repéré par {ex.identifie_par_nom}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className="obs-empty">Aucune analyse de ce mécanisme dans la veille pour l'instant.</p>
            )}
          </>
        )}
      </div>
    )
  }

  // Regroupement par catégorie
  const parCategorie: Record<string, {
    label: string
    desc: string | null
    items: (MecanismeComplet & { nb_sources: number })[]
  }> = {}

  for (const m of mecas) {
    if (!parCategorie[m.categorie]) {
      parCategorie[m.categorie] = {
        label: m.categorie_label,
        desc: m.categorie_description ?? null,
        items: [],
      }
    }
    parCategorie[m.categorie].items.push({ ...m, nb_sources: stats[m.id] ?? 0 })
  }

  const totalIdentifications = Object.values(stats).reduce((s, n) => s + n, 0)

  return (
    <>
      <div className="obs-intro-bloc">
        <p>
          Référence des mécanismes médiatiques repérés dans notre veille.
          Chaque fiche décrit le mécanisme, donne des exemples types et liste les analyses
          réelles conduites par les membres. Ce catalogue est alimenté en continu par
          les analyses de sources dans la veille et les ateliers.
        </p>
      </div>

      <div className="stats-global">
        <div className="stat-box">
          <span className="stat-number">{mecas.length}</span>
          <span className="stat-label">mécanismes référencés</span>
        </div>
        <div className="stat-box">
          <span className="stat-number">{totalIdentifications}</span>
          <span className="stat-label">identifications dans la veille</span>
        </div>
        <div className="stat-box">
          <span className="stat-number">{Object.keys(parCategorie).length}</span>
          <span className="stat-label">catégories</span>
        </div>
      </div>

      {Object.entries(parCategorie).map(([cat, data]) => (
        <section key={cat} className="obs-section obs-meca-categorie-bloc">
          <div className="obs-meca-categorie-header">
            <h2>{data.label}</h2>
            <span className="obs-prop-badge">
              {data.items.length} mécanisme{data.items.length > 1 ? 's' : ''}
            </span>
          </div>
          {data.desc && (
            <p className="obs-meca-categorie-desc">{data.desc}</p>
          )}
          <div className="obs-meca-grid">
            {data.items
              .sort((a, b) => b.nb_sources - a.nb_sources)
              .map(m => (
                <button
                  key={m.id}
                  className="obs-meca-card"
                  onClick={() => ouvrirFiche(m.slug)}
                >
                  <span className="obs-meca-card-nom">{m.nom}</span>
                  {m.nb_sources > 0 && (
                    <span className="obs-meca-card-nb">
                      {m.nb_sources} analyse{m.nb_sources > 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              ))}
          </div>
        </section>
      ))}

      {mecas.length === 0 && (
        <p className="obs-empty">Aucun mécanisme référencé pour l'instant.</p>
      )}
    </>
  )
}

/* =============================================================================
   Section 3 — Mécanismes dans notre veille (timeline + matrice)
   ============================================================================= */

function SectionMecanismes({
  mecanismes,
  timeline,
  matrice,
}: {
  mecanismes: MecanismeStat[]
  timeline: TimelineRow[]
  matrice: MatriceRow[]
}) {
  const moisList = [...new Set(timeline.map(r => r.mois))].sort()
  const timelineData = moisList.map(mois => {
    const row: Record<string, string | number> = { mois }
    timeline.filter(r => r.mois === mois).forEach(r => { row[r.mecanisme_nom] = r.nb })
    return row
  })
  const mecaNomsList = [...new Set(timeline.map(r => r.mecanisme_nom))]

  const matriceMedias = [...new Set(matrice.map(r => r.media_nom))].sort()
  const matriceMecas = [...new Set(matrice.map(r => r.mecanisme_nom))].sort()
  const matriceMax = Math.max(...matrice.map(r => r.nb), 1)

  function getMatriceNb(mediaNom: string, mecaNom: string): number {
    return matrice.find(r => r.media_nom === mediaNom && r.mecanisme_nom === mecaNom)?.nb || 0
  }

  return (
    <>
      <div className="stats-global">
        <div className="stat-box">
          <span className="stat-number">{mecanismes.reduce((s, m) => s + m.nb_sources, 0)}</span>
          <span className="stat-label">identifications</span>
        </div>
        <div className="stat-box">
          <span className="stat-number">{mecanismes.filter(m => m.nb_sources > 0).length}</span>
          <span className="stat-label">mécanismes actifs</span>
        </div>
        <div className="stat-box">
          <span className="stat-number">{matriceMedias.length}</span>
          <span className="stat-label">médias analysés</span>
        </div>
      </div>

      <section className="obs-section">
        <h2>Identifications par mois</h2>
        <p className="obs-intro-mini">
          Nombre d'identifications de mécanismes par mois, empilé par type. Reflète l'activité d'analyse, pas la fréquence des mécanismes dans les médias.
        </p>
        {moisList.length === 0 ? (
          <p className="obs-empty">Pas encore assez de données pour afficher la timeline.</p>
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

      <section className="obs-section">
        <h2>Mécanismes par média</h2>
        <p className="obs-intro-mini">
          Croisement des sources analysées avec les mécanismes repérés. L'intensité indique le nombre d'identifications. Ce tableau décrit notre travail d'analyse, il ne classe pas les médias.
        </p>
        {matrice.length === 0 ? (
          <p className="obs-empty">Pas encore assez de données pour afficher le tableau.</p>
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
                            background: nb > 0
                              ? `rgba(217, 30, 46, ${0.15 + intensity * 0.7})`
                              : 'transparent',
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

/* =============================================================================
   Composant principal
   ============================================================================= */

export default function Observatoire() {
  const { section } = useParams<{ section?: string }>()
  const [mecanismes, setMecanismes] = useState<MecanismeStat[]>([])
  const [timeline, setTimeline] = useState<TimelineRow[]>([])
  const [matrice, setMatrice] = useState<MatriceRow[]>([])
  const [groupesPropriete, setGroupesPropriete] = useState<GroupePropriete[]>([])

  useEffect(() => {
    api.get<MecanismeStat[]>('/mecanismes/stats').then(setMecanismes)
    api.get<TimelineRow[]>('/mecanismes/timeline').then(setTimeline)
    api.get<MatriceRow[]>('/medias/matrice').then(setMatrice)
    api.get<GroupePropriete[]>('/medias/propriete-groupee').then(setGroupesPropriete)
  }, [])

  if (!section) return <Navigate to="/observatoire/propriete" replace />

  return (
    <div className="page-observatoire">

      {section === 'propriete' && (
        <SectionProprietaire groupes={groupesPropriete} />
      )}

      {section === 'couverture' && (
        <Couverture />
      )}

      {section === 'fiches' && (
        <FichesMedias />
      )}

      {section === 'catalogue' && (
        <SectionCatalogueV2 />
      )}

      {section === 'mecanismes' && (
        <SectionMecanismes
          mecanismes={mecanismes}
          timeline={timeline}
          matrice={matrice}
        />
      )}

    </div>
  )
}
