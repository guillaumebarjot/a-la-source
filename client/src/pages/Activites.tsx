import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { DossierListItem } from '../types/dossier'
import '../styles/activites.css'

/**
 * Hub des activités — la vitrine « éducation populaire » de l'app.
 *
 * Présente en sections (cartes + compteurs + liens) toutes les activités de
 * Rouge Coquelicot : ateliers, dossiers & décryptages, débunkages, parcours.
 * Chaque carte est une image-titre menant à l'activité. On s'appuie sur les API
 * existantes pour les compteurs (un appel léger par activité).
 */

interface CompteRendu { nb: number; nbChaud?: number }

type Etat = Record<string, CompteRendu | undefined>

interface CarteActivite {
  cle: string
  titre: string
  accroche: string
  to: string
  ill: string // initiale ou pictogramme texte (image-titre sobre, sans dépendance)
}

const CARTES: CarteActivite[] = [
  {
    cle: 'ateliers',
    titre: 'Ateliers',
    accroche: "Des seances collectives pour decrypter ensemble une source et nommer ses mecanismes.",
    to: '/ateliers',
    ill: 'A',
  },
  {
    cle: 'dossiers',
    titre: 'Dossiers & decryptages',
    accroche: "Le fond sur un theme, et le decryptage a chaud d'un evenement, sources a l'appui.",
    to: '/dossiers',
    ill: 'D',
  },
  {
    cle: 'debunkages',
    titre: 'Debunkages',
    accroche: "On vise une affirmation, on demontre avec des sources, on publie le resultat.",
    to: '/debunkages',
    ill: 'B',
  },
  {
    cle: 'parcours',
    titre: 'Parcours',
    accroche: "Des cursus d'apprentissage pour s'exercer a reconnaitre les mecanismes mediatiques.",
    to: '/parcours',
    ill: 'P',
  },
]

export default function Activites() {
  const [etat, setEtat] = useState<Etat>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const charger = async () => {
      const [ateliers, dossiers, debunkages, parcours] = await Promise.all([
        api.get<unknown[]>('/ateliers').catch(() => []),
        api.get<DossierListItem[]>('/dossiers').catch(() => []),
        api.get<unknown[]>('/debunkages').catch(() => []),
        api.get<unknown[]>('/parcours').catch(() => []),
      ])
      setEtat({
        ateliers: { nb: ateliers.length },
        dossiers: { nb: dossiers.length, nbChaud: dossiers.filter((d) => !!d.a_chaud).length },
        debunkages: { nb: debunkages.length },
        parcours: { nb: parcours.length },
      })
      setLoading(false)
    }
    charger()
  }, [])

  return (
    <div className="activites-page">
      <header className="activites-header">
        <h1>Les activites d'education populaire</h1>
        <p className="activites-intro">
          A la source outille l'education populaire aux medias de Rouge Coquelicot. Chaque activite
          est un atelier-outil pose sur un substrat commun de sources et de mecanismes. On y entre
          par les themes ; la critique des medias s'appuie sur Acrimed.
        </p>
      </header>

      <div className="activites-grid">
        {CARTES.map((c) => {
          const stat = etat[c.cle]
          return (
            <Link key={c.cle} to={c.to} className="activite-carte">
              <div className="activite-carte-visuel" aria-hidden="true">
                <span className="activite-carte-initiale">{c.ill}</span>
              </div>
              <div className="activite-carte-body">
                <h2 className="activite-carte-titre">{c.titre}</h2>
                <p className="activite-carte-accroche">{c.accroche}</p>
                <div className="activite-carte-meta">
                  {loading ? (
                    <span className="activite-compteur">...</span>
                  ) : (
                    <>
                      <span className="activite-compteur">
                        {stat?.nb ?? 0} {stat?.nb === 1 ? 'entree' : 'entrees'}
                      </span>
                      {c.cle === 'dossiers' && !!stat?.nbChaud && (
                        <span className="activite-compteur chaud">{stat.nbChaud} a chaud</span>
                      )}
                    </>
                  )}
                  <span className="activite-lien">Ouvrir</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
