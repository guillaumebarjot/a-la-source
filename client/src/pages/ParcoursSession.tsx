import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { api } from '../api/client'
import type {
  ParcoursDetail,
  ParcoursQuestion,
  SessionDemarree,
  ReponseResultat,
  MecanismeChoix,
} from '../types/parcours'
import '../styles/parcours.css'

// Visuel de la source : l'image est TOUJOURS presente. A defaut d'illustration
// (image_url nulle) ou si le chargement echoue (lien externe mort, hotlink 403,
// chemin /images/source-N introuvable), on bascule sur un placeholder sobre
// (initiale du media ou du titre), comme les cartes-sources du reste de l'app.
// C'est ce qui corrige le ressenti « images invisibles » : plus jamais de carte
// vide ni d'icone d'image cassee.
function SourceVisuel({ question }: { question: ParcoursQuestion }) {
  const [enErreur, setEnErreur] = useState(false)
  const initiale = (question.source_media_nom || question.source_titre || '?').charAt(0).toUpperCase()
  if (!question.source_image_url || enErreur) {
    return <div className="parcours-source-image parcours-source-image--fallback">{initiale}</div>
  }
  return (
    <img
      className="parcours-source-image"
      src={question.source_image_url}
      alt=""
      loading="lazy"
      onError={() => setEnErreur(true)}
    />
  )
}

export default function ParcoursSession() {
  const { id } = useParams()
  const [parcours, setParcours] = useState<ParcoursDetail | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const [index, setIndex] = useState(0)
  const [choixId, setChoixId] = useState<number | null>(null)
  const [resultat, setResultat] = useState<ReponseResultat | null>(null)
  const [scoreFinal, setScoreFinal] = useState<{ score: number; total: number } | null>(null)

  // Charge le parcours et demarre une session.
  useEffect(() => {
    if (!id) return
    let actif = true
    setChargement(true)
    api.get<ParcoursDetail>(`/parcours/${id}`)
      .then(async (p) => {
        if (!actif) return
        setParcours(p)
        try {
          const s = await api.post<SessionDemarree>(`/parcours/${id}/sessions`, {})
          if (actif) setSessionId(s.session_id)
        } catch {
          // La session exige une auth ; on laisse jouer mais sans suivi serveur.
          if (actif) setSessionId(null)
        }
      })
      .catch(() => actif && setErreur('Parcours introuvable.'))
      .finally(() => actif && setChargement(false))
    return () => { actif = false }
  }, [id])

  const questions = parcours?.questions ?? []
  const question = questions[index]
  const mecanismes: MecanismeChoix[] = parcours?.mecanismes ?? []

  // Choix tries par categorie puis nom (deja trie cote serveur, on conserve l'ordre).
  const choix = useMemo(() => mecanismes, [mecanismes])

  async function repondre(mecanismeId: number) {
    if (!question || resultat) return
    setChoixId(mecanismeId)
    if (!sessionId) {
      // Pas de session : correction locale impossible cote serveur. On signale doucement.
      setResultat({
        correct: false,
        mecanisme_attendu: null,
        explication: 'Connectez-vous pour enregistrer vos reponses et voir la correction.',
        score: 0,
        total: questions.length,
        termine: false,
      })
      return
    }
    try {
      const r = await api.post<ReponseResultat>(`/parcours/sessions/${sessionId}/reponses`, {
        question_id: question.id,
        mecanisme_choisi_id: mecanismeId,
      })
      setResultat(r)
    } catch {
      setErreur('La reponse n\'a pas pu etre enregistree.')
    }
  }

  function suivant() {
    if (!resultat) return
    if (index + 1 >= questions.length) {
      setScoreFinal({ score: resultat.score, total: resultat.total || questions.length })
      return
    }
    setIndex((i) => i + 1)
    setChoixId(null)
    setResultat(null)
  }

  if (chargement) return <div className="parcours-session"><div className="parcours-loading">Chargement...</div></div>
  if (erreur) return <div className="parcours-session"><div className="parcours-empty">{erreur}</div></div>
  if (!parcours) return null

  // Ecran de fin
  if (scoreFinal) {
    return (
      <div className="parcours-session">
        <div className="parcours-resultat">
          <h1>{parcours.titre}</h1>
          <p className="parcours-resultat-score">{scoreFinal.score} / {scoreFinal.total}</p>
          <p>Parcours termine. Continuez a entrainer votre oeil.</p>
          <div className="parcours-resultat-actions">
            <Link to="/parcours" className="parcours-btn parcours-btn--secondary">Retour aux parcours</Link>
          </div>
        </div>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="parcours-session">
        <div className="parcours-empty">Ce parcours ne contient pas encore de question.</div>
      </div>
    )
  }

  const progression = Math.round((index / questions.length) * 100)

  return (
    <div className="parcours-session">
      <div className="parcours-progress">
        <span>{index + 1} / {questions.length}</span>
        <div className="parcours-progress-bar"><span style={{ width: `${progression}%` }} /></div>
        <Link to="/parcours" className="parcours-btn--secondary parcours-btn">Quitter</Link>
      </div>

      {/* Carte-source NUE : image + titre + chapo, aucun indice du mecanisme.
          L'image est toujours rendue (placeholder a defaut) et la source est
          lisible en plein : on peut ouvrir l'article archive avant de repondre. */}
      <article className="parcours-source-card">
        <SourceVisuel key={question.id} question={question} />
        <div className="parcours-source-body">
          {question.source_media_nom && (
            <span className="parcours-source-media">{question.source_media_nom}</span>
          )}
          <h2 className="parcours-source-titre">{question.source_titre}</h2>
          {question.source_accroche && (
            <p className="parcours-source-chapo">{question.source_accroche}</p>
          )}
          <Link
            to={`/lire/${question.source_id}`}
            className="parcours-source-lire"
            target="_blank"
            rel="noreferrer"
          >
            <BookOpen size={15} /> Lire la source en entier
          </Link>
        </div>
      </article>

      <p className="parcours-question">Quel mecanisme est a l'oeuvre ?</p>

      <div className="parcours-choices">
        {choix.map((m) => {
          let cls = 'parcours-choice'
          if (resultat) {
            const estAttendu = resultat.mecanisme_attendu?.id === m.id
            const estChoisi = choixId === m.id
            if (estAttendu) cls += ' parcours-choice--correct'
            else if (estChoisi) cls += ' parcours-choice--wrong'
          }
          return (
            <button
              key={m.id}
              className={cls}
              disabled={!!resultat}
              onClick={() => repondre(m.id)}
            >
              {m.nom}
            </button>
          )
        })}
      </div>

      {resultat && (
        <div className="parcours-feedback">
          <p className={`parcours-feedback-verdict ${resultat.correct ? 'parcours-feedback-verdict--ok' : 'parcours-feedback-verdict--ko'}`}>
            {resultat.correct ? 'Bonne reponse.' : 'Reponse incorrecte.'}
          </p>
          {resultat.mecanisme_attendu && (
            <p className="parcours-feedback-attendu">
              Mecanisme attendu : <strong>{resultat.mecanisme_attendu.nom}</strong>
            </p>
          )}
          {resultat.explication && (
            <p className="parcours-feedback-explication">{resultat.explication}</p>
          )}
          <button className="parcours-btn" onClick={suivant}>
            {index + 1 >= questions.length ? 'Voir mon score' : 'Question suivante'}
          </button>
        </div>
      )}
    </div>
  )
}
