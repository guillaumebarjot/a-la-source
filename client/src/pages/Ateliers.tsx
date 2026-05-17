import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../store/useAuth'
import SourceCard from '../components/cards/SourceCard'
import type { Source, Atelier, Tag } from '../types'

/* ---------- Types ---------- */

interface ScoreComplet {
  pedagogie: number
  echo: number
  fraicheur: number
  scoreTotal: number
  timing: string
  nbEvaluations: number
  details: Record<string, number>
}

interface VivierSource extends Source {
  score: ScoreComplet
  tags: Tag[]
}

interface AtelierEnCours extends Atelier {
  sources: Source[]
}

interface PreparationNote {
  sourceId: number
  mecanismes: string
  questions: string
  duree: number
}

interface AtelierInfos {
  date: string
  lieu: string
  nbParticipants: string
  compteRendu: string
  observations: string
}


/* ---------- Composant ---------- */

export default function Ateliers() {
  const { section } = useParams<{ section?: string }>()
  const user = useAuth((s) => s.user)
  const isFacilitateur = user?.role === 'animateur' || user?.role === 'admin'

  // Data
  const [vivier, setVivier] = useState<VivierSource[]>([])
  const [atelierEnCours, setAtelierEnCours] = useState<AtelierEnCours | null>(null)
  const [ateliersPasses, setAteliersPasses] = useState<Atelier[]>([])
  const [selection, setSelection] = useState<VivierSource[]>([])
  const [loading, setLoading] = useState(true)

  // Filtres vivier
  const [scoreMin, setScoreMin] = useState(0)

  // Preparation notes
  const [prepNotes, setPrepNotes] = useState<PreparationNote[]>([])

  // Atelier infos
  const [atelierInfos, setAtelierInfos] = useState<AtelierInfos>({
    date: '', lieu: '', nbParticipants: '', compteRendu: '', observations: '',
  })

  /* ---------- Fetch ---------- */

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [vivierData, enCoursData, historiqueData] = await Promise.all([
        api.get<VivierSource[]>('/ateliers/vivier'),
        api.get<AtelierEnCours | null>('/ateliers/en-cours'),
        api.get<Atelier[]>('/ateliers'),
      ])
      setVivier(vivierData)
      setAtelierEnCours(enCoursData)
      setAteliersPasses(historiqueData.filter(a => a.statut === 'termine'))

      if (enCoursData?.sources) {
        const sourcesIds = new Set(enCoursData.sources.map((s) => s.id))
        const selectionFromVivier = vivierData.filter((s) => sourcesIds.has(s.id))
        const remaining = enCoursData.sources
          .filter((s) => !selectionFromVivier.find((v) => v.id === s.id))
          .map((s) => ({
            ...s,
            score: { pedagogie: 0, echo: 0, fraicheur: 0, scoreTotal: 0, timing: 'B', nbEvaluations: 0, details: {} },
            tags: [],
          }) as VivierSource)
        setSelection([...selectionFromVivier, ...remaining])
      }

      if (enCoursData) {
        setAtelierInfos({
          date: enCoursData.date_atelier || '',
          lieu: enCoursData.lieu || '',
          nbParticipants: enCoursData.nb_participants?.toString() || '',
          compteRendu: enCoursData.compte_rendu || '',
          observations: enCoursData.observations || '',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /* ---------- Filtres ---------- */

  const vivierFiltre = useMemo(() => {
    return vivier
      .filter((s) => {
        if (selection.find((sel) => sel.id === s.id)) return false
        if (scoreMin > 0 && s.score.scoreTotal < scoreMin) return false
        return true
      })
      .sort((a, b) => {
        // Tri par date de soumission, plus recent en premier
        const dateA = a.soumis_le || ''
        const dateB = b.soumis_le || ''
        return dateB.localeCompare(dateA)
      })
  }, [vivier, selection, scoreMin])

  /* ---------- Actions ---------- */

  const ajouterASelection = async (source: VivierSource) => {
    setSelection((prev) => [...prev, source])
    if (atelierEnCours) {
      await api.post(`/ateliers/${atelierEnCours.id}/sources`, { source_id: source.id })
    }
  }

  const retirerDeSelection = async (sourceId: number) => {
    setSelection((prev) => prev.filter((s) => s.id !== sourceId))
    if (atelierEnCours) {
      await api.delete(`/ateliers/${atelierEnCours.id}/sources/${sourceId}`)
    }
  }

  const monterSource = (index: number) => {
    if (index === 0) return
    setSelection((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  const descendreSource = (index: number) => {
    setSelection((prev) => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  const creerAtelier = async () => {
    const ateliers = await api.get<Atelier[]>('/ateliers')
    const maxNum = ateliers.reduce((m, a) => Math.max(m, a.numero), 0)
    const res = await api.post<{ id: number }>('/ateliers', { numero: maxNum + 1 })
    const newAtelier = await api.get<AtelierEnCours>(`/ateliers/${res.id}`)
    setAtelierEnCours(newAtelier)
  }

  const sauvegarderAtelier = async () => {
    if (!atelierEnCours) return
    await api.patch(`/ateliers/${atelierEnCours.id}`, {
      date_atelier: atelierInfos.date || null,
      lieu: atelierInfos.lieu || null,
      nb_participants: atelierInfos.nbParticipants ? parseInt(atelierInfos.nbParticipants) : null,
      compte_rendu: atelierInfos.compteRendu || null,
      observations: atelierInfos.observations || null,
    })
  }

  const terminerAtelier = async () => {
    if (!atelierEnCours) return
    await api.patch(`/ateliers/${atelierEnCours.id}`, { statut: 'termine' })
    await fetchData()
  }

  /* ---------- Preparation helpers ---------- */

  const getPrepNote = (sourceId: number): PreparationNote => {
    return prepNotes.find((n) => n.sourceId === sourceId) || { sourceId, mecanismes: '', questions: '', duree: 10 }
  }

  const updatePrepNote = (sourceId: number, field: keyof Omit<PreparationNote, 'sourceId'>, value: string | number) => {
    setPrepNotes((prev) => {
      const existing = prev.find((n) => n.sourceId === sourceId)
      if (existing) {
        return prev.map((n) => n.sourceId === sourceId ? { ...n, [field]: value } : n)
      }
      return [...prev, { sourceId, mecanismes: '', questions: '', duree: 10, [field]: value }]
    })
  }

  const tempsTotal = useMemo(() => {
    return selection.reduce((total, s) => total + getPrepNote(s.id).duree, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, prepNotes])

  /* ---------- Redirect par defaut ---------- */

  if (!section) return <Navigate to="/ateliers/vivier" replace />

  if (loading) return (
    <div className="page-ateliers">
      <p className="loading">Chargement...</p>
    </div>
  )

  /* ---------- Rendu ---------- */

  return (
    <div className="page-ateliers">

      {/* ===== VIVIER ===== */}
      {section === 'vivier' && (
        <section className="atelier-section">
          <header className="atelier-section-header">
            <h2>Vivier ({vivierFiltre.length} sources)</h2>
            {isFacilitateur && !atelierEnCours && (
              <button className="btn btn-primary" onClick={creerAtelier} type="button">
                Nouvel atelier
              </button>
            )}
          </header>

          <p className="section-intro">Sources du vivier, triees par date (plus recentes en premier). Fraicheur toujours visible.</p>

          <div className="vivier-controles">
            <label className="vivier-score-filter">
              Score min : <strong>{scoreMin}</strong>/100
              <input
                type="range" min={0} max={100} step={5}
                value={scoreMin}
                onChange={(e) => setScoreMin(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="source-grid">
            {vivierFiltre.length === 0 && <p className="empty">Aucune source dans le vivier.</p>}
            {vivierFiltre.map((s) => (
              <SourceCard
                key={s.id}
                source={s}
                score={{
                  scoreTotal: s.score.scoreTotal,
                  timing: s.score.timing,
                  fraicheur: s.score.fraicheur,
                  nbEvaluations: s.score.nbEvaluations,
                }}
                showFraicheur={true}
                action={isFacilitateur ? (
                  <button className="btn btn-sm btn-primary" onClick={() => ajouterASelection(s)} type="button">
                    + Atelier
                  </button>
                ) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* ===== SELECTION ===== */}
      {section === 'selection' && (
        <section className="atelier-section">
          <h1>Selection ({selection.length} source{selection.length > 1 ? 's' : ''})</h1>

          {selection.length === 0 && (
            <p className="empty">Aucune source selectionnee. Allez dans le <Link to="/ateliers/vivier">Vivier</Link> pour en ajouter.</p>
          )}

          <div className="selection-list">
            {selection.map((s, index) => (
              <div key={s.id} className="selection-card">
                <div className="selection-ordre">
                  {isFacilitateur && (
                    <>
                      <button className="btn-arrow" onClick={() => monterSource(index)} disabled={index === 0} type="button">&#9650;</button>
                      <button className="btn-arrow" onClick={() => descendreSource(index)} disabled={index === selection.length - 1} type="button">&#9660;</button>
                    </>
                  )}
                  <span className="selection-num">{index + 1}</span>
                </div>
                <div className="selection-info">
                  <Link to={`/lire/${s.id}`}><h3>{s.titre}</h3></Link>
                  <span>{s.media_nom || 'Source'} — Score {s.score.scoreTotal}/100 — Timing {s.score.timing}</span>
                </div>
                {isFacilitateur && (
                  <button className="btn btn-sm" style={{ background: '#dc2626', color: 'white' }} onClick={() => retirerDeSelection(s.id)} type="button">
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== PREPARATION ===== */}
      {section === 'preparation' && (
        <section className="atelier-section">
          <header className="atelier-section-header">
            <h1>Preparation</h1>
            <div className="prep-temps-total">Temps total : <strong>{tempsTotal} min</strong></div>
          </header>

          {selection.length === 0 && (
            <p className="empty">Rien a preparer. <Link to="/ateliers/selection">Selectionnez des sources</Link> d'abord.</p>
          )}

          <div className="preparation-list">
            {selection.map((s, index) => {
              const note = getPrepNote(s.id)
              return (
                <div key={s.id} className="preparation-card">
                  <div className="preparation-header">
                    <span className="preparation-num">{index + 1}.</span>
                    <Link to={`/lire/${s.id}`}><h3>{s.titre}</h3></Link>
                    <span className={`badge-timing badge-timing--${s.score.timing}`}>{s.score.timing}</span>
                  </div>
                  {isFacilitateur ? (
                    <div className="preparation-fields">
                      <label>
                        <span>Mecanismes identifies</span>
                        <textarea value={note.mecanismes} onChange={(e) => updatePrepNote(s.id, 'mecanismes', e.target.value)} placeholder="Quels mecanismes sont a l'oeuvre ?" rows={3} />
                      </label>
                      <label>
                        <span>Questions guidees</span>
                        <textarea value={note.questions} onChange={(e) => updatePrepNote(s.id, 'questions', e.target.value)} placeholder="Questions pour lancer la discussion..." rows={3} />
                      </label>
                      <label className="preparation-duree">
                        <span>Duree (min)</span>
                        <input type="number" min={1} max={120} value={note.duree} onChange={(e) => updatePrepNote(s.id, 'duree', parseInt(e.target.value) || 0)} />
                      </label>
                    </div>
                  ) : (
                    <div className="preparation-readonly">
                      {note.mecanismes && <p><strong>Mecanismes :</strong> {note.mecanismes}</p>}
                      {note.questions && <p><strong>Questions :</strong> {note.questions}</p>}
                      <p><strong>Duree :</strong> {note.duree} min</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ===== ATELIER EN COURS ===== */}
      {section === 'en-cours' && (
        <section className="atelier-section">
          <h1>Atelier{atelierEnCours ? ` #${atelierEnCours.numero}` : ''}</h1>

          {!atelierEnCours && (
            <p className="empty">Aucun atelier en cours. <Link to="/ateliers/vivier">Creez-en un depuis le Vivier.</Link></p>
          )}

          {atelierEnCours && (
            <div className="atelier-form">
              <div className="atelier-form-grid">
                <label>
                  <span>Date</span>
                  <input type="date" value={atelierInfos.date} onChange={(e) => setAtelierInfos((p) => ({ ...p, date: e.target.value }))} disabled={!isFacilitateur} />
                </label>
                <label>
                  <span>Lieu</span>
                  <input type="text" value={atelierInfos.lieu} onChange={(e) => setAtelierInfos((p) => ({ ...p, lieu: e.target.value }))} placeholder="Salle, en ligne..." disabled={!isFacilitateur} />
                </label>
                <label>
                  <span>Participant·es</span>
                  <input type="number" min={1} value={atelierInfos.nbParticipants} onChange={(e) => setAtelierInfos((p) => ({ ...p, nbParticipants: e.target.value }))} disabled={!isFacilitateur} />
                </label>
              </div>

              {selection.length > 0 && (
                <div className="atelier-sources-resume">
                  <h3>Sources selectionnees</h3>
                  {selection.map((s, i) => (
                    <div key={s.id} className="atelier-source-mini">
                      <span>{i + 1}.</span>
                      <Link to={`/lire/${s.id}`}>{s.titre}</Link>
                    </div>
                  ))}
                  <div className="atelier-actions-inline">
                    <Link to="/projection" className="btn btn-primary">
                      Lancer la projection
                    </Link>
                    <a href={`/api/ateliers/${atelierEnCours!.id}/print`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                      Version imprimable (PDF)
                    </a>
                  </div>
                </div>
              )}

              <label className="atelier-field-large">
                <span>Compte-rendu</span>
                <textarea value={atelierInfos.compteRendu} onChange={(e) => setAtelierInfos((p) => ({ ...p, compteRendu: e.target.value }))} placeholder="Resume du deroulement..." rows={5} disabled={!isFacilitateur} />
              </label>

              <label className="atelier-field-large">
                <span>Observations</span>
                <textarea value={atelierInfos.observations} onChange={(e) => setAtelierInfos((p) => ({ ...p, observations: e.target.value }))} placeholder="Dynamique de groupe, surprises..." rows={4} disabled={!isFacilitateur} />
              </label>

              {isFacilitateur && (
                <div className="atelier-actions">
                  <button className="btn btn-primary" onClick={sauvegarderAtelier} type="button">Sauvegarder</button>
                  <button className="btn" style={{ background: '#059669', color: 'white' }} onClick={terminerAtelier} type="button">Terminer l'atelier</button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ===== HISTORIQUE ===== */}
      {section === 'historique' && (
        <section className="atelier-section">
          <h1>Ateliers passes ({ateliersPasses.length})</h1>

          {ateliersPasses.length === 0 && (
            <p className="empty">Aucun atelier termine pour l'instant.</p>
          )}

          <div className="historique-list">
            {ateliersPasses.map((a) => (
              <div key={a.id} className="historique-card">
                <div className="historique-header">
                  <h3>Atelier #{a.numero}</h3>
                  <span className="historique-date">{a.date_atelier || 'Date non renseignee'}</span>
                </div>
                <div className="historique-meta">
                  {a.lieu && <span>Lieu : {a.lieu}</span>}
                  {a.nb_participants && <span>{a.nb_participants} participant·es</span>}
                  <a href={`/api/ateliers/${a.id}/print`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">PDF</a>
                </div>
                {a.compte_rendu && (
                  <p className="historique-cr">{a.compte_rendu.substring(0, 200)}{a.compte_rendu.length > 200 ? '...' : ''}</p>
                )}
                {a.observations && (
                  <p className="historique-obs"><em>{a.observations.substring(0, 150)}{a.observations.length > 150 ? '...' : ''}</em></p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
