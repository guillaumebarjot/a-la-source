import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../store/useAuth'
import type { Lecture, Contributions } from '../types'

/**
 * Accueil — page d'atterrissage neutre (distincte de « Mon espace »).
 *
 * On entre par la veille partagee : l'inbox a qualifier est mise en avant,
 * puis quelques raccourcis sobres. La page personnelle (compte, contributions)
 * vit a part, sous « Mon espace ».
 */
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
    <div className="page-perso">
      <section className="accueil-hello">
        <h1>A la source</h1>
        <p className="accueil-sous">
          {user?.nom ? `Bonjour, ${user.nom}. ` : ''}Notre veille partagee pour aiguiser le regard critique sur les medias.
        </p>
      </section>

      <Link to="/inbox" className="accueil-inbox">
        <span className="accueil-inbox-n">{inboxN ?? '...'}</span>
        <span className="accueil-inbox-texte">
          <strong>Inbox partagee a qualifier</strong>
          <small>les sources entrantes a trier ensemble</small>
        </span>
      </Link>

      <section className="accueil-tuiles">
        <Link to="/veille" className="accueil-tuile accueil-tuile--lien">
          <span>La veille</span>
        </Link>
        <Link to="/sujets" className="accueil-tuile accueil-tuile--lien">
          <span>Les themes</span>
        </Link>
        <Link to="/perso/lectures" className="accueil-tuile">
          <strong>{aLireN}</strong><span>a lire</span>
        </Link>
        {aRevoirN > 0 && (
          <Link to="/parcours" className="accueil-tuile">
            <strong>{aRevoirN}</strong><span>a reancrer</span>
          </Link>
        )}
        <Link to="/perso/contributions" className="accueil-tuile">
          <strong>{contrib ? contrib.sources.length : 0}</strong><span>mes sources</span>
        </Link>
      </section>
    </div>
  )
}
