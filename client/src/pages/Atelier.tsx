/**
 * Atelier.tsx — page objet d'un atelier (route /ateliers/:id).
 *
 * Un seul atelier, tout au même endroit : fil d'Ariane, fiche d'identité,
 * stepper de jalons factuels, onglets PRÉPARATION / PILOTAGE / SYNTHÈSE,
 * lien vers la projection, clôture.
 *
 * Les composants lourds sont réutilisés depuis Ateliers.tsx via des exports
 * nommés : AtelierStepperExport, EnCoursPiloteExport, PreparationBoardExport.
 * Aucun endpoint inventé : tout passe par les routes serveur existantes.
 *
 * DARK-SAFE : uniquement des tokens --color-* / --space-* / --radius-*.
 * Jamais de texte rouge sur fond sombre.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../store/useAuth'
import {
  AtelierStepperExport,
  EnCoursPiloteExport,
  PreparationBoardExport,
  type VivierSource,
  type TriVivier,
} from './Ateliers'
import type { AtelierDetail } from '../types'
import '../styles/ateliers-prep.css'
import '../styles/ateliers-encours.css'
import '../styles/slider-saisie.css'
import '../styles/atelier-objet.css'

type OngletAtelier = 'preparation' | 'pilotage' | 'synthese'

export default function Atelier() {
  const { id } = useParams<{ id: string }>()

  const idNum = id ? parseInt(id, 10) : NaN

  // Garde numérique : si on reçoit une valeur non numérique, on redirige.
  // (La route /ateliers/vivier est déclarée AVANT /ateliers/:id dans App.tsx,
  //  donc "vivier" n'arrivera jamais ici.)
  if (isNaN(idNum)) return <Navigate to="/ateliers" replace />

  return <AtelierObjt id={idNum} />
}

function AtelierObjt({ id }: { id: number }) {
  const user = useAuth((s) => s.user)
  const isFacilitateur = user?.role === 'animateur' || user?.role === 'admin'

  const [atelier, setAtelier] = useState<AtelierDetail | null>(null)
  const [vivier, setVivier] = useState<VivierSource[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Onglet actif (Préparation par défaut)
  const [onglet, setOnglet] = useState<OngletAtelier>('preparation')

  // Filtres vivier (pour le board de préparation intégré dans cet objet)
  const [tri, setTri] = useState<TriVivier>('recence')
  const [qualityOnly, setQualityOnly] = useState(false)

  const fetchAtelier = useCallback(async () => {
    try {
      const [a, v] = await Promise.all([
        api.get<AtelierDetail>(`/ateliers/${id}`),
        api.get<VivierSource[]>('/ateliers/vivier'),
      ])
      setAtelier(a)
      setVivier(v)
      setNotFound(false)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void fetchAtelier() }, [fetchAtelier])

  // Vivier filtré et trié (même logique que dans Ateliers.tsx)
  const vivierFiltre = useMemo(() => {
    const filtre = vivier.filter((s) => !qualityOnly || s.quality_gate.ok)
    const trie = [...filtre]
    if (tri === 'fraicheur') {
      trie.sort((a, b) => (b.facettes?.fraicheur ?? 0) - (a.facettes?.fraicheur ?? 0))
    } else {
      // tri === 'recence' (par défaut) — D2 : tri 'score' retiré.
      trie.sort((a, b) => String(b.soumis_le ?? '').localeCompare(String(a.soumis_le ?? '')))
    }
    return trie
  }, [vivier, tri, qualityOnly])

  /* ---- Actions (réutilisent les endpoints existants) ---- */

  const ajouterSource = async (atelierId: number, sourceId: number) => {
    await api.post(`/ateliers/${atelierId}/sources`, { source_id: sourceId })
    await fetchAtelier()
  }

  const retirerSource = async (atelierId: number, sourceId: number) => {
    await api.delete(`/ateliers/${atelierId}/sources/${sourceId}`)
    await fetchAtelier()
  }

  const sauvegarderAtelier = async (a: AtelierDetail, fields: Record<string, unknown>) => {
    await api.patch(`/ateliers/${a.id}`, fields)
    await fetchAtelier()
  }

  const changerStatut = async (atelierId: number, statut: string) => {
    await api.patch(`/ateliers/${atelierId}`, { statut })
    await fetchAtelier()
  }

  const terminerAtelier = async (atelierId: number) => {
    if (!window.confirm('Cloturer cet atelier ? Il passera en archive (Preparation et Pilotage seront masques).')) return
    await api.patch(`/ateliers/${atelierId}`, { statut: 'termine' })
    await fetchAtelier()
  }

  const enregistrerSynthese = async (atelierId: number, fields: Record<string, unknown>) => {
    await api.post(`/ateliers/${atelierId}/synthese`, fields)
    await fetchAtelier()
  }

  /* ---- États de chargement ---- */

  if (loading) return (
    <div className="page-atelier-objet">
      <p className="loading">Chargement...</p>
    </div>
  )

  if (notFound || !atelier) return (
    <div className="page-atelier-objet">
      <p className="empty">
        Atelier introuvable. <Link to="/ateliers">Retour à la liste</Link>
      </p>
    </div>
  )

  const estActif = atelier.statut !== 'termine'
  const stepperKey = `${atelier.statut}:${atelier.sources.length}:${(atelier.mecanismes_identifies ?? []).length}`

  const dateStr = atelier.date_atelier
    ? new Date(atelier.date_atelier).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div className="page-atelier-objet">

      {/* ---- Fil d'Ariane ---- */}
      <nav className="atelier-objet-ariane" aria-label="Fil d'Ariane">
        <Link to="/ateliers">Ateliers</Link>
        <span aria-hidden="true"> / </span>
        <span>Atelier #{atelier.numero}</span>
      </nav>

      {/* ---- En-tête ---- */}
      <div className="atelier-objet-entete">
        <div className="atelier-objet-tete">
          <h2 className="atelier-objet-titre">
            Atelier #{atelier.numero}
            {dateStr && (
              <span className="atelier-objet-date">
                {' '}&ndash;{' '}{dateStr}
                {atelier.heure ? ` à ${atelier.heure}` : ''}
              </span>
            )}
          </h2>
        </div>
        <div className="atelier-objet-meta">
          {atelier.lieu && (
            <span className="atelier-objet-lieu">{atelier.lieu}</span>
          )}
          <span className={`encours-statut encours-statut--${atelier.statut}`}>
            {STATUT_LABELS[atelier.statut] ?? atelier.statut}
          </span>
          <span className="atelier-objet-nb-sources">
            {atelier.sources.length} source{atelier.sources.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ---- Stepper de jalons (factuel, non bloquant) ---- */}
      <div className="atelier-objet-stepper">
        <AtelierStepperExport atelierId={atelier.id} refreshKey={stepperKey} />
      </div>

      {/* ---- Onglets internes (uniquement pour les ateliers actifs) ---- */}
      {estActif && (
        <nav className="atelier-objet-onglets" role="tablist" aria-label="Sections de l'atelier">
          <OngletBtn
            actif={onglet === 'preparation'}
            label="Préparation"
            onClick={() => setOnglet('preparation')}
          />
          <OngletBtn
            actif={onglet === 'pilotage'}
            label="Pilotage"
            onClick={() => setOnglet('pilotage')}
          />
          <OngletBtn
            actif={onglet === 'synthese'}
            label="Synthèse"
            onClick={() => setOnglet('synthese')}
          />
        </nav>
      )}

      {/* ---- Onglet PRÉPARATION ---- */}
      {estActif && onglet === 'preparation' && (
        <section className="atelier-objet-section">
          <PreparationBoardExport
            ateliers={[atelier]}
            vivier={vivierFiltre}
            prepAtelierId={atelier.id}
            isFacilitateur={isFacilitateur}
            tri={tri}
            qualityOnly={qualityOnly}
            onChangeAtelier={() => { /* un seul atelier dans la vue objet */ }}
            onChangeTri={setTri}
            onChangeQualityOnly={setQualityOnly}
            onAjouter={ajouterSource}
            onRetirer={retirerSource}
            onSave={sauvegarderAtelier}
          />
        </section>
      )}

      {/* ---- Onglet PILOTAGE ---- */}
      {estActif && onglet === 'pilotage' && (
        <section className="atelier-objet-section">
          <EnCoursPiloteExport
            atelier={atelier}
            isFacilitateur={isFacilitateur}
            onChangeStatut={changerStatut}
            onSaveSynthese={enregistrerSynthese}
            onTerminer={terminerAtelier}
          />
        </section>
      )}

      {/* ---- Onglet SYNTHÈSE ---- */}
      {estActif && onglet === 'synthese' && (
        <section className="atelier-objet-section">
          <EnCoursPiloteExport
            atelier={atelier}
            isFacilitateur={isFacilitateur}
            onChangeStatut={changerStatut}
            onSaveSynthese={enregistrerSynthese}
            onTerminer={terminerAtelier}
          />
        </section>
      )}

      {/* ---- Atelier terminé : vue complète en lecture ---- */}
      {!estActif && (
        <section className="atelier-objet-section atelier-objet-section--archive">
          <EnCoursPiloteExport
            atelier={atelier}
            isFacilitateur={isFacilitateur}
            onChangeStatut={changerStatut}
            onSaveSynthese={enregistrerSynthese}
            onTerminer={terminerAtelier}
          />
        </section>
      )}
    </div>
  )
}

const STATUT_LABELS: Record<string, string> = {
  preparation: 'En préparation',
  pret: 'Prêt',
  en_cours: 'En cours',
  termine: 'Terminé',
}

function OngletBtn({
  actif,
  label,
  onClick,
}: {
  actif: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={actif}
      className={`atelier-objet-onglet${actif ? ' atelier-objet-onglet--actif' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
