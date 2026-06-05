import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'
import type { Evenement, EvenementDetail } from '../../types'

/* ---------- Couverture multisource (Chantier C) ----------
   Met en regard plusieurs traitements d'un même fait par des médias de
   propriétés différentes. On décrit la couverture, on ne note pas. */

const TYPE_PROPRIETE_LABELS: Record<string, string> = {
  conglomerat: 'Conglomérat',
  capital_prive: 'Capital privé / milliardaire',
  groupe_industriel: 'Groupe industriel',
  public: 'Public',
  cooperative: 'Coopérative',
  associatif: 'Associatif / dons',
  independant: 'Indépendant',
  autre: 'Autre',
}

export default function Couverture() {
  const [evenements, setEvenements] = useState<Evenement[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<EvenementDetail | null>(null)
  const [nouveauTitre, setNouveauTitre] = useState('')
  const [sourceId, setSourceId] = useState('')

  const charger = useCallback(() => {
    api.get<Evenement[]>('/evenements').then(setEvenements)
  }, [])

  useEffect(() => { charger() }, [charger])

  const ouvrir = useCallback((id: number) => {
    setSelectedId(id)
    api.get<EvenementDetail>(`/evenements/${id}`).then(setDetail)
  }, [])

  const creer = useCallback(() => {
    const titre = nouveauTitre.trim()
    if (!titre) return
    api.post('/evenements', { titre }).then(() => {
      setNouveauTitre('')
      charger()
    })
  }, [nouveauTitre, charger])

  const rattacher = useCallback(() => {
    const id = Number(sourceId)
    if (!selectedId || !id) return
    api.post(`/evenements/${selectedId}/sources`, { source_id: id }).then(() => {
      setSourceId('')
      ouvrir(selectedId)
    })
  }, [selectedId, sourceId, ouvrir])

  const detacher = useCallback((srcId: number) => {
    if (!selectedId) return
    api.delete(`/evenements/${selectedId}/sources/${srcId}`).then(() => ouvrir(selectedId))
  }, [selectedId, ouvrir])

  // Vue détail d'un événement (couverture)
  if (selectedId !== null && detail) {
    const types = new Set(detail.sources.map(s => s.type_propriete).filter(Boolean))
    return (
      <section className="obs-section">
        <button className="media-detail-back" onClick={() => { setSelectedId(null); setDetail(null) }}>
          ← Retour aux événements
        </button>
        <h2>{detail.titre}</h2>
        {detail.description && <p className="media-detail-description">{detail.description}</p>}
        <p className="media-card-meta">
          {detail.sources.length} traitement(s) · {new Set(detail.sources.map(s => s.media_id).filter(Boolean)).size} média(s) · {types.size} type(s) de propriété
        </p>

        <div className="couverture-grid">
          {detail.sources.map(s => (
            <article key={s.id} className="couverture-card">
              <header className="couverture-card-media">
                <strong>{s.media_nom || 'Média inconnu'}</strong>
                {s.type_propriete && (
                  <span className="couverture-badge">{TYPE_PROPRIETE_LABELS[s.type_propriete] ?? s.type_propriete}</span>
                )}
              </header>
              {s.proprietaire && <div className="couverture-card-prop">Propriété : {s.proprietaire}</div>}
              <div className="couverture-card-titre">
                {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.titre}</a> : s.titre}
              </div>
              {s.accroche && <p className="couverture-card-accroche">{s.accroche}</p>}
              <footer className="couverture-card-foot">
                {s.date_publication && <span className="media-card-meta">{s.date_publication}</span>}
                <button className="couverture-detacher" onClick={() => detacher(s.id)}>Détacher</button>
              </footer>
            </article>
          ))}
          {detail.sources.length === 0 && (
            <p className="empty">Aucune source rattachée. Ajoutez-en une par son identifiant ci-dessous.</p>
          )}
        </div>

        <div className="couverture-attach">
          <input
            type="number"
            placeholder="ID d'une source à rattacher"
            value={sourceId}
            onChange={e => setSourceId(e.target.value)}
          />
          <button onClick={rattacher} disabled={!sourceId}>Rattacher</button>
        </div>
      </section>
    )
  }

  // Vue liste des événements
  return (
    <section className="obs-section">
      <h2>Couverture multisource</h2>
      <p className="obs-intro">
        Un événement regroupe plusieurs traitements d'un même fait. On met en regard les médias qui le couvrent, leurs propriétés et leurs angles. On décrit, on ne note pas.
      </p>

      <div className="couverture-creer">
        <input
          type="text"
          placeholder="Nouvel événement (titre du fait)"
          value={nouveauTitre}
          onChange={e => setNouveauTitre(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') creer() }}
        />
        <button onClick={creer} disabled={!nouveauTitre.trim()}>Créer</button>
      </div>

      <ul className="couverture-liste">
        {evenements.map(e => (
          <li key={e.id} className="couverture-item" onClick={() => ouvrir(e.id)}>
            <span className="couverture-item-titre">{e.titre}</span>
            <span className="media-card-meta">
              {e.nb_sources ?? 0} source(s) · {e.nb_medias ?? 0} média(s) · {e.nb_types_propriete ?? 0} type(s) de propriété
            </span>
          </li>
        ))}
        {evenements.length === 0 && <li className="empty">Aucun événement. Créez-en un ci-dessus.</li>}
      </ul>
    </section>
  )
}
