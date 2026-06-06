import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { api } from '../api/client'
import type { SujetDetail, Source } from '../types'
import '../styles/sujet-dnd.css'

/**
 * Page Sujet — détail d'un thème. Recompose, sous l'angle du sujet, des briques
 * du socle : la couverture (événements multisourcés, geste GroundNews) et les
 * sources (veille). On peut rattacher des cartes-sources de la veille au sujet.
 *
 * Rattachement de deux façons, équivalentes :
 *  - glisser-déposer (dnd-kit) : on attrape une carte candidate et on la promène
 *    jusqu'à la zone Sources du sujet pour la déposer ;
 *  - bouton « + Rattacher » (fallback accessible, conservé).
 */

// Identifiant stable de la zone de dépôt (le bloc Sources du sujet).
const ZONE_SUJET = 'zone-sujet'

/** Forme minimale partagée par Source (veille) et SujetSource (rattachée). */
type CarteSource = { titre: string; image_url: string | null; media_nom?: string | null }

/** Visuel d'une carte-source, réutilisé tel quel par la carte et par l'overlay. */
function CarteVisuel({ source }: { source: CarteSource }) {
  return source.image_url
    ? <img src={source.image_url} alt="" loading="lazy" />
    : <span className="sujet-source-initiale">{(source.media_nom || source.titre).charAt(0)}</span>
}

/**
 * Carte candidate draggable. On garde le bouton « + Rattacher » en fallback ;
 * les écouteurs de drag sont posés sur la carte, pas sur le bouton, pour ne pas
 * gêner le clic.
 */
function CarteCandidate({
  source,
  onRattacher,
  enDrag,
}: {
  source: Source
  onRattacher: (id: number) => void
  enDrag: boolean
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `source-${source.id}`,
    data: { source },
  })

  return (
    <div
      ref={setNodeRef}
      className={`sujet-source-card sujet-source-card--draggable${enDrag ? ' sujet-source-card--dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className="sujet-source-card-poignee">⠿ à promener vers le sujet</span>
      <div className="sujet-source-visuel">
        <CarteVisuel source={source} />
      </div>
      <div className="sujet-source-body">
        <h3 className="sujet-source-titre">{source.titre}</h3>
        {source.media_nom && <span className="sujet-source-media">{source.media_nom}</span>}
        <button className="btn btn-sm btn-primary" onClick={() => onRattacher(source.id)} type="button">+ Rattacher</button>
      </div>
    </div>
  )
}

export default function Sujet() {
  const { slug } = useParams<{ slug: string }>()
  const [sujet, setSujet] = useState<SujetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(false)

  // Panneau d'ajout de sources (rattachement veille -> sujet)
  const [ajout, setAjout] = useState(false)
  const [veille, setVeille] = useState<Source[]>([])

  // Source actuellement promenée (pour le DragOverlay).
  const [sourceEnDrag, setSourceEnDrag] = useState<Source | null>(null)

  // Un petit seuil de déplacement évite que le clic sur « + Rattacher »
  // ou « Détacher » ne déclenche un drag par mégarde.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const loadSujet = useCallback(() => {
    if (!slug) return
    return api.get<SujetDetail>(`/sujets/${slug}`)
      .then(setSujet)
      .catch(() => setErreur(true))
  }, [slug])

  useEffect(() => {
    setLoading(true)
    Promise.resolve(loadSujet()).finally(() => setLoading(false))
  }, [loadSujet])

  function ouvrirAjout() {
    setAjout(true)
    api.get<Source[]>('/sources?limit=40').then(setVeille).catch(() => setVeille([]))
  }

  async function rattacher(sourceId: number) {
    if (!sujet) return
    await api.post(`/sujets/${sujet.id}/sources`, { source_id: sourceId })
    await loadSujet()
  }

  async function detacher(sourceId: number) {
    if (!sujet) return
    await api.delete(`/sujets/${sujet.id}/sources/${sourceId}`)
    await loadSujet()
  }

  function onDragStart(event: DragStartEvent) {
    const source = event.active.data.current?.source as Source | undefined
    setSourceEnDrag(source ?? null)
  }

  function onDragEnd(event: DragEndEvent) {
    const source = event.active.data.current?.source as Source | undefined
    setSourceEnDrag(null)
    // Déposé sur la zone Sources du sujet -> on rattache.
    if (event.over?.id === ZONE_SUJET && source) {
      void rattacher(source.id)
    }
  }

  if (loading) return <div className="loading">Chargement du sujet...</div>
  if (erreur || !sujet) return (
    <div className="sujet-page">
      <p className="empty">Sujet introuvable. <Link to="/sujets">Retour aux sujets</Link></p>
    </div>
  )

  const dejaRattachees = new Set(sujet.sources.map((s) => s.id))
  const candidates = veille.filter((s) => !dejaRattachees.has(s.id))
  const enCoursDeDrag = sourceEnDrag !== null

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="sujet-page">
        <Link to="/sujets" className="sujet-retour">← Sujets</Link>

        <header className="sujet-detail-header">
          <h1>{sujet.titre}</h1>
          {sujet.accroche && <p className="sujet-detail-accroche">{sujet.accroche}</p>}
          {sujet.provenance && (
            <p className="sujet-detail-provenance">Provenance : {sujet.provenance}</p>
          )}
        </header>

        {sujet.description_md && (
          <section className="sujet-detail-section">
            <p>{sujet.description_md}</p>
          </section>
        )}

        <section className="sujet-detail-section">
          <h2>Couverture ({sujet.evenements.length})</h2>
          {sujet.evenements.length === 0 ? (
            <p className="empty">Aucun événement rattaché à ce sujet.</p>
          ) : (
            <ul className="sujet-evenements">
              {sujet.evenements.map((e) => (
                <li key={e.id} className="sujet-evenement">
                  <Link to="/observatoire/couverture">{e.titre}</Link>
                  {e.date_evenement && <span className="sujet-evenement-date"> ({e.date_evenement})</span>}
                  <span className="sujet-evenement-couv">
                    {e.nb_medias ?? 0} média{(e.nb_medias ?? 0) > 1 ? 's' : ''}
                    {(e.nb_types_propriete ?? 0) > 0 && ` · ${e.nb_types_propriete} type${(e.nb_types_propriete ?? 0) > 1 ? 's' : ''} de propriété`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <SectionSources
          sujet={sujet}
          ajout={ajout}
          candidates={candidates}
          enCoursDeDrag={enCoursDeDrag}
          sourceEnDragId={sourceEnDrag?.id ?? null}
          onToggleAjout={ajout ? () => setAjout(false) : ouvrirAjout}
          onRattacher={rattacher}
          onDetacher={detacher}
        />
      </div>

      {/* La carte promenée suit le curseur ; rendu hors flux. */}
      <DragOverlay>
        {sourceEnDrag ? (
          <div className="sujet-source-card sujet-source-card--overlay">
            <div className="sujet-source-visuel">
              <CarteVisuel source={sourceEnDrag} />
            </div>
            <div className="sujet-source-body">
              <h3 className="sujet-source-titre">{sourceEnDrag.titre}</h3>
              {sourceEnDrag.media_nom && <span className="sujet-source-media">{sourceEnDrag.media_nom}</span>}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

/**
 * Section Sources : zone de dépôt (useDroppable) pour les cartes promenées,
 * plus le panneau d'ajout listant les cartes candidates draggables.
 */
function SectionSources({
  sujet,
  ajout,
  candidates,
  enCoursDeDrag,
  sourceEnDragId,
  onToggleAjout,
  onRattacher,
  onDetacher,
}: {
  sujet: SujetDetail
  ajout: boolean
  candidates: Source[]
  enCoursDeDrag: boolean
  sourceEnDragId: number | null
  onToggleAjout: () => void
  onRattacher: (id: number) => void
  onDetacher: (id: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: ZONE_SUJET })

  let zoneClasse = 'sujet-dropzone'
  if (isOver) zoneClasse += ' sujet-dropzone--over'
  else if (enCoursDeDrag) zoneClasse += ' sujet-dropzone--armed'

  return (
    <section className="sujet-detail-section">
      <div className="sujet-section-head">
        <h2>Sources ({sujet.sources.length})</h2>
        <button className="btn btn-sm btn-secondary" onClick={onToggleAjout} type="button">
          {ajout ? 'Fermer' : 'Ajouter des sources'}
        </button>
      </div>

      <div ref={setNodeRef} className={zoneClasse}>
        {sujet.sources.length === 0 ? (
          <p className="empty">Aucune source rattachée à ce sujet pour l'instant.</p>
        ) : (
          <div className="sujet-sources-grid">
            {sujet.sources.map((s) => (
              <div key={s.id} className="sujet-source-card sujet-source-card--attachee">
                <Link to={`/lire/${s.id}`} className="sujet-source-visuel">
                  <CarteVisuel source={s} />
                </Link>
                <div className="sujet-source-body">
                  <h3 className="sujet-source-titre">{s.titre}</h3>
                  {s.media_nom && <span className="sujet-source-media">{s.media_nom}</span>}
                  <button className="sujet-source-detacher" onClick={() => onDetacher(s.id)} type="button">Détacher</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {enCoursDeDrag && (
          <p className="sujet-dropzone-invite">
            {isOver ? 'Relâchez pour rattacher la source au sujet' : 'Déposez la carte ici pour la rattacher'}
          </p>
        )}
      </div>

      {ajout && (
        <div className="sujet-ajout">
          <p className="sujet-ajout-hint">Cartes de la veille à promener vers ce sujet (ou bouton « + Rattacher ») :</p>
          {candidates.length === 0 ? (
            <p className="empty">Aucune source disponible à rattacher.</p>
          ) : (
            <div className="sujet-sources-grid">
              {candidates.map((s) => (
                <CarteCandidate
                  key={s.id}
                  source={s}
                  onRattacher={onRattacher}
                  enDrag={sourceEnDragId === s.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
