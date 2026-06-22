/**
 * Ateliers.tsx
 *
 * Deux responsabilités :
 *  1. Export default : la LISTE de tous les ateliers (/ateliers) + le VIVIER
 *     (/ateliers/vivier). La liste renvoie vers /ateliers/:id (objet atelier).
 *  2. Exports nommés : composants réutilisés par Atelier.tsx (page objet) :
 *     AtelierStepperExport, EnCoursPiloteExport, PreparationBoardExport.
 *     On exporte aussi les types VivierSource et TriVivier.
 *
 * DARK-SAFE : uniquement des tokens --color-* / --space-* / --radius-*.
 * Jamais de texte rouge sur fond sombre.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useParams, useNavigate, Navigate } from 'react-router-dom'
import { Star, FileCheck, Pencil, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import SourceImage from '../components/cards/SourceImage'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
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
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../api/client'
import { useAuth } from '../store/useAuth'
import SourceCard from '../components/cards/SourceCard'
import EtapesActivite, { type Etape } from '../components/activite/EtapesActivite'
import type { Source, Atelier, AtelierDetail, Tag, Facettes } from '../types'
import '../styles/ateliers-prep.css'
import '../styles/ateliers-encours.css'
import '../styles/slider-saisie.css'

/* ============================================================================
 * Types
 * ========================================================================== */

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

export interface VivierSource extends Source {
  score: ScoreComplet
  facettes: Facettes
  tags: Tag[]
  atelier_badges: AtelierBadge[]
  quality_gate: QualityGate
}

// Tris factuels du vivier (le score n'est plus le tri par défaut, doctrine
// « décrire, ne pas noter »). Il reste proposé comme tri optionnel.
export type TriVivier = 'recence' | 'fraicheur' | 'score'

// Jalons factuels renvoyés par GET /ateliers/:id.
interface AtelierJalons {
  a_corpus: boolean
  a_source_choisie: boolean
  a_mecanismes: boolean
  a_synthese: boolean
  est_termine: boolean
}

// Profil de diversité d'un corpus (méthode « décrire, ne pas noter »).
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

/* ============================================================================
 * Composant principal : LISTE des ateliers + VIVIER
 *
 * Route /ateliers      -> section = undefined -> liste
 * Route /ateliers/vivier -> section = 'vivier'
 * Les autres sections (en-cours, preparation, archives) sont redirigées :
 *   - en-cours et preparation -> /ateliers (la liste contient maintenant tout)
 *   - archives -> /ateliers (les terminés s'y trouvent aussi)
 * ========================================================================== */

export default function Ateliers() {
  const { section } = useParams<{ section?: string }>()
  const user = useAuth((s) => s.user)
  const isFacilitateur = user?.role === 'animateur' || user?.role === 'admin'

  // Redirects des anciennes sections vers la liste ou le vivier.
  if (section === 'en-cours' || section === 'preparation' || section === 'archives') {
    return <Navigate to="/ateliers" replace />
  }

  return <AteliersInterne section={section} isFacilitateur={isFacilitateur} />
}

/* Composant interne pour isoler les hooks (pas de hook après return conditionnel). */
function AteliersInterne({
  section,
  isFacilitateur,
}: {
  section: string | undefined
  isFacilitateur: boolean
}) {
  const navigate = useNavigate()
  const [vivier, setVivier] = useState<VivierSource[]>([])
  const [ateliers, setAteliers] = useState<Atelier[]>([])
  const [loading, setLoading] = useState(true)

  const [tri, setTri] = useState<TriVivier>('recence')
  const [qualityOnly, setQualityOnly] = useState(false)

  const [showNewForm, setShowNewForm] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newHeure, setNewHeure] = useState('')
  const [newLieu, setNewLieu] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [vivierData, listeData] = await Promise.all([
        api.get<VivierSource[]>('/ateliers/vivier'),
        api.get<Atelier[]>('/ateliers'),
      ])
      setVivier(vivierData)
      setAteliers(listeData)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  const vivierFiltre = useMemo(() => {
    const filtre = vivier.filter((s) => !qualityOnly || s.quality_gate.ok)
    const trie = [...filtre]
    if (tri === 'fraicheur') {
      trie.sort((a, b) => (b.facettes?.fraicheur ?? 0) - (a.facettes?.fraicheur ?? 0))
    } else if (tri === 'score') {
      trie.sort((a, b) => b.score.scoreTotal - a.score.scoreTotal)
    } else {
      trie.sort((a, b) => String(b.soumis_le ?? '').localeCompare(String(a.soumis_le ?? '')))
    }
    return trie
  }, [vivier, tri, qualityOnly])

  const creerAtelier = async () => {
    const res = await api.post<{ id: number; numero: number }>('/ateliers', {
      date_atelier: newDate || null,
      heure: newHeure || null,
      lieu: newLieu || null,
    })
    setShowNewForm(false)
    setNewDate('')
    setNewHeure('')
    setNewLieu('')
    // On entre directement dans l'objet du nouvel atelier (navigation SPA, sans rechargement).
    if (res?.id) {
      navigate(`/ateliers/${res.id}`)
    } else {
      await fetchData()
    }
  }

  if (loading) return (
    <div className="page-ateliers">
      <p className="loading">Chargement...</p>
    </div>
  )

  /* ---- VUE VIVIER ---- */
  if (section === 'vivier') {
    return (
      <div className="page-ateliers">
        <section className="atelier-section">
          <header className="atelier-section-header">
            <h2>Vivier ({vivierFiltre.length} sources)</h2>
            <Link to="/ateliers" className="btn btn-sm btn-secondary">
              Retour à la liste
            </Link>
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
              />
            ))}
          </div>
        </section>
      </div>
    )
  }

  /* ---- VUE LISTE (défaut) ---- */
  const actifs = ateliers.filter(a => a.statut !== 'termine')
  const termines = ateliers.filter(a => a.statut === 'termine')

  return (
    <div className="page-ateliers">

      {/* ---- En-tête liste ---- */}
      <div className="ateliers-liste-header">
        <h2>Ateliers</h2>
        <div className="ateliers-liste-actions">
          <Link to="/ateliers/vivier" className="btn btn-sm btn-secondary">
            Vivier ({vivier.length})
          </Link>
          {isFacilitateur && !showNewForm && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setShowNewForm(true)}
            >
              Créer un atelier
            </button>
          )}
        </div>
      </div>

      {/* ---- Formulaire de création ---- */}
      {showNewForm && (
        <div className="atelier-new-form">
          <h3>Nouvel atelier</h3>
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
            <button className="btn btn-primary" onClick={creerAtelier} type="button">Créer</button>
            <button className="btn" onClick={() => setShowNewForm(false)} type="button">Annuler</button>
          </div>
        </div>
      )}

      {/* ---- Ateliers actifs (à venir et en cours) ---- */}
      {actifs.length > 0 && (
        <section className="ateliers-groupe">
          <h3 className="ateliers-groupe-titre">À venir et en cours</h3>
          <div className="ateliers-liste">
            {actifs.map((a) => (
              <AtelierCard key={a.id} atelier={a} />
            ))}
          </div>
        </section>
      )}

      {/* ---- Ateliers passés ---- */}
      {termines.length > 0 && (
        <section className="ateliers-groupe">
          <h3 className="ateliers-groupe-titre">Passés</h3>
          <div className="ateliers-liste">
            {termines.map((a) => (
              <AtelierCard key={a.id} atelier={a} />
            ))}
          </div>
        </section>
      )}

      {/* ---- État vide ---- */}
      {ateliers.length === 0 && !showNewForm && (
        <div className="ateliers-vide">
          <p className="ateliers-vide-titre">Aucun atelier pour l'instant.</p>
          <p className="ateliers-vide-aide">
            Commencez par alimenter le{' '}
            <Link to="/ateliers/vivier">vivier de sources</Link>, puis créez un atelier.
          </p>
          {isFacilitateur && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowNewForm(true)}
            >
              Créer le premier atelier
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ============================================================================
 * Carte d'atelier dans la liste
 * ========================================================================== */

function AtelierCard({ atelier }: { atelier: Atelier }) {
  const dateStr = atelier.date_atelier
    ? new Date(atelier.date_atelier).toLocaleDateString('fr-FR', {
        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <Link to={`/ateliers/${atelier.id}`} className="atelier-card">
      <div className="atelier-card-numero">#{atelier.numero}</div>
      <div className="atelier-card-corps">
        <div className="atelier-card-tete">
          <span className="atelier-card-date">{dateStr ?? 'Date à fixer'}</span>
          {atelier.heure && <span className="atelier-card-heure">{atelier.heure}</span>}
        </div>
        {atelier.lieu && <span className="atelier-card-lieu">{atelier.lieu}</span>}
        {atelier.nb_participants != null && (
          <span className="atelier-card-nb">
            {atelier.nb_participants} participant·e{atelier.nb_participants > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <span className={`encours-statut encours-statut--${atelier.statut} atelier-card-statut`}>
        {STATUT_LABELS[atelier.statut] ?? atelier.statut}
      </span>
    </Link>
  )
}

/* ============================================================================
 * EXPORTS nommés — composants réutilisés par Atelier.tsx (page objet).
 * On les préfixe "Export" pour éviter les conflits de noms internes.
 * ========================================================================== */

/* ---------- QualityGateIndicator (interne + export implicite via Board) ---- */

function QualityGateIndicator({ gate }: { gate: QualityGate }) {
  return (
    <div className="quality-gate-indicator">
      <span className={gate.hasEvaluation ? 'qg-ok' : 'qg-missing'} title="Evaluation"><Star size={14} /></span>
      <span className={gate.hasArchive ? 'qg-ok' : 'qg-missing'} title="Archive locale"><FileCheck size={14} /></span>
      <span className={gate.hasAccroche ? 'qg-ok' : 'qg-missing'} title="Accroche redigee"><Pencil size={14} /></span>
    </div>
  )
}

/* ===========================================================================
 * PRÉPARATION : tableau 2 colonnes en glisser-déposer (dnd-kit).
 * =========================================================================== */

const ZONE_CORPUS = 'zone-corpus'

type CarteMin = { titre: string; image_url: string | null; media_nom?: string | null }

function PrepVisuel({ source }: { source: CarteMin }) {
  return (
    <SourceImage
      src={source.image_url}
      fallback={<span className="prep-carte-initiale">{(source.media_nom || source.titre).charAt(0)}</span>}
    />
  )
}

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
        <span className="prep-carte-poignee">à promener vers le corpus</span>
        <Link to={`/lire/${source.id}`} className="prep-carte-titre">{source.titre}</Link>
        <div className="prep-carte-meta">
          {source.media_nom && <span>{source.media_nom}</span>}
          {source.type_source && <span>{source.type_source}</span>}
        </div>
        <div className="prep-carte-actions">
          {dejaRetenue ? (
            <span className="prep-carte-poignee">déjà dans le corpus</span>
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
      <button className="prep-corpus-grip" type="button" aria-label="Réordonner" {...attributes} {...listeners}>
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
            {isOver ? 'Relâchez pour retenir la source' : 'Déposez la carte ici pour la retenir'}
          </p>
        )}
      </div>
    </div>
  )
}

/* ---------- Profil de diversité ---- */

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

/* ---------- PreparationBoard (interne + export) ---- */

export interface PreparationBoardProps {
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
}

function PreparationBoard({
  ateliers, vivier, prepAtelierId, isFacilitateur, tri, qualityOnly,
  onChangeAtelier, onChangeTri, onChangeQualityOnly, onAjouter, onRetirer, onSave,
}: PreparationBoardProps) {
  const atelier = ateliers.find(a => a.id === prepAtelierId) ?? ateliers[0]

  const [date, setDate] = useState(atelier.date_atelier || '')
  const [heure, setHeure] = useState(atelier.heure || '')
  const [lieu, setLieu] = useState(atelier.lieu || '')
  const [ordre, setOrdre] = useState<number[]>(atelier.sources.map(s => s.id))

  useEffect(() => {
    setDate(atelier.date_atelier || '')
    setHeure(atelier.heure || '')
    setLieu(atelier.lieu || '')
  }, [atelier.id, atelier.date_atelier, atelier.heure, atelier.lieu])

  const sourcesKey = atelier.sources.map(s => s.id).join(',')
  useEffect(() => {
    const ids = atelier.sources.map(s => s.id)
    setOrdre(prev => {
      const conserves = prev.filter(id => ids.includes(id))
      const nouveaux = ids.filter(id => !conserves.includes(id))
      return [...conserves, ...nouveaux]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atelier.id, sourcesKey])

  const [overlay, setOverlay] = useState<CarteMin | null>(null)
  const [vivierDragId, setVivierDragId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Mobile : court delai avant capture pour distinguer le glisser du scroll tactile.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    // Clavier : reordonner au clavier (accessibilite).
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const dejaRetenues = useMemo(() => new Set(atelier.sources.map(s => s.id)), [atelier.sources])
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

    if (activeId.startsWith('vivier-')) {
      const s = event.active.data.current?.source as VivierSource | undefined
      const surCorpus = event.over?.id === ZONE_CORPUS || String(event.over?.id ?? '').startsWith('corpus-')
      if (s && surCorpus && !dejaRetenues.has(s.id)) {
        void onAjouter(atelier.id, s.id)
      }
      return
    }

    if (activeId.startsWith('corpus-') && event.over) {
      const overId = String(event.over.id)
      if (overId.startsWith('corpus-') && activeId !== overId) {
        const from = ordre.indexOf(Number(activeId.replace('corpus-', '')))
        const to = ordre.indexOf(Number(overId.replace('corpus-', '')))
        if (from !== -1 && to !== -1) {
          const nouvelOrdre = arrayMove(ordre, from, to)
          setOrdre(nouvelOrdre)
          void api.patch(`/ateliers/${atelier.id}/sources/order`, { source_ids: nouvelOrdre })
        }
      }
    }
  }

  const enCoursDeDrag = overlay !== null

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="prep-barre">
        {ateliers.length > 1 ? (
          <label className="prep-barre-bloc">
            <span>Atelier préparé</span>
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
            <span>Atelier préparé</span>
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

      <ProfilDiversitePanneau
        atelierId={atelier.id}
        sourcesKey={sourcesKey}
        vivierParId={vivierParId}
        isFacilitateur={isFacilitateur}
        onAjouter={(sid) => { if (!dejaRetenues.has(sid)) void onAjouter(atelier.id, sid) }}
      />

      <div className="prep-board">
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

        <PrepColonneCorpus
          sources={atelier.sources}
          ordre={ordre}
          isFacilitateur={isFacilitateur}
          enCoursDeDrag={enCoursDeDrag}
          onRetirer={(id) => { void onRetirer(atelier.id, id) }}
        />
      </div>

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

// Export nommé pour Atelier.tsx
export { PreparationBoard as PreparationBoardExport }

/* ============================================================================
 * STEPPER de jalons factuels (GET /ateliers/:id)
 * ========================================================================== */

function AtelierStepper({ atelierId, refreshKey }: { atelierId: number; refreshKey: string }) {
  const [jalons, setJalons] = useState<AtelierJalons | null>(null)
  useEffect(() => {
    let actif = true
    api.get<{ jalons?: AtelierJalons }>(`/ateliers/${atelierId}`)
      .then((d) => { if (actif) setJalons(d.jalons ?? null) })
      .catch(() => { if (actif) setJalons(null) })
    return () => { actif = false }
  }, [atelierId, refreshKey])

  if (!jalons) return null
  const etapes: Etape[] = [
    { cle: 'corpus', label: 'Corpus', fait: jalons.a_corpus,
      invitation: 'composer un corpus de sources' },
    { cle: 'source', label: 'Source de séance', fait: jalons.a_source_choisie,
      invitation: 'choisir la source à projeter' },
    { cle: 'meca', label: 'Mécanismes', fait: jalons.a_mecanismes,
      invitation: 'noter les mécanismes identifiés par le groupe' },
    { cle: 'synthese', label: 'Synthèse', fait: jalons.a_synthese,
      invitation: 'saisir la synthèse de la séance' },
    { cle: 'termine', label: 'Terminé', fait: jalons.est_termine,
      invitation: 'marquer l\'atelier comme terminé' },
  ]
  return <EtapesActivite etapes={etapes} titreFin="La séance est complète. Sa synthèse peut nourrir un dossier ou un quiz." />
}

// Export nommé pour Atelier.tsx
export { AtelierStepper as AtelierStepperExport }

/* ============================================================================
 * EN COURS : pilotage de l'atelier (statut + projection + corpus + synthèse)
 * ========================================================================== */

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

export interface EnCoursPiloteProps {
  atelier: AtelierDetail
  isFacilitateur: boolean
  onChangeStatut: (atelierId: number, statut: string) => Promise<void> | void
  onSaveSynthese: (atelierId: number, fields: Record<string, unknown>) => Promise<void> | void
  onTerminer: (atelierId: number) => Promise<void> | void
  modeInitial?: 'synthese'
}

function EnCoursPilote({ atelier, isFacilitateur, onChangeStatut, onSaveSynthese, onTerminer }: EnCoursPiloteProps) {
  const nbSources = atelier.sources.length
  const projectionDispo = nbSources > 0
  const stepperKey = `${atelier.statut}:${nbSources}:${(atelier.mecanismes_identifies ?? []).length}`

  return (
    <div className="encours-grille">
      <AtelierStepper atelierId={atelier.id} refreshKey={stepperKey} />
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
            Aucune source dans le corpus. Complétez la préparation avant de projeter.
          </p>
        )}
      </div>

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

      {isFacilitateur && (
        <EnCoursSynthese atelier={atelier} onSave={onSaveSynthese} />
      )}
    </div>
  )
}

// Export nommé pour Atelier.tsx
export { EnCoursPilote as EnCoursPiloteExport }
