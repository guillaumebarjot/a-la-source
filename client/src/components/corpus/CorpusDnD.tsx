import { useState, useEffect, useMemo, type ReactNode } from 'react'
import SourceImage from '../cards/SourceImage'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import '../../styles/corpus-dnd.css'

/**
 * CorpusDnD — composer un corpus de sources par glisser-deposer, reutilisable.
 *
 * Patron commun (extrait de Sujet/Ateliers) : a gauche le vivier de cartes
 * candidates (draggables), a droite la zone de depot du corpus (avec, en option,
 * un reordonnancement persiste via `onReorder`). Un bouton « + » / « Retirer »
 * reste en repli accessible. Variantes de carte gerees par le slot `renderExtra`.
 *
 * La source reste « une carte qu'on promene » : image + titre, jamais de score.
 */

export interface CorpusCarte {
  id: number
  titre: string
  image_url?: string | null
  media_nom?: string | null
}

export interface CorpusDnDProps {
  vivier: CorpusCarte[]
  corpus: CorpusCarte[]
  onAdd: (sourceId: number) => void | Promise<void>
  onRemove: (sourceId: number) => void | Promise<void>
  /** Si fourni, le corpus est reordonnable et l'ordre est remonte (a persister). */
  onReorder?: (orderedIds: number[]) => void | Promise<void>
  titreVivier?: string
  titreCorpus?: string
  videVivier?: string
  videCorpus?: string
  /** Contenu additionnel par carte du corpus (selecteur de role, badges...). */
  renderExtra?: (carte: CorpusCarte) => ReactNode
  /** Si fourni, le visuel d'une carte du corpus pointe vers cette URL (ex. lecture). */
  lienSource?: (id: number) => string
  readOnly?: boolean
}

const ZONE = 'corpus-zone'

function Visuel({ carte }: { carte: CorpusCarte }) {
  return (
    <SourceImage
      src={carte.image_url}
      fallback={<span className="corpusdnd-initiale">{(carte.media_nom || carte.titre).charAt(0)}</span>}
    />
  )
}

function CarteVivier({ carte, onAdd, dejaPresente, enDrag, readOnly }: {
  carte: CorpusCarte
  onAdd: (id: number) => void
  dejaPresente: boolean
  enDrag: boolean
  readOnly: boolean
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `vivier-${carte.id}`,
    data: { carte },
    disabled: dejaPresente || readOnly,
  })
  return (
    <div
      ref={setNodeRef}
      className={`corpusdnd-card corpusdnd-card--vivier${dejaPresente ? ' corpusdnd-card--prise' : ''}${enDrag ? ' corpusdnd-card--dragging' : ''}`}
      {...(dejaPresente || readOnly ? {} : attributes)}
      {...(dejaPresente || readOnly ? {} : listeners)}
    >
      <div className="corpusdnd-visuel"><Visuel carte={carte} /></div>
      <div className="corpusdnd-body">
        <h4 className="corpusdnd-titre">{carte.titre}</h4>
        {carte.media_nom && <span className="corpusdnd-media">{carte.media_nom}</span>}
        {dejaPresente
          ? <span className="corpusdnd-deja">déjà dans le corpus</span>
          : !readOnly && <button type="button" className="btn btn-sm btn-primary" onClick={() => onAdd(carte.id)}>+ Ajouter</button>}
      </div>
    </div>
  )
}

function CarteCorpus({ carte, onRemove, sortable, renderExtra, lienSource, readOnly }: {
  carte: CorpusCarte
  onRemove: (id: number) => void
  sortable: boolean
  renderExtra?: (c: CorpusCarte) => ReactNode
  lienSource?: (id: number) => string
  readOnly: boolean
}) {
  const s = useSortable({ id: `corpus-${carte.id}`, disabled: !sortable || readOnly })
  const style = sortable ? {
    transform: s.transform ? `translate3d(${s.transform.x}px, ${s.transform.y}px, 0)` : undefined,
    transition: s.transition,
    opacity: s.isDragging ? 0.5 : undefined,
  } : undefined
  return (
    <div ref={sortable ? s.setNodeRef : undefined} style={style} className="corpusdnd-card corpusdnd-card--corpus">
      {sortable && !readOnly && (
        <span className="corpusdnd-poignee" {...s.attributes} {...s.listeners} title="Glisser pour réordonner">⠿</span>
      )}
      {lienSource
        ? <a className="corpusdnd-visuel" href={lienSource(carte.id)}><Visuel carte={carte} /></a>
        : <div className="corpusdnd-visuel"><Visuel carte={carte} /></div>}
      <div className="corpusdnd-body">
        <h4 className="corpusdnd-titre">{carte.titre}</h4>
        {carte.media_nom && <span className="corpusdnd-media">{carte.media_nom}</span>}
        {renderExtra?.(carte)}
        {!readOnly && <button type="button" className="corpusdnd-retirer" onClick={() => onRemove(carte.id)}>Retirer</button>}
      </div>
    </div>
  )
}

export default function CorpusDnD({
  vivier, corpus, onAdd, onRemove, onReorder,
  titreVivier = 'Vivier', titreCorpus = 'Corpus',
  videVivier = 'Aucune source disponible.', videCorpus = 'Glissez des cartes ici, ou « + Ajouter ».',
  renderExtra, lienSource, readOnly = false,
}: CorpusDnDProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Mobile : court delai avant capture pour distinguer le glisser du scroll tactile.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    // Clavier : reordonner au clavier (accessibilite).
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const reorderable = !!onReorder && !readOnly

  // Ordre local du corpus (rendu), resynchronise quand la liste change.
  const [ordre, setOrdre] = useState<number[]>(corpus.map(c => c.id))
  const corpusKey = corpus.map(c => c.id).join(',')
  useEffect(() => {
    const ids = corpus.map(c => c.id)
    setOrdre(prev => {
      const conserves = prev.filter(id => ids.includes(id))
      const nouveaux = ids.filter(id => !conserves.includes(id))
      return [...conserves, ...nouveaux]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corpusKey])

  const parId = useMemo(() => new Map(corpus.map(c => [c.id, c])), [corpus])
  const corpusOrdonne = ordre.map(id => parId.get(id)).filter((c): c is CorpusCarte => !!c)
  const presentes = useMemo(() => new Set(corpus.map(c => c.id)), [corpus])

  const [overlay, setOverlay] = useState<CorpusCarte | null>(null)
  const [vivierDragId, setVivierDragId] = useState<number | null>(null)

  const { setNodeRef: setZoneRef, isOver } = useDroppable({ id: ZONE })
  let zoneClasse = 'corpusdnd-zone'
  if (isOver) zoneClasse += ' corpusdnd-zone--over'
  else if (overlay) zoneClasse += ' corpusdnd-zone--armed'

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id)
    if (id.startsWith('vivier-')) {
      const c = e.active.data.current?.carte as CorpusCarte | undefined
      setOverlay(c ?? null); setVivierDragId(c?.id ?? null)
    } else if (id.startsWith('corpus-')) {
      setOverlay(parId.get(Number(id.replace('corpus-', ''))) ?? null)
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id)
    setOverlay(null); setVivierDragId(null)
    if (activeId.startsWith('vivier-')) {
      const c = e.active.data.current?.carte as CorpusCarte | undefined
      const surCorpus = e.over?.id === ZONE || String(e.over?.id ?? '').startsWith('corpus-')
      if (c && surCorpus && !presentes.has(c.id)) void onAdd(c.id)
      return
    }
    if (reorderable && activeId.startsWith('corpus-') && e.over) {
      const overId = String(e.over.id)
      if (overId.startsWith('corpus-') && activeId !== overId) {
        const from = ordre.indexOf(Number(activeId.replace('corpus-', '')))
        const to = ordre.indexOf(Number(overId.replace('corpus-', '')))
        if (from !== -1 && to !== -1) {
          const nouvel = arrayMove(ordre, from, to)
          setOrdre(nouvel)
          void onReorder!(nouvel)
        }
      }
    }
  }

  const candidates = vivier
  const corpusIds = corpusOrdonne.map(c => `corpus-${c.id}`)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="corpusdnd">
        <div className="corpusdnd-colonne">
          <h3 className="corpusdnd-colonne-titre">{titreVivier}</h3>
          {candidates.length === 0
            ? <p className="empty">{videVivier}</p>
            : <div className="corpusdnd-liste">
                {candidates.map(c => (
                  <CarteVivier key={c.id} carte={c} onAdd={onAdd} dejaPresente={presentes.has(c.id)} enDrag={vivierDragId === c.id} readOnly={readOnly} />
                ))}
              </div>}
        </div>

        <div className="corpusdnd-colonne">
          <h3 className="corpusdnd-colonne-titre">{titreCorpus} ({corpusOrdonne.length})</h3>
          <div ref={setZoneRef} className={zoneClasse}>
            {corpusOrdonne.length === 0
              ? <p className="empty">{videCorpus}</p>
              : reorderable
                ? <SortableContext items={corpusIds} strategy={verticalListSortingStrategy}>
                    <div className="corpusdnd-liste">
                      {corpusOrdonne.map(c => (
                        <CarteCorpus key={c.id} carte={c} onRemove={onRemove} sortable renderExtra={renderExtra} lienSource={lienSource} readOnly={readOnly} />
                      ))}
                    </div>
                  </SortableContext>
                : <div className="corpusdnd-liste">
                    {corpusOrdonne.map(c => (
                      <CarteCorpus key={c.id} carte={c} onRemove={onRemove} sortable={false} renderExtra={renderExtra} lienSource={lienSource} readOnly={readOnly} />
                    ))}
                  </div>}
            {overlay && <p className="corpusdnd-invite">{isOver ? 'Relâchez pour ajouter au corpus' : 'Déposez la carte ici'}</p>}
          </div>
        </div>
      </div>

      <DragOverlay>
        {overlay ? (
          <div className="corpusdnd-card corpusdnd-card--overlay">
            <div className="corpusdnd-visuel"><Visuel carte={overlay} /></div>
            <div className="corpusdnd-body">
              <h4 className="corpusdnd-titre">{overlay.titre}</h4>
              {overlay.media_nom && <span className="corpusdnd-media">{overlay.media_nom}</span>}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
