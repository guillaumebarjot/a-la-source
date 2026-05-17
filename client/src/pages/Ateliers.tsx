import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../store/useAuth'
import type { Source, Atelier, Tag } from '../types'

/* ---------- Types locaux ---------- */

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

type Etape = 'vivier' | 'selection' | 'preparation' | 'atelier'

const ETAPES: { id: Etape; label: string }[] = [
  { id: 'vivier', label: 'Vivier' },
  { id: 'selection', label: 'Selection' },
  { id: 'preparation', label: 'Preparation' },
  { id: 'atelier', label: 'Atelier' },
]

/* ---------- Composant ---------- */

export default function Ateliers() {
  const user = useAuth((s) => s.user)
  const isFacilitateur = user?.role === 'animateur' || user?.role === 'admin'

  // Stepper
  const [etape, setEtape] = useState<Etape>('vivier')

  // Data
  const [vivier, setVivier] = useState<VivierSource[]>([])
  const [atelierEnCours, setAtelierEnCours] = useState<AtelierEnCours | null>(null)
  const [selection, setSelection] = useState<VivierSource[]>([])
  const [loading, setLoading] = useState(true)

  // Filtres vivier
  const [filtreTag, setFiltreTag] = useState('')
  const [filtreType, setFiltreType] = useState('')
  const [filtreTiming, setFiltreTiming] = useState('')

  // Preparation notes (state local, pas persiste)
  const [prepNotes, setPrepNotes] = useState<PreparationNote[]>([])

  // Atelier infos
  const [atelierInfos, setAtelierInfos] = useState<AtelierInfos>({
    date: '',
    lieu: '',
    nbParticipants: '',
    compteRendu: '',
    observations: '',
  })

  /* ---------- Fetch ---------- */

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [vivierData, enCoursData] = await Promise.all([
        api.get<VivierSource[]>('/ateliers/vivier'),
        api.get<AtelierEnCours | null>('/ateliers/en-cours'),
      ])
      setVivier(vivierData)
      setAtelierEnCours(enCoursData)

      // Si atelier en cours, initialiser selection depuis ses sources
      if (enCoursData?.sources) {
        const sourcesIds = new Set(enCoursData.sources.map((s) => s.id))
        // On reconstruit la selection avec les infos du vivier si possible
        const selectionFromVivier = vivierData.filter((s) => sourcesIds.has(s.id))
        // Ajouter celles deja en atelier mais pas dans vivier
        const remaining = enCoursData.sources
          .filter((s) => !selectionFromVivier.find((v) => v.id === s.id))
          .map((s) => ({
            ...s,
            score: { pedagogie: 0, echo: 0, fraicheur: 0, scoreTotal: 0, timing: 'B', nbEvaluations: 0, details: {} },
            tags: [],
          }) as VivierSource)
        setSelection([...selectionFromVivier, ...remaining])
      }

      // Initialiser atelierInfos si atelier en cours
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

  const allTags = useMemo(() => {
    const map = new Map<string, Tag>()
    vivier.forEach((s) => s.tags.forEach((t) => map.set(t.nom, t)))
    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom))
  }, [vivier])

  const allTypes = useMemo(() => {
    const set = new Set<string>()
    vivier.forEach((s) => { if (s.type_source) set.add(s.type_source) })
    return Array.from(set).sort()
  }, [vivier])

  const vivierFiltre = useMemo(() => {
    return vivier.filter((s) => {
      // Exclure celles deja selectionnees
      if (selection.find((sel) => sel.id === s.id)) return false
      if (filtreTag && !s.tags.some((t) => t.nom === filtreTag)) return false
      if (filtreType && s.type_source !== filtreType) return false
      if (filtreTiming && s.score.timing !== filtreTiming) return false
      return true
    })
  }, [vivier, selection, filtreTag, filtreType, filtreTiming])

  /* ---------- Actions ---------- */

  const ajouterASelection = async (source: VivierSource) => {
    setSelection((prev) => [...prev, source])

    // Si un atelier en cours existe, persister cote serveur
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
    // Numero = dernier + 1
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
    setEtape('vivier')
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
    return selection.reduce((total, s) => {
      const note = getPrepNote(s.id)
      return total + note.duree
    }, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, prepNotes])

  /* ---------- Rendu ---------- */

  if (loading) return <div className="page-ateliers"><p>Chargement...</p></div>

  return (
    <div className="page-ateliers">
      {/* Stepper horizontal */}
      <nav className="stepper" aria-label="Etapes de l'atelier">
        {ETAPES.map((e, i) => (
          <button
            key={e.id}
            className={`stepper-step ${etape === e.id ? 'stepper-step--active' : ''}`}
            onClick={() => setEtape(e.id)}
            type="button"
          >
            <span className="stepper-num">{i + 1}</span>
            <span className="stepper-label">{e.label}</span>
          </button>
        ))}
      </nav>

      {/* Etape Vivier */}
      {etape === 'vivier' && (
        <section className="etape-vivier">
          <header className="etape-header">
            <h2>Vivier — Sources disponibles ({vivierFiltre.length})</h2>
            {isFacilitateur && !atelierEnCours && (
              <button className="btn btn-primary" onClick={creerAtelier} type="button">
                Nouvel atelier
              </button>
            )}
          </header>

          {/* Filtres */}
          <div className="vivier-filtres">
            <select value={filtreTiming} onChange={(e) => setFiltreTiming(e.target.value)}>
              <option value="">Timing (tous)</option>
              <option value="A">A (3-8 min)</option>
              <option value="B">B (8-15 min)</option>
              <option value="C">C (15-30 min)</option>
              <option value="D">D (30+ min)</option>
            </select>
            <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)}>
              <option value="">Type (tous)</option>
              {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filtreTag} onChange={(e) => setFiltreTag(e.target.value)}>
              <option value="">Tag (tous)</option>
              {allTags.map((t) => <option key={t.id} value={t.nom}>{t.nom}</option>)}
            </select>
          </div>

          {/* Liste */}
          <div className="vivier-list">
            {vivierFiltre.length === 0 && <p className="empty">Aucune source ne correspond aux filtres.</p>}
            {vivierFiltre.map((s) => (
              <div key={s.id} className="vivier-card">
                <div className="vivier-score">{s.score.scoreTotal}</div>
                <span className={`badge-timing badge-timing--${s.score.timing}`}>{s.score.timing}</span>
                <div className="vivier-info">
                  <Link to={`/lire/${s.id}`}><h3>{s.titre}</h3></Link>
                  <span>{s.media_nom || 'Source'} — {s.score.nbEvaluations} eval(s)</span>
                  {s.tags.length > 0 && (
                    <div className="vivier-tags">
                      {s.tags.map((t) => <span key={t.id} className="tag-chip">{t.nom}</span>)}
                    </div>
                  )}
                </div>
                {isFacilitateur && (
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => ajouterASelection(s)}
                    type="button"
                    title="Ajouter a l'atelier"
                  >
                    + Atelier
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Etape Selection */}
      {etape === 'selection' && (
        <section className="etape-selection">
          <header className="etape-header">
            <h2>Selection — Sources retenues ({selection.length})</h2>
          </header>

          {selection.length === 0 && (
            <p className="empty">Aucune source selectionnee. Retournez au Vivier pour en ajouter.</p>
          )}

          <div className="selection-list">
            {selection.map((s, index) => (
              <div key={s.id} className="selection-card">
                <div className="selection-ordre">
                  {isFacilitateur && (
                    <>
                      <button
                        className="btn-arrow"
                        onClick={() => monterSource(index)}
                        disabled={index === 0}
                        type="button"
                        aria-label="Monter"
                      >&#9650;</button>
                      <button
                        className="btn-arrow"
                        onClick={() => descendreSource(index)}
                        disabled={index === selection.length - 1}
                        type="button"
                        aria-label="Descendre"
                      >&#9660;</button>
                    </>
                  )}
                  <span className="selection-num">{index + 1}</span>
                </div>
                <div className="selection-info">
                  <Link to={`/lire/${s.id}`}><h3>{s.titre}</h3></Link>
                  <span>{s.media_nom || 'Source'} — Score {s.score.scoreTotal}/100 — Timing {s.score.timing}</span>
                </div>
                {isFacilitateur && (
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => retirerDeSelection(s.id)}
                    type="button"
                    title="Retirer de la selection"
                  >
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Etape Preparation */}
      {etape === 'preparation' && (
        <section className="etape-preparation">
          <header className="etape-header">
            <h2>Preparation</h2>
            <div className="prep-temps-total">
              Temps total estime : <strong>{tempsTotal} min</strong>
            </div>
          </header>

          {selection.length === 0 && (
            <p className="empty">Aucune source a preparer. Selectionnez d'abord des sources.</p>
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
                        <textarea
                          value={note.mecanismes}
                          onChange={(e) => updatePrepNote(s.id, 'mecanismes', e.target.value)}
                          placeholder="Quels mecanismes de manipulation / biais sont a l'oeuvre dans cette source ?"
                          rows={3}
                        />
                      </label>
                      <label>
                        <span>Questions guidees pour le debat</span>
                        <textarea
                          value={note.questions}
                          onChange={(e) => updatePrepNote(s.id, 'questions', e.target.value)}
                          placeholder="Questions a poser au groupe pour lancer la discussion..."
                          rows={3}
                        />
                      </label>
                      <label className="preparation-duree">
                        <span>Duree estimee (min)</span>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={note.duree}
                          onChange={(e) => updatePrepNote(s.id, 'duree', parseInt(e.target.value) || 0)}
                        />
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

      {/* Etape Atelier */}
      {etape === 'atelier' && (
        <section className="etape-atelier">
          <header className="etape-header">
            <h2>Atelier{atelierEnCours ? ` #${atelierEnCours.numero}` : ''}</h2>
          </header>

          {!atelierEnCours && (
            <p className="empty">Aucun atelier en preparation. Creez-en un depuis l'etape Vivier.</p>
          )}

          {atelierEnCours && (
            <div className="atelier-form">
              <div className="atelier-form-grid">
                <label>
                  <span>Date de l'atelier</span>
                  <input
                    type="date"
                    value={atelierInfos.date}
                    onChange={(e) => setAtelierInfos((p) => ({ ...p, date: e.target.value }))}
                    disabled={!isFacilitateur}
                  />
                </label>
                <label>
                  <span>Lieu</span>
                  <input
                    type="text"
                    value={atelierInfos.lieu}
                    onChange={(e) => setAtelierInfos((p) => ({ ...p, lieu: e.target.value }))}
                    placeholder="Ex: Salle des fetes, en ligne..."
                    disabled={!isFacilitateur}
                  />
                </label>
                <label>
                  <span>Nombre de participant·es</span>
                  <input
                    type="number"
                    min={1}
                    value={atelierInfos.nbParticipants}
                    onChange={(e) => setAtelierInfos((p) => ({ ...p, nbParticipants: e.target.value }))}
                    disabled={!isFacilitateur}
                  />
                </label>
              </div>

              <label className="atelier-field-large">
                <span>Compte-rendu</span>
                <textarea
                  value={atelierInfos.compteRendu}
                  onChange={(e) => setAtelierInfos((p) => ({ ...p, compteRendu: e.target.value }))}
                  placeholder="Resume du deroulement de l'atelier, points saillants..."
                  rows={5}
                  disabled={!isFacilitateur}
                />
              </label>

              <label className="atelier-field-large">
                <span>Observations</span>
                <textarea
                  value={atelierInfos.observations}
                  onChange={(e) => setAtelierInfos((p) => ({ ...p, observations: e.target.value }))}
                  placeholder="Observations sur la dynamique de groupe, surprises, difficultes..."
                  rows={4}
                  disabled={!isFacilitateur}
                />
              </label>

              {isFacilitateur && (
                <div className="atelier-actions">
                  <button className="btn btn-primary" onClick={sauvegarderAtelier} type="button">
                    Sauvegarder
                  </button>
                  <button className="btn btn-success" onClick={terminerAtelier} type="button">
                    Terminer l'atelier
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* CSS inline pour eviter fichier supplementaire */}
      <style>{`
        .stepper {
          display: flex;
          gap: var(--space-xs, 0.25rem);
          margin-bottom: var(--space-xl, 2rem);
          padding: var(--space-sm, 0.5rem) 0;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }
        .stepper-step {
          display: flex;
          align-items: center;
          gap: var(--space-xs, 0.25rem);
          padding: var(--space-sm, 0.5rem) var(--space-md, 1rem);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-sm, 4px);
          background: none;
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--color-text-secondary, #6b7280);
          transition: all 0.15s;
          flex: 1;
          justify-content: center;
        }
        .stepper-step:hover { background: var(--color-surface, #f9fafb); }
        .stepper-step--active {
          background: var(--color-primary, #2563eb);
          color: white;
          border-color: var(--color-primary, #2563eb);
        }
        .stepper-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          font-size: 0.75rem;
          font-weight: 700;
        }
        .stepper-step:not(.stepper-step--active) .stepper-num {
          background: var(--color-border, #e5e7eb);
          color: var(--color-text-secondary, #6b7280);
        }
        .stepper-label { font-weight: 500; }

        @media (max-width: 640px) {
          .stepper { flex-direction: column; }
          .stepper-step { justify-content: flex-start; }
        }

        .etape-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-md, 1rem);
          flex-wrap: wrap;
          gap: var(--space-sm, 0.5rem);
        }
        .etape-header h2 {
          font-family: var(--font-display, inherit);
          font-size: 1.25rem;
          margin: 0;
        }

        /* Filtres */
        .vivier-filtres {
          display: flex;
          gap: var(--space-sm, 0.5rem);
          margin-bottom: var(--space-md, 1rem);
          flex-wrap: wrap;
        }
        .vivier-filtres select {
          padding: var(--space-xs, 0.25rem) var(--space-sm, 0.5rem);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-sm, 4px);
          font-size: 0.8rem;
          background: var(--color-surface, #fff);
          color: var(--color-text, #111);
        }

        /* Vivier cards */
        .vivier-list { display: flex; flex-direction: column; gap: var(--space-sm, 0.5rem); }
        .vivier-card {
          display: flex;
          align-items: center;
          gap: var(--space-md, 1rem);
          padding: var(--space-md, 1rem);
          background: var(--color-surface, #fff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-md, 8px);
        }
        .vivier-card:hover { box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05)); }
        .vivier-score {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-primary, #2563eb);
          font-family: var(--font-display, inherit);
          min-width: 44px;
          text-align: center;
        }
        .vivier-info { flex: 1; min-width: 0; }
        .vivier-info h3 { font-size: 0.95rem; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .vivier-info span { font-size: 0.8rem; color: var(--color-text-secondary, #6b7280); }
        .vivier-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
        .tag-chip {
          font-size: 0.7rem;
          padding: 1px 6px;
          border-radius: 10px;
          background: var(--color-border, #e5e7eb);
          color: var(--color-text-secondary, #6b7280);
        }

        /* Badge timing */
        .badge-timing {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          font-size: 0.75rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        .badge-timing--A { background: #d1fae5; color: #065f46; }
        .badge-timing--B { background: #dbeafe; color: #1e40af; }
        .badge-timing--C { background: #fef3c7; color: #92400e; }
        .badge-timing--D { background: #fee2e2; color: #991b1b; }

        /* Selection */
        .selection-list { display: flex; flex-direction: column; gap: var(--space-sm, 0.5rem); }
        .selection-card {
          display: flex;
          align-items: center;
          gap: var(--space-md, 1rem);
          padding: var(--space-md, 1rem);
          background: var(--color-surface, #fff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-md, 8px);
        }
        .selection-ordre {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        .btn-arrow {
          background: none;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 3px;
          cursor: pointer;
          font-size: 0.65rem;
          padding: 2px 6px;
          color: var(--color-text-secondary, #6b7280);
        }
        .btn-arrow:disabled { opacity: 0.3; cursor: not-allowed; }
        .btn-arrow:hover:not(:disabled) { background: var(--color-border, #e5e7eb); }
        .selection-num {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--color-primary, #2563eb);
        }
        .selection-info { flex: 1; min-width: 0; }
        .selection-info h3 { font-size: 0.95rem; margin: 0; }
        .selection-info span { font-size: 0.8rem; color: var(--color-text-secondary, #6b7280); }

        /* Preparation */
        .prep-temps-total {
          font-size: 0.9rem;
          padding: var(--space-xs, 0.25rem) var(--space-sm, 0.5rem);
          background: var(--color-surface, #f9fafb);
          border-radius: var(--radius-sm, 4px);
          border: 1px solid var(--color-border, #e5e7eb);
        }
        .preparation-list { display: flex; flex-direction: column; gap: var(--space-md, 1rem); }
        .preparation-card {
          padding: var(--space-md, 1rem);
          background: var(--color-surface, #fff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-md, 8px);
        }
        .preparation-header {
          display: flex;
          align-items: center;
          gap: var(--space-sm, 0.5rem);
          margin-bottom: var(--space-sm, 0.5rem);
        }
        .preparation-header h3 { font-size: 0.95rem; margin: 0; }
        .preparation-num { font-weight: 700; color: var(--color-primary, #2563eb); }
        .preparation-fields {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm, 0.5rem);
        }
        .preparation-fields label { display: flex; flex-direction: column; gap: 4px; }
        .preparation-fields label span { font-size: 0.8rem; font-weight: 500; color: var(--color-text-secondary, #6b7280); }
        .preparation-fields textarea,
        .preparation-fields input {
          padding: var(--space-sm, 0.5rem);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-sm, 4px);
          font-size: 0.85rem;
          font-family: inherit;
          resize: vertical;
        }
        .preparation-duree { max-width: 180px; }
        .preparation-duree input { width: 80px; }
        .preparation-readonly { font-size: 0.85rem; color: var(--color-text-secondary, #6b7280); }
        .preparation-readonly p { margin: 4px 0; }

        /* Atelier form */
        .atelier-form { display: flex; flex-direction: column; gap: var(--space-md, 1rem); }
        .atelier-form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-md, 1rem);
        }
        .atelier-form-grid label,
        .atelier-field-large { display: flex; flex-direction: column; gap: 4px; }
        .atelier-form-grid label span,
        .atelier-field-large span { font-size: 0.8rem; font-weight: 500; color: var(--color-text-secondary, #6b7280); }
        .atelier-form-grid input,
        .atelier-field-large textarea {
          padding: var(--space-sm, 0.5rem);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-sm, 4px);
          font-size: 0.85rem;
          font-family: inherit;
        }
        .atelier-field-large textarea { resize: vertical; }
        .atelier-actions {
          display: flex;
          gap: var(--space-sm, 0.5rem);
          padding-top: var(--space-sm, 0.5rem);
        }

        /* Boutons generiques */
        .btn {
          padding: var(--space-sm, 0.5rem) var(--space-md, 1rem);
          border: none;
          border-radius: var(--radius-sm, 4px);
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 500;
          transition: opacity 0.15s;
        }
        .btn:hover { opacity: 0.85; }
        .btn-primary { background: var(--color-primary, #2563eb); color: white; }
        .btn-success { background: #059669; color: white; }
        .btn-danger { background: #dc2626; color: white; }
        .btn-outline { background: none; border: 1px solid var(--color-border, #e5e7eb); color: var(--color-text, #111); }
        .btn-outline:hover { background: var(--color-surface, #f9fafb); }
        .btn-sm { padding: 4px 10px; font-size: 0.75rem; }

        .empty {
          text-align: center;
          color: var(--color-text-secondary, #6b7280);
          padding: var(--space-xl, 2rem);
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  )
}
