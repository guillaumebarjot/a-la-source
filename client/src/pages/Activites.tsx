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

/** Formats de création : point d'entrée unifié vers chaque page de création. */
interface CarteCreation {
  cle: string
  titre: string
  usage: string // une phrase sur l'usage pédagogique
  to: string
  ill: string
}

const CREATIONS: CarteCreation[] = [
  {
    cle: 'creer-atelier',
    titre: 'Atelier',
    usage: "Une seance collective ou l'on decrypte ensemble une source et l'on nomme ses mecanismes.",
    to: '/ateliers/preparation',
    ill: 'A',
  },
  {
    cle: 'creer-dossier',
    titre: 'Dossier',
    usage: "Le fond d'un theme media, monte piece par piece avec ses sources.",
    to: '/dossiers',
    ill: 'D',
  },
  {
    cle: 'creer-decryptage',
    titre: 'Decryptage a chaud',
    usage: "Un dossier date, monte a chaud sur un evenement recent (meme page que le dossier, simple bascule a chaud).",
    to: '/dossiers',
    ill: 'C',
  },
  {
    cle: 'creer-debunkage',
    titre: 'Debunkage',
    usage: "On vise une affirmation precise, on la demonte avec des sources, on publie le resultat.",
    to: '/debunkages',
    ill: 'B',
  },
  {
    cle: 'creer-parcours',
    titre: 'Parcours / quiz',
    usage: "Un cursus d'exercices pour s'entrainer a reconnaitre les mecanismes mediatiques.",
    to: '/parcours',
    ill: 'P',
  },
  {
    cle: 'creer-arpentage',
    titre: 'Arpentage',
    usage: "Une lecture collective fragmentee : on decoupe un document, chacun lit un morceau, on synthetise.",
    to: '/arpentages',
    ill: 'R',
  },
]

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
  {
    cle: 'arpentages',
    titre: 'Arpentages',
    accroche: "Une lecture collective fragmentee : on decoupe un document, chacun lit un morceau, on synthetise ensemble.",
    to: '/arpentages',
    ill: 'R',
  },
]

export default function Activites() {
  const [etat, setEtat] = useState<Etat>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const charger = async () => {
      const [ateliers, dossiers, debunkages, parcours, arpentages] = await Promise.all([
        api.get<unknown[]>('/ateliers').catch(() => []),
        api.get<DossierListItem[]>('/dossiers').catch(() => []),
        api.get<unknown[]>('/debunkages').catch(() => []),
        api.get<unknown[]>('/parcours').catch(() => []),
        api.get<unknown[]>('/arpentages').catch(() => []),
      ])
      setEtat({
        ateliers: { nb: ateliers.length },
        dossiers: { nb: dossiers.length, nbChaud: dossiers.filter((d) => !!d.a_chaud).length },
        debunkages: { nb: debunkages.length },
        parcours: { nb: parcours.length },
        arpentages: { nb: arpentages.length },
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

      <section className="creer-activite" aria-labelledby="creer-activite-titre">
        <h2 id="creer-activite-titre" className="creer-activite-titre">Creer une activite</h2>
        <p className="creer-activite-intro">
          Choisissez un format. Chaque carte mene directement a sa page de creation.
        </p>
        <div className="creer-activite-grid">
          {CREATIONS.map((c) => (
            <Link key={c.cle} to={c.to} className="creer-carte">
              <div className="creer-carte-visuel" aria-hidden="true">
                <span className="creer-carte-initiale">{c.ill}</span>
              </div>
              <div className="creer-carte-body">
                <h3 className="creer-carte-titre">{c.titre}</h3>
                <p className="creer-carte-usage">{c.usage}</p>
                <span className="creer-carte-cta">Creer</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <h2 className="activites-section-titre">Toutes les activites</h2>

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
