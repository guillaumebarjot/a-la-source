import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../store/useAuth'
import type { Lecture, Contributions } from '../types'
import '../styles/accueil.css'

/**
 * Accueil pédagogique.
 *
 * But : que personne ne soit jamais perdu. On explique ce qu'on fait ici, le
 * parcours d'une source, et où se déroule quoi (blocs repliables + aide au
 * survol), puis on propose de reprendre là où on en était.
 */

interface Etape {
  n: number
  titre: string
  to: string
  resume: string
  detail: string
}

const PARCOURS: Etape[] = [
  {
    n: 1, titre: 'Inbox', to: '/inbox',
    resume: 'on qualifie les sources entrantes',
    detail: "Une source arrive (proposée sur Discord ou dans l'app). On la qualifie a la carte : l'accepter, la fiabiliser (copie locale, image, accroche), la situer dans un theme, parfois reperer un mecanisme. Un score d'avancement montre ce qui reste a faire. Rien n'est bloquant, on fait ce qu'on peut.",
  },
  {
    n: 2, titre: 'Veille', to: '/veille',
    resume: 'on lit les sources qualifiees',
    detail: "Le flux des sources pretes. On lit, on commente, on peut ranger une source dans un dossier. C'est le quotidien partage de la veille.",
  },
  {
    n: 3, titre: 'Sujets', to: '/sujets',
    resume: 'on regroupe par theme',
    detail: "Chaque grand theme rassemble ses sources et ses dossiers. C'est l'entree thematique pour s'y retrouver et nourrir les productions.",
  },
  {
    n: 4, titre: 'Activites', to: '/activites',
    resume: 'on en fait quelque chose',
    detail: "Atelier, dossier, debunkage, arpentage : la matiere devient une production d'education populaire. Chaque activite a son propre fil (de l'amorce a la diffusion).",
  },
  {
    n: 5, titre: 'Apprendre', to: '/apprendre',
    resume: 'on s\'exerce',
    detail: "Des quiz par theme pour entrainer l'oeil a reperer les mecanismes a l'oeuvre sur des sources reelles. On explore, on n'est pas note.",
  },
  {
    n: 6, titre: 'Observatoire', to: '/observatoire',
    resume: 'la reference sur les medias',
    detail: "Qui possede quoi, comment un meme fait est couvert differemment selon les medias, les fiches medias, le catalogue des mecanismes. Des outils pour comprendre, pas pour noter.",
  },
]

interface EntreeMenu { titre: string; to: string; texte: string }

const MENU: EntreeMenu[] = [
  { titre: 'Accueil', to: '/accueil', texte: 'cette page : le point de depart et le mode d\'emploi.' },
  { titre: 'Mon espace', to: '/perso', texte: 'mon compte, mes contributions, mes lectures, mon pseudo Discord.' },
  { titre: 'Inbox', to: '/inbox', texte: 'le hub de la qualite des sources : on qualifie ce qui entre.' },
  { titre: 'Veille', to: '/veille', texte: 'le flux des sources qualifiees, a lire et commenter.' },
  { titre: 'Sujets', to: '/sujets', texte: 'les grands themes et leurs dossiers.' },
  { titre: 'Activites', to: '/activites', texte: 'ateliers, dossiers, debunkages, arpentages.' },
  { titre: 'Apprendre', to: '/apprendre', texte: 'les quiz et le manuel pour s\'exercer.' },
  { titre: 'Observatoire', to: '/observatoire', texte: 'la reference critique des medias.' },
]

export default function Accueil() {
  const user = useAuth((s) => s.user)
  const [inboxN, setInboxN] = useState<number | null>(null)
  const [aLireN, setALireN] = useState(0)
  const [aRevoirN, setARevoirN] = useState(0)
  const [contrib, setContrib] = useState<Contributions | null>(null)

  useEffect(() => {
    api.get<unknown[]>('/sources/inbox').then((d) => setInboxN(Array.isArray(d) ? d.length : 0)).catch(() => setInboxN(null))
    api.get<Lecture[]>('/auth/lectures').then((l) => setALireN(l.filter((x) => x.statut === 'a_lire').length)).catch(() => {})
    api.get<unknown[]>('/parcours/revisions/a-revoir').then((d) => setARevoirN(Array.isArray(d) ? d.length : 0)).catch(() => {})
    api.get<Contributions>('/auth/contributions').then(setContrib).catch(() => {})
  }, [])

  return (
    <div className="accueil">
      <section className="accueil-intro">
        <h1>A la source</h1>
        <p className="accueil-baseline">
          {user?.nom ? `Bonjour, ${user.nom}. ` : ''}
          Notre outil d'education populaire pour aiguiser ensemble notre regard critique sur les medias.
          On collecte des sources, on les fiabilise, on repere les mecanismes a l'oeuvre, on en fait des dossiers et des quiz.
        </p>
      </section>

      {/* Reprendre : acces rapide a ce qui m'attend. */}
      <section className="accueil-reprendre">
        <Link to="/inbox" className="accueil-inbox" title="Les sources entrantes a qualifier ensemble">
          <span className="accueil-inbox-n">{inboxN ?? '...'}</span>
          <span className="accueil-inbox-texte">
            <strong>Inbox a qualifier</strong>
            <small>la veille partagee a trier</small>
          </span>
        </Link>
        <div className="accueil-tuiles">
          <Link to="/perso/lectures" className="accueil-tuile" title="Mes sources sauvegardees a lire">
            <strong>{aLireN}</strong><span>a lire</span>
          </Link>
          {aRevoirN > 0 && (
            <Link to="/parcours" className="accueil-tuile" title="Mecanismes a reancrer (revision espacee)">
              <strong>{aRevoirN}</strong><span>a reancrer</span>
            </Link>
          )}
          <Link to="/perso/contributions" className="accueil-tuile" title="Tout ce que j'ai propose et anime">
            <strong>{contrib ? contrib.sources.length : 0}</strong><span>mes sources</span>
          </Link>
        </div>
      </section>

      {/* Le parcours d'une source : le fil conducteur, explique. */}
      <section className="accueil-bloc">
        <h2>Le parcours d'une source</h2>
        <p className="accueil-bloc-intro">
          D'un lien brut a une production : voici le chemin. Cliquez une etape pour y aller, depliez pour comprendre.
        </p>
        <ol className="accueil-parcours">
          {PARCOURS.map((e) => (
            <li key={e.n} className="accueil-etape">
              <details>
                <summary>
                  <span className="accueil-etape-num">{e.n}</span>
                  <Link to={e.to} className="accueil-etape-titre" onClick={(ev) => ev.stopPropagation()}>{e.titre}</Link>
                  <span className="accueil-etape-resume">{e.resume}</span>
                </summary>
                <p className="accueil-etape-detail">{e.detail}</p>
              </details>
            </li>
          ))}
        </ol>
      </section>

      {/* Ou se deroule quoi : la legende du menu, pour ne jamais etre perdu. */}
      <section className="accueil-bloc">
        <h2>Le menu en un coup d'oeil</h2>
        <details className="accueil-menu-repli">
          <summary>Ou se deroule quoi ? Depliez la legende.</summary>
          <ul className="accueil-menu">
            {MENU.map((m) => (
              <li key={m.to}>
                <Link to={m.to} className="accueil-menu-titre">{m.titre}</Link>
                <span className="accueil-menu-texte">{m.texte}</span>
              </li>
            ))}
          </ul>
        </details>
        <p className="accueil-rassure">Personne n'est jamais perdu : chaque page rappelle a quoi elle sert, et tout reste rattrapable.</p>
      </section>
    </div>
  )
}
