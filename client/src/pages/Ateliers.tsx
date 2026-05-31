import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { Star, FileCheck, Pencil, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../store/useAuth'
import SourceCard from '../components/cards/SourceCard'
import type { Source, Atelier, AtelierDetail, Tag } from '../types'

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

interface AtelierBadge {
  atelier_id: number
  numero: number
  statut: string
}

interface QualityGate {
  ok: boolean
  hasEvaluation: boolean
  hasArchive: boolean
  hasAccroche: boolean
}

interface VivierSource extends Source {
  score: ScoreComplet
  tags: Tag[]
  atelier_badges: AtelierBadge[]
  quality_gate: QualityGate
}

/* ---------- Composant ---------- */

export default function Ateliers() {
  const { section } = useParams<{ section?: string }>()
  const user = useAuth((s) => s.user)
  const isFacilitateur = user?.role === 'animateur' || user?.role === 'admin'

  // Data
  const [vivier, setVivier] = useState<VivierSource[]>([])
  const [ateliersActifs, setAteliersActifs] = useState<AtelierDetail[]>([])
  const [ateliersTermines, setAteliersTermines] = useState<Atelier[]>([])
  const [loading, setLoading] = useState(true)

  // Filtres vivier
  const [scoreMin, setScoreMin] = useState(0)
  const [qualityOnly, setQualityOnly] = useState(false)

  // Atelier creation form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newHeure, setNewHeure] = useState('')
  const [newLieu, setNewLieu] = useState('')

  /* ---------- Fetch ---------- */

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [vivierData, enCoursData, historiqueData] = await Promise.all([
        api.get<VivierSource[]>('/ateliers/vivier'),
        api.get<AtelierDetail[]>('/ateliers/en-cours'),
        api.get<Atelier[]>('/ateliers'),
      ])
      setVivier(vivierData)
      setAteliersActifs(enCoursData)
      setAteliersTermines(historiqueData.filter(a => a.statut === 'termine'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /* ---------- Filtres vivier ---------- */

  const vivierFiltre = useMemo(() => {
    return vivier
      .filter((s) => {
        if (scoreMin > 0 && s.score.scoreTotal < scoreMin) return false
        if (qualityOnly && !s.quality_gate.ok) return false
        return true
      })
      .sort((a, b) => b.score.scoreTotal - a.score.scoreTotal)
  }, [vivier, scoreMin, qualityOnly])

  /* ---------- Actions ---------- */

  const creerAtelier = async () => {
    await api.post<{ id: number; numero: number }>('/ateliers', {
      date_atelier: newDate || null,
      heure: newHeure || null,
      lieu: newLieu || null,
    })
    setShowNewForm(false)
    setNewDate('')
    setNewHeure('')
    setNewLieu('')
    await fetchData()
  }

  const ajouterSource = async (atelierId: number, sourceId: number) => {
    await api.post(`/ateliers/${atelierId}/sources`, { source_id: sourceId })
    await fetchData()
  }

  const retirerSource = async (atelierId: number, sourceId: number) => {
    await api.delete(`/ateliers/${atelierId}/sources/${sourceId}`)
    await fetchData()
  }

  const sauvegarderAtelier = async (atelier: AtelierDetail, fields: Record<string, unknown>) => {
    await api.patch(`/ateliers/${atelier.id}`, fields)
    await fetchData()
  }

  const terminerAtelier = async (atelierId: number) => {
    await api.patch(`/ateliers/${atelierId}`, { statut: 'termine' })
    await fetchData()
  }

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
          </header>

          <p className="section-intro">
            Sources evaluees et archivees, pretes pour les ateliers.
            {!qualityOnly && ' Activez le filtre "pret" pour ne voir que les sources qui passent la quality gate.'}
          </p>

          <div className="vivier-controles">
            <label className="vivier-score-filter">
              Score min : <strong>{scoreMin}</strong>/100
              <input
                type="range" min={0} max={100} step={5}
                value={scoreMin}
                onChange={(e) => setScoreMin(Number(e.target.value))}
              />
            </label>
            <label className="vivier-quality-filter">
              <input
                type="checkbox"
                checked={qualityOnly}
                onChange={(e) => setQualityOnly(e.target.checked)}
              />
              Pret pour atelier uniquement
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
                atelierBadges={s.atelier_badges}
                action={isFacilitateur && ateliersActifs.length > 0 ? (
                  <div className="vivier-actions-multi">
                    {!s.quality_gate.ok && (
                      <QualityGateIndicator gate={s.quality_gate} />
                    )}
                    {s.quality_gate.ok && ateliersActifs.map(a => {
                      const alreadyIn = a.sources.some(src => src.id === s.id)
                      return alreadyIn ? (
                        <span key={a.id} className="badge-atelier badge-atelier--retenue">
                          #{a.numero}
                        </span>
                      ) : (
                        <button
                          key={a.id}
                          className="btn btn-sm btn-primary"
                          onClick={() => ajouterSource(a.id, s.id)}
                          type="button"
                          title={`Ajouter a l'atelier #${a.numero}`}
                        >
                          + #{a.numero}
                        </button>
                      )
                    })}
                  </div>
                ) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* ===== PREPARATION ===== */}
      {section === 'preparation' && (
        <section className="atelier-section">
          <header className="atelier-section-header">
            <h2>Ateliers en preparation ({ateliersActifs.length})</h2>
            {isFacilitateur && (
              <button className="btn btn-primary" onClick={() => setShowNewForm(true)} type="button">
                Nouvel atelier
              </button>
            )}
          </header>

          {showNewForm && (
            <div className="atelier-new-form">
              <h3>Creer un atelier</h3>
              <div className="atelier-form-grid">
                <label>
                  <span>Date</span>
                  <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </label>
                <label>
                  <span>Heure</span>
                  <input type="time" value={newHeure} onChange={(e) => setNewHeure(e.target.value)} />
                </label>
                <label>
                  <span>Lieu</span>
                  <input type="text" value={newLieu} onChange={(e) => setNewLieu(e.target.value)} placeholder="Salle, en ligne..." />
                </label>
              </div>
              <div className="atelier-new-actions">
                <button className="btn btn-primary" onClick={creerAtelier} type="button">Creer</button>
                <button className="btn" onClick={() => setShowNewForm(false)} type="button">Annuler</button>
              </div>
            </div>
          )}

          {ateliersActifs.length === 0 && !showNewForm && (
            <p className="empty">Aucun atelier en preparation. Creez-en un pour commencer.</p>
          )}

          <div className="preparation-ateliers-list">
            {ateliersActifs.map(a => (
              <AtelierPreparationCard
                key={a.id}
                atelier={a}
                isFacilitateur={isFacilitateur}
                onRetirer={(sourceId) => retirerSource(a.id, sourceId)}
                onSave={(fields) => sauvegarderAtelier(a, fields)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ===== EN COURS ===== */}
      {section === 'en-cours' && (
        <section className="atelier-section">
          <h2>Atelier en cours</h2>

          {ateliersActifs.length === 0 && (
            <p className="empty">Aucun atelier en cours. <Link to="/ateliers/preparation">Preparez-en un d'abord.</Link></p>
          )}

          {ateliersActifs.map(a => (
            <AtelierEnCoursCard
              key={a.id}
              atelier={a}
              isFacilitateur={isFacilitateur}
              onSave={(fields) => sauvegarderAtelier(a, fields)}
              onTerminer={() => terminerAtelier(a.id)}
            />
          ))}
        </section>
      )}

      {/* ===== ARCHIVES ===== */}
      {section === 'archives' && (
        <section className="atelier-section">
          <h2>Ateliers termines ({ateliersTermines.length})</h2>

          {ateliersTermines.length === 0 && (
            <p className="empty">Aucun atelier termine pour l'instant.</p>
          )}

          <div className="historique-list">
            {ateliersTermines.map((a) => (
              <AtelierArchiveCard key={a.id} atelier={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/* ---------- Sous-composants ---------- */

function QualityGateIndicator({ gate }: { gate: QualityGate }) {
  return (
    <div className="quality-gate-indicator">
      <span className={gate.hasEvaluation ? 'qg-ok' : 'qg-missing'} title="Evaluation"><Star size={14} /></span>
      <span className={gate.hasArchive ? 'qg-ok' : 'qg-missing'} title="Archive locale"><FileCheck size={14} /></span>
      <span className={gate.hasAccroche ? 'qg-ok' : 'qg-missing'} title="Accroche redigee"><Pencil size={14} /></span>
    </div>
  )
}

interface QualityGate {
  ok: boolean
  hasEvaluation: boolean
  hasArchive: boolean
  hasAccroche: boolean
}

function AtelierPreparationCard({ atelier, isFacilitateur, onRetirer, onSave }: {
  atelier: AtelierDetail
  isFacilitateur: boolean
  onRetirer: (sourceId: number) => void
  onSave: (fields: Record<string, unknown>) => void
}) {
  const [date, setDate] = useState(atelier.date_atelier || '')
  const [heure, setHeure] = useState(atelier.heure || '')
  const [lieu, setLieu] = useState(atelier.lieu || '')

  return (
    <div className="preparation-atelier-card">
      <div className="preparation-atelier-header">
        <h3>Atelier #{atelier.numero}</h3>
        <span className="badge-statut">{atelier.statut}</span>
      </div>

      {isFacilitateur && (
        <div className="atelier-form-grid">
          <label>
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <span>Heure</span>
            <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
          </label>
          <label>
            <span>Lieu</span>
            <input type="text" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Salle, en ligne..." />
          </label>
        </div>
      )}

      <div className="preparation-sources">
        <h4>{atelier.sources.length} source{atelier.sources.length > 1 ? 's' : ''} selectionnee{atelier.sources.length > 1 ? 's' : ''}</h4>
        {atelier.sources.map((s, i) => (
          <div key={s.id} className="selection-card">
            <div className="selection-info">
              <span className="selection-num">{i + 1}.</span>
              <Link to={`/lire/${s.id}`}>{s.titre}</Link>
              <span className="selection-media">{s.media_nom || ''}</span>
            </div>
            {isFacilitateur && (
              <button className="btn btn-sm btn-danger" onClick={() => onRetirer(s.id)} type="button">
                Retirer
              </button>
            )}
          </div>
        ))}
        {atelier.sources.length === 0 && (
          <p className="empty">Aucune source. Ajoutez-en depuis le <Link to="/ateliers/vivier">Vivier</Link>.</p>
        )}
      </div>

      {isFacilitateur && (
        <div className="preparation-atelier-actions">
          <button className="btn btn-primary" onClick={() => onSave({
            date_atelier: date || null,
            heure: heure || null,
            lieu: lieu || null,
          })} type="button">
            Sauvegarder
          </button>
          <a href={`/api/ateliers/${atelier.id}/print`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            Version imprimable
          </a>
        </div>
      )}
    </div>
  )
}

function AtelierEnCoursCard({ atelier, isFacilitateur, onSave, onTerminer }: {
  atelier: AtelierDetail
  isFacilitateur: boolean
  onSave: (fields: Record<string, unknown>) => void
  onTerminer: () => void
}) {
  const [nbParticipants, setNbParticipants] = useState(atelier.nb_participants?.toString() || '')
  const [compteRendu, setCompteRendu] = useState(atelier.compte_rendu || '')
  const [observations, setObservations] = useState(atelier.observations || '')

  return (
    <div className="atelier-en-cours-card">
      <div className="atelier-en-cours-header">
        <h3>Atelier #{atelier.numero}</h3>
        <div className="atelier-en-cours-meta">
          {atelier.date_atelier && <span>{new Date(atelier.date_atelier).toLocaleDateString('fr-FR')}</span>}
          {atelier.heure && <span>{atelier.heure}</span>}
          {atelier.lieu && <span>{atelier.lieu}</span>}
        </div>
      </div>

      {atelier.sources.length > 0 && (
        <div className="atelier-sources-resume">
          <h4>Sources ({atelier.sources.length})</h4>
          {atelier.sources.map((s, i) => (
            <div key={s.id} className="atelier-source-mini">
              <span>{i + 1}.</span>
              <Link to={`/lire/${s.id}`}>{s.titre}</Link>
            </div>
          ))}
          <div className="atelier-actions-inline">
            <Link to={`/projection/${atelier.id}`} className="btn btn-primary">
              Lancer la projection
            </Link>
            <a href={`/api/ateliers/${atelier.id}/print`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              Version imprimable
            </a>
          </div>
        </div>
      )}

      {isFacilitateur && (
        <>
          <div className="atelier-form-grid">
            <label>
              <span>Participant·es</span>
              <input type="number" min={1} value={nbParticipants} onChange={(e) => setNbParticipants(e.target.value)} />
            </label>
          </div>

          <label className="atelier-field-large">
            <span>Compte-rendu</span>
            <textarea value={compteRendu} onChange={(e) => setCompteRendu(e.target.value)} placeholder="Resume du deroulement..." rows={5} />
          </label>

          <label className="atelier-field-large">
            <span>Observations</span>
            <textarea value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Dynamique de groupe, surprises..." rows={4} />
          </label>

          <div className="atelier-actions">
            <button className="btn btn-primary" onClick={() => onSave({
              nb_participants: nbParticipants ? parseInt(nbParticipants) : null,
              compte_rendu: compteRendu || null,
              observations: observations || null,
            })} type="button">
              Sauvegarder
            </button>
            <button className="btn btn-success" onClick={onTerminer} type="button">
              Terminer l'atelier
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function AtelierArchiveCard({ atelier }: { atelier: Atelier }) {
  const [detail, setDetail] = useState<AtelierDetail | null>(null)
  const [expanded, setExpanded] = useState(false)

  const loadDetail = async () => {
    if (!detail) {
      const d = await api.get<AtelierDetail>(`/ateliers/${atelier.id}`)
      setDetail(d)
    }
    setExpanded(!expanded)
  }

  return (
    <div className="historique-card">
      <div className="historique-header" onClick={loadDetail} style={{ cursor: 'pointer' }}>
        <h3>Atelier #{atelier.numero}</h3>
        <span className="historique-date">{atelier.date_atelier || 'Date non renseignee'}</span>
        <span className="historique-expand">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
      </div>
      <div className="historique-meta">
        {atelier.lieu && <span>Lieu : {atelier.lieu}</span>}
        {atelier.nb_participants && <span>{atelier.nb_participants} participant·es</span>}
        <a href={`/api/ateliers/${atelier.id}/print`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">PDF</a>
      </div>
      {!expanded && atelier.compte_rendu && (
        <p className="historique-cr">{atelier.compte_rendu.substring(0, 200)}{atelier.compte_rendu.length > 200 ? '...' : ''}</p>
      )}

      {expanded && detail && (
        <div className="historique-detail">
          {detail.sources.length > 0 && (
            <div className="historique-sources">
              <h4>Sources</h4>
              {detail.sources.map((s, i) => (
                <div key={s.id} className="atelier-source-mini">
                  <span>{i + 1}.</span>
                  <Link to={`/lire/${s.id}`}>{s.titre}</Link>
                </div>
              ))}
            </div>
          )}
          {detail.mecanismes_identifies && detail.mecanismes_identifies.length > 0 && (
            <div className="historique-mecanismes">
              <h4>Mecanismes identifies par le groupe</h4>
              <div className="mecanismes-tags">
                {detail.mecanismes_identifies.map(m => (
                  <span key={m.mecanisme_id} className="badge-mecanisme">{m.mecanisme_nom}</span>
                ))}
              </div>
            </div>
          )}
          {detail.compte_rendu && (
            <div className="historique-section">
              <h4>Compte-rendu</h4>
              <p>{detail.compte_rendu}</p>
            </div>
          )}
          {detail.observations && (
            <div className="historique-section">
              <h4>Observations</h4>
              <p>{detail.observations}</p>
            </div>
          )}
          {detail.observations_surprise && (
            <div className="historique-section">
              <h4>Ce qui a surpris</h4>
              <p>{detail.observations_surprise}</p>
            </div>
          )}
          {detail.questions_restantes && (
            <div className="historique-section">
              <h4>Questions restantes</h4>
              <p>{detail.questions_restantes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
