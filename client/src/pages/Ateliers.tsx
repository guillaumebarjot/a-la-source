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
import type { Source, Atelier, AtelierDetail, Tag, Facettes } from '../types'
import '../styles/ateliers-prep.css'
import '../styles/ateliers-encours.css'
import '../styles/slider-saisie.css'

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
  facettes: Facettes
  tags: Tag[]
  atelier_badges: AtelierBadge[]
  quality_gate: QualityGate
}

// Tris factuels du vivier (le score n'est plus le tri par défaut, doctrine
// « décrire, ne pas noter »). Il reste proposé comme tri optionnel.
type TriVivier = 'recence' | 'fraicheur' | 'score'

// Profil de diversité d'un corpus (méthode de sélection « décrire, ne pas noter »).
// On ne note pas une source : on décrit le corpus par ses axes de diversité.
interface AxeDiversite {
  cle: string
  label: string
  distinct: number
  total: number
  cible: number
  atteint: boolean
  distribution: { valeur: string; n: number }[]
}
interface AlerteCorpus {
  axe: string
  message: string
}
interface SuggestionDiversite {
  axe: string
  raison: string
  source_ids: number[]
}
interface ProfilDiversite {
  nbSources: number
  axes: AxeDiversite[]
  duree: { total: number; enZoneAtelier: number; repartition: { timing: string; n: number }[] }
  alertes: AlerteCorpus[]
  completude: { total: number; pretes: number }
  suggestions: SuggestionDiversite[]
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

  // Filtres vivier : tri factuel par défaut (récence), quality gate = checklist
  // de complétude (évaluée / archivée / accroche), pas un score.
  const [tri, setTri] = useState<TriVivier>('recence')
  const [qualityOnly, setQualityOnly] = useState(false)

  // Atelier creation form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newHeure, setNewHeure] = useState('')
  const [newLieu, setNewLieu] = useState('')

  // Atelier actuellement en preparation (s'il y en a plusieurs, on choisit lequel).
  const [prepAtelierId, setPrepAtelierId] = useState<number | null>(null)

  // Atelier actuellement piloté dans la sous-vue « en cours » (sélection indépendante).
  const [pilotAtelierId, setPilotAtelierId] = useState<number | null>(null)

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

  // Idem pour l'atelier piloté en sous-vue « en cours ».
  useEffect(() => {
    if (ateliersActifs.length === 0) {
      if (pilotAtelierId !== null) setPilotAtelierId(null)
      return
    }
    const stillThere = ateliersActifs.some(a => a.id === pilotAtelierId)
    if (!stillThere) setPilotAtelierId(ateliersActifs[0].id)
  }, [ateliersActifs, pilotAtelierId])

  /* ---------- Filtres vivier ---------- */

  const vivierFiltre = useMemo(() => {
    const filtre = vivier.filter((s) => !qualityOnly || s.quality_gate.ok)
    const trie = [...filtre]
    if (tri === 'fraicheur') {
      trie.sort((a, b) => (b.facettes?.fraicheur ?? 0) - (a.facettes?.fraicheur ?? 0))
    } else if (tri === 'score') {
      trie.sort((a, b) => b.score.scoreTotal - a.score.scoreTotal)
    } else {
      // Récence : source la plus récemment soumise d'abord (aligné sur le serveur).
      trie.sort((a, b) => String(b.soumis_le ?? '').localeCompare(String(a.soumis_le ?? '')))
    }
    return trie
  }, [vivier, tri, qualityOnly])

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

  const changerStatut = async (atelierId: number, statut: string) => {
    await api.patch(`/ateliers/${atelierId}`, { statut })
    await fetchData()
  }

  const terminerAtelier = async (atelierId: number) => {
    await api.patch(`/ateliers/${atelierId}`, { statut: 'termine' })
    await fetchData()
  }

  const enregistrerSynthese = async (atelierId: number, fields: Record<string, unknown>) => {
    await api.post(`/ateliers/${atelierId}/synthese`, fields)
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
            Sources soumises au vivier : on les <strong>décrit</strong> par des faits
            (fraîcheur, copie locale, complétude, mécanismes pressentis), on ne les note pas.
            {!qualityOnly && ' Activez « prêtes pour atelier » pour ne garder que les sources évaluées, archivées et accrochées.'}
          </p>

          <div className="vivier-controles">
            <label className="vivier-tri">
              Trier par
              <select value={tri} onChange={(e) => setTri(e.target.value as TriVivier)} aria-label="Trier le vivier">
                <option value="recence">Récence (soumission)</option>
                <option value="fraicheur">Fraîcheur (ancienneté)</option>
                <option value="score">Score animateur (optionnel)</option>
              </select>
            </label>
            <label className="vivier-quality-filter">
              <input
                type="checkbox"
                checked={qualityOnly}
                onChange={(e) => setQualityOnly(e.target.checked)}
              />
              Prêtes pour atelier uniquement
            </label>
          </div>

          <div className="source-grid">
            {vivierFiltre.length === 0 && <p className="empty">Aucune source dans le vivier.</p>}
            {vivierFiltre.map((s) => (
              <SourceCard
                key={s.id}
                source={s}
                facettes={s.facettes}
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
              tri={tri}
              qualityOnly={qualityOnly}
              onChangeAtelier={setPrepAtelierId}
              onChangeTri={setTri}
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
        <EnCoursTableau
          ateliers={ateliersActifs}
          pilotAtelierId={pilotAtelierId}
          isFacilitateur={isFacilitateur}
          onChangeAtelier={setPilotAtelierId}
          onChangeStatut={changerStatut}
          onSaveSynthese={enregistrerSynthese}
          onTerminer={terminerAtelier}
        />
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
      <span className="prep-carte-facette" title="Fraîcheur — ancienneté relative de la source">
        {(source.facettes.fraicheur * 100).toFixed(0)} %
      </span>
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

/* ===========================================================================
 * PROFIL DE DIVERSITE du corpus (methode de selection « decrire, ne pas noter »).
 *
 * On ne note pas une source. On decrit le corpus par ses axes de diversite
 * (medias, propriete, types, sujets, mecanismes), avec des jauges sobres, des
 * alertes douces (observations factuelles) et des suggestions de complement.
 * Outil de COULISSE animateur : il ne fuite jamais vers la projection (epoche).
 * =========================================================================== */

function JaugeAxe({ axe }: { axe: AxeDiversite }) {
  const ratio = axe.cible > 0 ? Math.min(1, axe.distinct / axe.cible) : 1
  return (
    <div className="prep-divers-ligne">
      <span className="prep-divers-label">{axe.label}</span>
      <span className="prep-divers-jauge" aria-hidden="true">
        <span
          className={`prep-divers-jauge-fill${axe.atteint ? ' prep-divers-jauge-fill--ok' : ''}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </span>
      <span className="prep-divers-chiffre">
        {axe.distinct} distinct{axe.distinct > 1 ? 's' : ''}
        {axe.atteint ? ' ✔' : ` / ${axe.cible}`}
      </span>
    </div>
  )
}

function ProfilDiversitePanneau({
  atelierId, sourcesKey, vivierParId, isFacilitateur, onAjouter,
}: {
  atelierId: number
  sourcesKey: string
  vivierParId: Map<number, VivierSource>
  isFacilitateur: boolean
  onAjouter: (sourceId: number) => void
}) {
  const [profil, setProfil] = useState<ProfilDiversite | null>(null)
  const [ouvert, setOuvert] = useState(true)
  const [avecSuggestions, setAvecSuggestions] = useState(false)

  useEffect(() => {
    let annule = false
    const q = avecSuggestions ? '?suggestions=1' : ''
    api.get<ProfilDiversite>(`/ateliers/${atelierId}/diversite${q}`)
      .then((p) => { if (!annule) setProfil(p) })
      .catch(() => { if (!annule) setProfil(null) })
    return () => { annule = true }
    // Recalcul a chaque changement de corpus (sourcesKey) ou d'option suggestions.
  }, [atelierId, sourcesKey, avecSuggestions])

  if (!profil) return null

  return (
    <section className="prep-divers">
      <header className="prep-divers-head">
        <button
          type="button"
          className="prep-divers-toggle"
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
        >
          {ouvert ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>Profil du corpus ({profil.nbSources} source{profil.nbSources > 1 ? 's' : ''})</span>
        </button>
        <span className="prep-divers-completude">
          {profil.completude.pretes}/{profil.completude.total} prête{profil.completude.pretes > 1 ? 's' : ''} à projeter
        </span>
      </header>

      {ouvert && (
        <div className="prep-divers-corps">
          <p className="prep-divers-intro">
            On décrit la diversité du corpus, on ne note pas les sources. Les cibles sont
            indicatives : à vous d'arbitrer.
          </p>

          <div className="prep-divers-axes">
            {profil.axes.map((a) => <JaugeAxe key={a.cle} axe={a} />)}
            <div className="prep-divers-ligne prep-divers-ligne--duree">
              <span className="prep-divers-label">Durée</span>
              <span className="prep-divers-chiffre">
                {profil.duree.enZoneAtelier} en zone atelier (5-10 min) sur {profil.duree.total}
              </span>
            </div>
          </div>

          {profil.alertes.length > 0 && (
            <ul className="prep-divers-alertes">
              {profil.alertes.map((al, i) => (
                <li key={i} className="prep-divers-alerte">{al.message}</li>
              ))}
            </ul>
          )}

          {isFacilitateur && (
            <div className="prep-divers-suggest">
              <label className="prep-divers-suggest-toggle">
                <input
                  type="checkbox"
                  checked={avecSuggestions}
                  onChange={(e) => setAvecSuggestions(e.target.checked)}
                />
                Suggérer des sources pour diversifier
              </label>
              {avecSuggestions && profil.suggestions.length === 0 && (
                <p className="prep-divers-suggest-vide">Aucune suggestion : le vivier ne comble pas les axes faibles.</p>
              )}
              {avecSuggestions && profil.suggestions.map((sug) => (
                <div key={sug.axe} className="prep-divers-suggest-bloc">
                  <p className="prep-divers-suggest-raison">{sug.raison}</p>
                  <div className="prep-divers-suggest-cartes">
                    {sug.source_ids.map((sid) => {
                      const s = vivierParId.get(sid)
                      if (!s) return null
                      return (
                        <div key={sid} className="prep-divers-suggest-carte">
                          <span className="prep-divers-suggest-titre">{s.titre}</span>
                          {s.media_nom && <span className="prep-divers-suggest-media">{s.media_nom}</span>}
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => onAjouter(sid)}
                          >
                            + Retenir
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function PreparationBoard({
  ateliers, vivier, prepAtelierId, isFacilitateur, tri, qualityOnly,
  onChangeAtelier, onChangeTri, onChangeQualityOnly, onAjouter, onRetirer, onSave,
}: {
  ateliers: AtelierDetail[]
  vivier: VivierSource[]
  prepAtelierId: number | null
  isFacilitateur: boolean
  tri: TriVivier
  qualityOnly: boolean
  onChangeAtelier: (id: number) => void
  onChangeTri: (t: TriVivier) => void
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

  // Index du vivier par id : sert au panneau de diversite a resoudre les
  // suggestions (ids -> carte) sans nouvel appel.
  const vivierParId = useMemo(() => new Map(vivier.map(s => [s.id, s])), [vivier])

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

      {/* ----- Profil de diversite du corpus (methode de selection) ----- */}
      <ProfilDiversitePanneau
        atelierId={atelier.id}
        sourcesKey={sourcesKey}
        vivierParId={vivierParId}
        isFacilitateur={isFacilitateur}
        onAjouter={(sid) => { if (!dejaRetenues.has(sid)) void onAjouter(atelier.id, sid) }}
      />

      {/* ----- Tableau 2 colonnes ----- */}
      <div className="prep-board">
        {/* Colonne gauche : vivier draggable */}
        <div className="prep-colonne">
          <div className="prep-colonne-head">
            <h3>Vivier</h3>
            <span className="prep-count">{vivier.length} candidate{vivier.length > 1 ? 's' : ''}</span>
          </div>
          <div className="prep-vivier-filtres">
            <label className="vivier-tri">
              Trier par
              <select value={tri} onChange={(e) => onChangeTri(e.target.value as TriVivier)} aria-label="Trier le vivier">
                <option value="recence">Récence</option>
                <option value="fraicheur">Fraîcheur</option>
                <option value="score">Score (optionnel)</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={qualityOnly}
                onChange={(e) => onChangeQualityOnly(e.target.checked)}
              />
              Prêtes uniquement
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

/* ===========================================================================
 * EN COURS : table de pilotage de l'atelier prêt / en cours.
 *
 *  - Sélecteur d'atelier (onglets) si plusieurs ateliers actifs.
 *  - Carte d'identité de l'atelier piloté : numéro, date, lieu, statut,
 *    nb de sources, nb de participants, transitions de statut.
 *  - Gros bouton « Lancer la projection » vers /projection/:id (page séparée).
 *  - Corpus en cartes (image + titre) via SourceCard, en mode « carte nue »
 *    (hideAttribution) pour ne pas biaiser le regard pendant l'atelier.
 *  - Synthèse compacte (mécanismes cochés, ce qui a surpris, questions
 *    restantes, nb participants) via POST /ateliers/:id/synthese.
 *
 * Aucun endpoint inventé : transitions via PATCH /ateliers/:id { statut },
 * synthèse via POST /ateliers/:id/synthese, clôture via { statut: 'termine' }.
 * =========================================================================== */

interface MecanismeRef {
  id: number
  nom: string
  categorie: string | null
  categorie_label: string | null
}

const STATUT_LABELS: Record<string, string> = {
  preparation: 'En préparation',
  pret: 'Prêt',
  en_cours: 'En cours',
  termine: 'Terminé',
}

function EnCoursTableau({
  ateliers, pilotAtelierId, isFacilitateur,
  onChangeAtelier, onChangeStatut, onSaveSynthese, onTerminer,
}: {
  ateliers: AtelierDetail[]
  pilotAtelierId: number | null
  isFacilitateur: boolean
  onChangeAtelier: (id: number) => void
  onChangeStatut: (atelierId: number, statut: string) => Promise<void> | void
  onSaveSynthese: (atelierId: number, fields: Record<string, unknown>) => Promise<void> | void
  onTerminer: (atelierId: number) => Promise<void> | void
}) {
  if (ateliers.length === 0) {
    return (
      <section className="atelier-section encours-vue">
        <h2>Atelier en cours</h2>
        <div className="encours-vide">
          <p className="encours-vide-titre">Aucun atelier prêt à piloter.</p>
          <p className="encours-vide-aide">
            Composez un corpus de sources, puis revenez ici pour mener l'atelier.
          </p>
          <Link to="/ateliers/preparation" className="btn btn-primary">Aller à la préparation</Link>
        </div>
      </section>
    )
  }

  const atelier = ateliers.find(a => a.id === pilotAtelierId) ?? ateliers[0]

  return (
    <section className="atelier-section encours-vue">
      <h2>Atelier en cours</h2>

      {ateliers.length > 1 && (
        <div className="encours-onglets" role="tablist" aria-label="Ateliers à piloter">
          {ateliers.map(a => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={a.id === atelier.id}
              className={`encours-onglet${a.id === atelier.id ? ' encours-onglet--actif' : ''}`}
              onClick={() => onChangeAtelier(a.id)}
            >
              <span className="encours-onglet-num">#{a.numero}</span>
              <span className={`encours-statut-pastille encours-statut-pastille--${a.statut}`} />
              {a.date_atelier && (
                <span className="encours-onglet-date">
                  {new Date(a.date_atelier).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <EnCoursPilote
        key={atelier.id}
        atelier={atelier}
        isFacilitateur={isFacilitateur}
        onChangeStatut={onChangeStatut}
        onSaveSynthese={onSaveSynthese}
        onTerminer={onTerminer}
      />
    </section>
  )
}

function EnCoursPilote({ atelier, isFacilitateur, onChangeStatut, onSaveSynthese, onTerminer }: {
  atelier: AtelierDetail
  isFacilitateur: boolean
  onChangeStatut: (atelierId: number, statut: string) => Promise<void> | void
  onSaveSynthese: (atelierId: number, fields: Record<string, unknown>) => Promise<void> | void
  onTerminer: (atelierId: number) => Promise<void> | void
}) {
  const nbSources = atelier.sources.length
  const projectionDispo = nbSources > 0

  return (
    <div className="encours-grille">
      {/* ---- Carte d'identité de l'atelier ---- */}
      <div className="encours-fiche">
        <div className="encours-fiche-tete">
          <span className="encours-fiche-num">Atelier #{atelier.numero}</span>
          <span className={`encours-statut encours-statut--${atelier.statut}`}>
            {STATUT_LABELS[atelier.statut] ?? atelier.statut}
          </span>
        </div>

        <dl className="encours-faits">
          <div className="encours-fait">
            <dt>Date</dt>
            <dd>{atelier.date_atelier
              ? new Date(atelier.date_atelier).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
              : 'à fixer'}{atelier.heure ? ` · ${atelier.heure}` : ''}</dd>
          </div>
          <div className="encours-fait">
            <dt>Lieu</dt>
            <dd>{atelier.lieu || 'à préciser'}</dd>
          </div>
          <div className="encours-fait">
            <dt>Sources</dt>
            <dd>{nbSources}</dd>
          </div>
          <div className="encours-fait">
            <dt>Participant·es</dt>
            <dd>{atelier.nb_participants ?? '—'}</dd>
          </div>
        </dl>

        {isFacilitateur && (
          <div className="encours-transitions">
            <span className="encours-transitions-label">Avancement</span>
            <div className="encours-transitions-pas">
              <StatutPas
                actif={atelier.statut === 'pret'}
                fait={atelier.statut === 'en_cours' || atelier.statut === 'termine'}
                label="Prêt"
                onClick={atelier.statut !== 'pret' ? () => onChangeStatut(atelier.id, 'pret') : undefined}
              />
              <StatutPas
                actif={atelier.statut === 'en_cours'}
                fait={atelier.statut === 'termine'}
                label="En cours"
                onClick={atelier.statut !== 'en_cours' ? () => onChangeStatut(atelier.id, 'en_cours') : undefined}
              />
              <StatutPas
                actif={false}
                fait={false}
                label="Terminé"
                onClick={() => onTerminer(atelier.id)}
                variante="fin"
              />
            </div>
          </div>
        )}
      </div>

      {/* ---- Accès projection ---- */}
      <div className="encours-projection">
        {projectionDispo ? (
          <>
            <Link to={`/projection/${atelier.id}`} className="encours-lancer">
              Lancer la projection
            </Link>
            <a
              href={`/api/ateliers/${atelier.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary encours-imprimable"
            >
              Version imprimable
            </a>
          </>
        ) : (
          <p className="encours-projection-vide">
            Aucune source dans le corpus. <Link to="/ateliers/preparation">Complétez la préparation</Link> avant de projeter.
          </p>
        )}
      </div>

      {/* ---- Corpus en cartes ---- */}
      <div className="encours-corpus">
        <div className="encours-corpus-tete">
          <h3>Corpus à promener</h3>
          <span className="encours-corpus-compte">{nbSources} source{nbSources > 1 ? 's' : ''}</span>
        </div>
        {nbSources === 0 ? (
          <p className="encours-corpus-vide">Le corpus est vide.</p>
        ) : (
          <div className="encours-cartes">
            {atelier.sources.map((s) => (
              <SourceCard key={s.id} source={s} hideAttribution />
            ))}
          </div>
        )}
      </div>

      {/* ---- Synthèse ---- */}
      {isFacilitateur && (
        <EnCoursSynthese atelier={atelier} onSave={onSaveSynthese} />
      )}
    </div>
  )
}

function StatutPas({ label, actif, fait, onClick, variante }: {
  label: string
  actif: boolean
  fait: boolean
  onClick?: () => void
  variante?: 'fin'
}) {
  let cls = 'encours-pas'
  if (actif) cls += ' encours-pas--actif'
  if (fait) cls += ' encours-pas--fait'
  if (variante === 'fin') cls += ' encours-pas--fin'
  return (
    <button type="button" className={cls} onClick={onClick} disabled={!onClick}>
      {label}
    </button>
  )
}

function EnCoursSynthese({ atelier, onSave }: {
  atelier: AtelierDetail
  onSave: (atelierId: number, fields: Record<string, unknown>) => Promise<void> | void
}) {
  const [refs, setRefs] = useState<MecanismeRef[]>([])
  const [selection, setSelection] = useState<Set<number>>(
    () => new Set((atelier.mecanismes_identifies ?? []).map(m => m.mecanisme_id))
  )
  const [surprise, setSurprise] = useState(atelier.observations_surprise || '')
  const [questions, setQuestions] = useState(atelier.questions_restantes || '')
  const [nbParticipants, setNbParticipants] = useState(atelier.nb_participants?.toString() || '')
  const [enregistre, setEnregistre] = useState(false)

  useEffect(() => {
    let actif = true
    api.get<MecanismeRef[]>('/mecanismes')
      .then(d => { if (actif) setRefs(d) })
      .catch(() => { /* la sélection reste vide, le reste de la synthèse fonctionne */ })
    return () => { actif = false }
  }, [])

  // Regroupe les mécanismes par catégorie pour une grille compacte.
  const parCategorie = useMemo(() => {
    const m = new Map<string, MecanismeRef[]>()
    for (const r of refs) {
      const cle = r.categorie_label || 'Autres'
      const liste = m.get(cle) || []
      liste.push(r)
      m.set(cle, liste)
    }
    return [...m.entries()]
  }, [refs])

  const basculer = (id: number) => {
    setSelection(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setEnregistre(false)
  }

  const enregistrer = async () => {
    await onSave(atelier.id, {
      mecanisme_ids: [...selection],
      observations_surprise: surprise || null,
      questions_restantes: questions || null,
      nb_participants: nbParticipants ? parseInt(nbParticipants, 10) : null,
    })
    setEnregistre(true)
  }

  return (
    <div className="encours-synthese">
      <div className="encours-synthese-tete">
        <h3>Synthèse de l'atelier</h3>
        <p className="encours-synthese-aide">À remplir pendant ou juste après l'atelier.</p>
      </div>

      <div className="encours-synthese-blocs">
        <div className="encours-bloc encours-bloc--meca">
          <span className="encours-bloc-label">Mécanismes identifiés par le groupe</span>
          {parCategorie.length === 0 ? (
            <p className="encours-bloc-vide">Liste des mécanismes indisponible.</p>
          ) : (
            parCategorie.map(([cat, liste]) => (
              <div key={cat} className="encours-meca-cat">
                <span className="encours-meca-cat-titre">{cat}</span>
                <div className="encours-meca-puces">
                  {liste.map(m => {
                    const coche = selection.has(m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`encours-puce${coche ? ' encours-puce--coche' : ''}`}
                        aria-pressed={coche}
                        onClick={() => basculer(m.id)}
                      >
                        {m.nom}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <label className="encours-bloc">
          <span className="encours-bloc-label">Ce qui a surpris</span>
          <textarea
            value={surprise}
            onChange={(e) => { setSurprise(e.target.value); setEnregistre(false) }}
            placeholder="Réactions inattendues, basculements de regard..."
            rows={3}
          />
        </label>

        <label className="encours-bloc">
          <span className="encours-bloc-label">Questions restantes</span>
          <textarea
            value={questions}
            onChange={(e) => { setQuestions(e.target.value); setEnregistre(false) }}
            placeholder="Ce qui reste à creuser, à prolonger..."
            rows={3}
          />
        </label>

        <label className="encours-bloc encours-bloc--nb">
          <span className="encours-bloc-label">Nombre de participant·es</span>
          <input
            type="number"
            min={1}
            value={nbParticipants}
            onChange={(e) => { setNbParticipants(e.target.value); setEnregistre(false) }}
          />
        </label>
      </div>

      <div className="encours-synthese-actions">
        <button className="btn btn-primary" type="button" onClick={enregistrer}>
          Enregistrer la synthèse
        </button>
        {enregistre && <span className="encours-enregistre">Synthèse enregistrée.</span>}
      </div>
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
