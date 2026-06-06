import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { Star, FileCheck, Pencil, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../api/client'
import { useAuth } from '../store/useAuth'
import SourceCard from '../components/cards/SourceCard'
import type { Source, Atelier, AtelierDetail, Tag } from '../types'
import '../styles/ateliers-prep.css'

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

  // Atelier actuellement en preparation (s'il y en a plusieurs, on choisit lequel).
  const [prepAtelierId, setPrepAtelierId] = useState<number | null>(null)

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

  // Garde une selection d'atelier en preparation valide : si l'atelier choisi
  // disparait (ou aucun choisi), on retombe sur le premier atelier actif.
  useEffect(() => {
    if (ateliersActifs.length === 0) {
      if (prepAtelierId !== null) setPrepAtelierId(null)
      return
    }
    const stillThere = ateliersActifs.some(a => a.id === prepAtelierId)
    if (!stillThere) setPrepAtelierId(ateliersActifs[0].id)
  }, [ateliersActifs, prepAtelierId])

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
            <h2>Preparation d'atelier</h2>
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

          {ateliersActifs.length > 0 && (
            <PreparationBoard
              ateliers={ateliersActifs}
              vivier={vivierFiltre}
              prepAtelierId={prepAtelierId}
              isFacilitateur={isFacilitateur}
              scoreMin={scoreMin}
              qualityOnly={qualityOnly}
              onChangeAtelier={setPrepAtelierId}
              onChangeScoreMin={setScoreMin}
              onChangeQualityOnly={setQualityOnly}
              onAjouter={ajouterSource}
              onRetirer={retirerSource}
              onSave={sauvegarderAtelier}
            />
          )}
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

/* ===========================================================================
 * PREPARATION : tableau 2 colonnes en glisser-deposer (dnd-kit).
 *
 *  - Colonne GAUCHE = VIVIER : cartes-sources candidates (score visible),
 *    draggables. Contexte ANIMATEUR (curation), le score est volontairement
 *    montre ici (a ne pas confondre avec la projection, carte nue).
 *  - Colonne DROITE = CORPUS de l'atelier choisi : sources retenues,
 *    reordonnables par glisser (sortable) et retirables.
 *
 * Glisser une carte du vivier sur le corpus -> POST /ateliers/:id/sources puis
 * refresh (via onAjouter). Reordonner dans le corpus reste local (aucune API
 * d'ordre cote serveur). Fallback boutons « + Retenir » / « Retirer » pour
 * l'accessibilite. La carte du vivier est neutralisee si deja dans le corpus.
 * =========================================================================== */

const ZONE_CORPUS = 'zone-corpus'

/** Forme minimale partagee par les cartes vivier et corpus pour le visuel. */
type CarteMin = { titre: string; image_url: string | null; media_nom?: string | null }

function PrepVisuel({ source }: { source: CarteMin }) {
  return source.image_url
    ? <img src={source.image_url} alt="" loading="lazy" />
    : <span className="prep-carte-initiale">{(source.media_nom || source.titre).charAt(0)}</span>
}

/** Carte candidate du vivier : draggable + bouton « + Retenir » (fallback). */
function PrepCarteVivier({ source, dejaRetenue, enDrag, onAjouter }: {
  source: VivierSource
  dejaRetenue: boolean
  enDrag: boolean
  onAjouter: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `vivier-${source.id}`,
    data: { source },
    disabled: dejaRetenue,
  })

  return (
    <div
      ref={setNodeRef}
      className={`prep-carte prep-carte--vivier${enDrag ? ' prep-carte--dragging' : ''}`}
      style={dejaRetenue ? { opacity: 0.5 } : undefined}
      {...(dejaRetenue ? {} : attributes)}
      {...(dejaRetenue ? {} : listeners)}
    >
      <div className="prep-carte-visuel"><PrepVisuel source={source} /></div>
      <div className="prep-carte-corps">
        <span className="prep-carte-poignee">⠿ a promener vers le corpus</span>
        <Link to={`/lire/${source.id}`} className="prep-carte-titre">{source.titre}</Link>
        <div className="prep-carte-meta">
          {source.media_nom && <span>{source.media_nom}</span>}
          {source.type_source && <span>{source.type_source}</span>}
        </div>
        <div className="prep-carte-actions">
          {dejaRetenue ? (
            <span className="prep-carte-poignee">deja dans le corpus</span>
          ) : (
            <button className="btn btn-sm btn-primary" onClick={() => onAjouter(source.id)} type="button">
              + Retenir
            </button>
          )}
        </div>
      </div>
      <span className="prep-carte-score" title="Score animateur">{source.score.scoreTotal}</span>
    </div>
  )
}

/** Carte du corpus : sortable (poignee) + bouton « Retirer ». */
function PrepCarteCorpus({ source, rang, isFacilitateur, onRetirer }: {
  source: Source
  rang: number
  isFacilitateur: boolean
  onRetirer: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `corpus-${source.id}`,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`prep-carte prep-carte--corpus${isDragging ? ' prep-carte--sorting' : ''}`}
    >
      <span className="prep-carte-rang">{rang}.</span>
      <button className="prep-corpus-grip" type="button" aria-label="Reordonner" {...attributes} {...listeners}>
        <GripVertical size={16} />
      </button>
      <div className="prep-carte-visuel"><PrepVisuel source={source} /></div>
      <div className="prep-carte-corps">
        <Link to={`/lire/${source.id}`} className="prep-carte-titre">{source.titre}</Link>
        <div className="prep-carte-meta">
          {source.media_nom && <span>{source.media_nom}</span>}
        </div>
        {isFacilitateur && (
          <div className="prep-carte-actions">
            <button className="btn btn-sm btn-danger" onClick={() => onRetirer(source.id)} type="button">
              Retirer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Colonne droite : zone de depot + liste sortable du corpus. */
function PrepColonneCorpus({ sources, ordre, isFacilitateur, enCoursDeDrag, onRetirer }: {
  sources: Source[]
  ordre: number[]
  isFacilitateur: boolean
  enCoursDeDrag: boolean
  onRetirer: (id: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: ZONE_CORPUS })

  let zoneClasse = 'prep-dropzone'
  if (isOver) zoneClasse += ' prep-dropzone--over'
  else if (enCoursDeDrag) zoneClasse += ' prep-dropzone--armed'

  const parId = new Map(sources.map(s => [s.id, s]))
  const ordonnees = ordre.map(id => parId.get(id)).filter((s): s is Source => !!s)
  const sortableIds = ordonnees.map(s => `corpus-${s.id}`)

  return (
    <div className="prep-colonne">
      <div className="prep-colonne-head">
        <h3>Corpus de l'atelier</h3>
        <span className="prep-count">{ordonnees.length} retenue{ordonnees.length > 1 ? 's' : ''}</span>
      </div>
      <div ref={setNodeRef} className={`prep-colonne-liste ${zoneClasse}`}>
        {ordonnees.length === 0 && !enCoursDeDrag && (
          <p className="prep-empty">Glissez ici des cartes du vivier, ou utilisez « + Retenir ».</p>
        )}
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {ordonnees.map((s, i) => (
            <PrepCarteCorpus
              key={s.id}
              source={s}
              rang={i + 1}
              isFacilitateur={isFacilitateur}
              onRetirer={onRetirer}
            />
          ))}
        </SortableContext>
        {enCoursDeDrag && (
          <p className="prep-dropzone-invite">
            {isOver ? 'Relachez pour retenir la source' : 'Deposez la carte ici pour la retenir'}
          </p>
        )}
      </div>
    </div>
  )
}

function PreparationBoard({
  ateliers, vivier, prepAtelierId, isFacilitateur, scoreMin, qualityOnly,
  onChangeAtelier, onChangeScoreMin, onChangeQualityOnly, onAjouter, onRetirer, onSave,
}: {
  ateliers: AtelierDetail[]
  vivier: VivierSource[]
  prepAtelierId: number | null
  isFacilitateur: boolean
  scoreMin: number
  qualityOnly: boolean
  onChangeAtelier: (id: number) => void
  onChangeScoreMin: (n: number) => void
  onChangeQualityOnly: (b: boolean) => void
  onAjouter: (atelierId: number, sourceId: number) => Promise<void> | void
  onRetirer: (atelierId: number, sourceId: number) => Promise<void> | void
  onSave: (atelier: AtelierDetail, fields: Record<string, unknown>) => Promise<void> | void
}) {
  const atelier = ateliers.find(a => a.id === prepAtelierId) ?? ateliers[0]

  // Champs date/lieu/heure compacts, sauvegardes a la volee.
  const [date, setDate] = useState(atelier.date_atelier || '')
  const [heure, setHeure] = useState(atelier.heure || '')
  const [lieu, setLieu] = useState(atelier.lieu || '')

  // Ordre LOCAL du corpus (visuel) : pas d'API d'ordre cote serveur.
  const [ordre, setOrdre] = useState<number[]>(atelier.sources.map(s => s.id))

  // L'atelier ou ses sources ont change (ajout/retrait/selection) -> resync.
  useEffect(() => {
    setDate(atelier.date_atelier || '')
    setHeure(atelier.heure || '')
    setLieu(atelier.lieu || '')
  }, [atelier.id, atelier.date_atelier, atelier.heure, atelier.lieu])

  const sourcesKey = atelier.sources.map(s => s.id).join(',')
  useEffect(() => {
    const ids = atelier.sources.map(s => s.id)
    setOrdre(prev => {
      // Conserve l'ordre local existant, ajoute les nouveaux, retire les partis.
      const conserves = prev.filter(id => ids.includes(id))
      const nouveaux = ids.filter(id => !conserves.includes(id))
      return [...conserves, ...nouveaux]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atelier.id, sourcesKey])

  // Carte promenee (DragOverlay) : depuis le vivier (drag) ou le corpus (tri).
  const [overlay, setOverlay] = useState<CarteMin | null>(null)
  const [vivierDragId, setVivierDragId] = useState<number | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const dejaRetenues = useMemo(() => new Set(atelier.sources.map(s => s.id)), [atelier.sources])

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    if (id.startsWith('vivier-')) {
      const s = event.active.data.current?.source as VivierSource | undefined
      setOverlay(s ?? null)
      setVivierDragId(s?.id ?? null)
    } else if (id.startsWith('corpus-')) {
      const sid = Number(id.replace('corpus-', ''))
      const s = atelier.sources.find(x => x.id === sid)
      setOverlay(s ?? null)
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id)
    setOverlay(null)
    setVivierDragId(null)

    // Promenade depuis le vivier -> deposee sur le corpus = on retient.
    if (activeId.startsWith('vivier-')) {
      const s = event.active.data.current?.source as VivierSource | undefined
      const surCorpus = event.over?.id === ZONE_CORPUS || String(event.over?.id ?? '').startsWith('corpus-')
      if (s && surCorpus && !dejaRetenues.has(s.id)) {
        void onAjouter(atelier.id, s.id)
      }
      return
    }

    // Tri interne du corpus (visuel, local).
    if (activeId.startsWith('corpus-') && event.over) {
      const overId = String(event.over.id)
      if (overId.startsWith('corpus-') && activeId !== overId) {
        const from = ordre.indexOf(Number(activeId.replace('corpus-', '')))
        const to = ordre.indexOf(Number(overId.replace('corpus-', '')))
        if (from !== -1 && to !== -1) setOrdre(arrayMove(ordre, from, to))
      }
    }
  }

  const enCoursDeDrag = overlay !== null

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {/* ----- Bandeau de contexte : choix de l'atelier + champs compacts ----- */}
      <div className="prep-barre">
        {ateliers.length > 1 ? (
          <label className="prep-barre-bloc">
            <span>Atelier prepare</span>
            <select value={atelier.id} onChange={(e) => onChangeAtelier(Number(e.target.value))}>
              {ateliers.map(a => (
                <option key={a.id} value={a.id}>
                  #{a.numero}{a.date_atelier ? ` - ${new Date(a.date_atelier).toLocaleDateString('fr-FR')}` : ''} ({a.sources.length})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="prep-barre-bloc">
            <span>Atelier prepare</span>
            <strong>#{atelier.numero}</strong>
          </div>
        )}

        {isFacilitateur && (
          <>
            <label className="prep-barre-bloc">
              <span>Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="prep-barre-bloc">
              <span>Heure</span>
              <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
            </label>
            <label className="prep-barre-bloc">
              <span>Lieu</span>
              <input type="text" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Salle, en ligne..." />
            </label>
            <div className="prep-barre-actions">
              <button
                className="btn btn-sm btn-primary"
                type="button"
                onClick={() => onSave(atelier, { date_atelier: date || null, heure: heure || null, lieu: lieu || null })}
              >
                Enregistrer
              </button>
              <a href={`/api/ateliers/${atelier.id}/print`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">
                Imprimable
              </a>
            </div>
          </>
        )}
      </div>

      {/* ----- Tableau 2 colonnes ----- */}
      <div className="prep-board">
        {/* Colonne gauche : vivier draggable */}
        <div className="prep-colonne">
          <div className="prep-colonne-head">
            <h3>Vivier</h3>
            <span className="prep-count">{vivier.length} candidate{vivier.length > 1 ? 's' : ''}</span>
          </div>
          <div className="prep-vivier-filtres">
            <label>
              Score min
              <input
                type="number" min={0} max={100} step={5}
                value={scoreMin}
                onChange={(e) => onChangeScoreMin(Number(e.target.value))}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={qualityOnly}
                onChange={(e) => onChangeQualityOnly(e.target.checked)}
              />
              Pret uniquement
            </label>
          </div>
          <div className="prep-colonne-liste">
            {vivier.length === 0 && <p className="prep-empty">Aucune source candidate.</p>}
            {vivier.map(s => (
              <PrepCarteVivier
                key={s.id}
                source={s}
                dejaRetenue={dejaRetenues.has(s.id)}
                enDrag={vivierDragId === s.id}
                onAjouter={(id) => { void onAjouter(atelier.id, id) }}
              />
            ))}
          </div>
        </div>

        {/* Colonne droite : corpus sortable + zone de depot */}
        <PrepColonneCorpus
          sources={atelier.sources}
          ordre={ordre}
          isFacilitateur={isFacilitateur}
          enCoursDeDrag={enCoursDeDrag}
          onRetirer={(id) => { void onRetirer(atelier.id, id) }}
        />
      </div>

      {/* La carte promenee suit le curseur, rendue hors flux. */}
      <DragOverlay>
        {overlay ? (
          <div className="prep-carte prep-carte--overlay">
            <div className="prep-carte-visuel"><PrepVisuel source={overlay} /></div>
            <div className="prep-carte-corps">
              <span className="prep-carte-titre">{overlay.titre}</span>
              {overlay.media_nom && <div className="prep-carte-meta"><span>{overlay.media_nom}</span></div>}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
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
