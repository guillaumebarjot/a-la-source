import { useState, useEffect } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../store/useAuth'
import type { Lecture, Contenu, Contributions } from '../types'

interface Video {
  id: string
  titre: string
  description: string
  vignette: string
  duree: number
  date: string
  vues: number
  url: string
  plateforme: string
}

interface Chaine {
  nom: string
  description: string
  url: string
  plateforme: string
}

function formatDuree(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}


/* ---------- Section Lectures ---------- */

function SectionLectures() {
  const user = useAuth((s) => s.user)
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [recommandations, setRecommandations] = useState<Lecture[]>([])

  useEffect(() => {
    api.get<Lecture[]>('/auth/lectures').then(setLectures)
    api.get<Lecture[]>('/auth/recommandations').then(setRecommandations)
  }, [])

  if (!user) return <p className="loading">Chargement...</p>

  const aLire = lectures.filter((l) => l.statut === 'a_lire')
  const lus = lectures.filter((l) => l.statut === 'lu')

  return (
    <>
      <section>
        <h2>A lire ({aLire.length})</h2>
        {aLire.length === 0 ? <p className="empty">Rien en file d'attente.</p> : (
          <div className="lecture-list">
            {aLire.map((l) => (
              <Link key={l.source_id} to={`/lire/${l.source_id}`} className="lecture-item">
                <span>{l.titre}</span>
                <span className="lecture-media">{l.media_nom}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {recommandations.length > 0 && (
        <section>
          <h2>Recommandations recues ({recommandations.length})</h2>
          <div className="lecture-list">
            {recommandations.map((r) => (
              <Link key={r.source_id} to={`/lire/${r.source_id}`} className="lecture-item">
                <span>{r.titre}</span>
                <span className="lecture-media">{r.media_nom}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>Deja lus ({lus.length})</h2>
        {lus.length === 0 ? <p className="empty">Aucune source lue.</p> : (
          <div className="lecture-list">
            {lus.slice(0, 10).map((l) => (
              <Link key={l.source_id} to={`/lire/${l.source_id}`} className="lecture-item">
                <span>{l.titre}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

/* ---------- Section Chaines amies ---------- */

const CHAINES_AMIES: Chaine[] = [
  {
    nom: 'Les Becs Rouges',
    description: 'Contenus video et audio pour informer et sensibiliser sur les enjeux locaux et sociaux en Alsace du Nord.',
    url: 'https://becs-rouges.fr',
    plateforme: 'becs-rouges.fr',
  },
  {
    nom: 'Les Becs Rouges — YouTube',
    description: 'Chaine YouTube des Becs Rouges.',
    url: 'https://www.youtube.com/@BecsRouges',
    plateforme: 'YouTube',
  },
  {
    nom: 'Les Becs Rouges - Indymotion',
    description: 'Chaine Indymotion des Becs Rouges (plateforme libre).',
    url: 'https://indymotion.fr/a/nupesalsacenordvosgesdunord/videos',
    plateforme: 'Indymotion',
  },
  {
    nom: 'Rouge Coquelicot',
    description: 'Association d\'education populaire sur l\'information. A venir.',
    url: 'https://rouge-coquelicot.fr',
    plateforme: 'rouge-coquelicot.fr',
  },
]

function SectionChaines() {
  const [presentation, setPresentation] = useState<Contenu | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Contenu>('/contenus/becs-rouges').then(setPresentation).catch(() => {})
    api.get<Video[]>('/becs-rouges/videos/indymotion')
      .then(setVideos)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <section className="chaines-intro">
        <h2>Chaines amies</h2>
        <p>
          Retrouvez ici les chaines de nos collectifs et associations partenaires.
          Des contenus video, audio et ecrits pour s'informer autrement.
        </p>
      </section>

      <section className="chaines-grid">
        {CHAINES_AMIES.map((c) => (
          <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer" className="chaine-card">
            <h3 className="chaine-card-nom">{c.nom}</h3>
            <p className="chaine-card-desc">{c.description}</p>
            <span className="chaine-card-plateforme">{c.plateforme}</span>
          </a>
        ))}
      </section>

      {/* Videos Becs Rouges */}
      <section className="br-section">
        <h2>Dernieres videos — Les Becs Rouges</h2>
        {presentation && <p className="br-presentation">{presentation.contenu}</p>}

        {loading ? (
          <p className="loading">Chargement des videos...</p>
        ) : videos.length === 0 ? (
          <p className="empty">Aucune video disponible pour le moment.</p>
        ) : (
          <div className="br-video-grid">
            {videos.map((v) => (
              <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" className="br-video-card">
                <div className="br-video-thumb">
                  <img src={v.vignette} alt={v.titre} loading="lazy" />
                  <span className="br-video-duration">{formatDuree(v.duree)}</span>
                </div>
                <div className="br-video-info">
                  <h3>{v.titre}</h3>
                  <span className="br-video-meta">
                    {new Date(v.date).toLocaleDateString('fr-FR')} — {v.vues} vues
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

/* ---------- Section Mon compte ---------- */

function SectionCompte() {
  const user = useAuth((s) => s.user)
  const fetchUser = useAuth((s) => s.fetchUser)
  const [pseudo, setPseudo] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => { setPseudo(user?.discord_pseudo || '') }, [user?.discord_pseudo])

  if (!user) return <p className="loading">Chargement...</p>

  const enregistrer = async () => {
    await api.post('/auth/profil', { discord_pseudo: pseudo })
    await fetchUser()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <section className="compte">
      <h2>Mon compte</h2>
      <dl className="compte-infos">
        <div><dt>Identifiant</dt><dd>{user.nom}</dd></div>
        {user.email && <div><dt>Courriel</dt><dd>{user.email}</dd></div>}
        <div><dt>Role</dt><dd>{user.role}</dd></div>
      </dl>
      <p className="compte-note">Ton identite vient du SSO (Authentik) ; le role est gere par les animateur·ices.</p>

      <h3>Pseudo Discord</h3>
      <p className="compte-aide">
        Renseigne ton pseudo Discord pour que les liens que tu postes sur le serveur Rouge Coquelicot
        te soient attribues automatiquement dans la veille.
      </p>
      <div className="compte-pseudo">
        <input
          type="text"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          placeholder="ton.pseudo.discord"
          aria-label="Pseudo Discord"
        />
        <button onClick={enregistrer}>Enregistrer</button>
        {saved && <span className="compte-ok">Enregistre</span>}
      </div>
    </section>
  )
}

/* ---------- Section Mes contributions ---------- */

function SectionContributions() {
  const [c, setC] = useState<Contributions | null>(null)

  useEffect(() => { api.get<Contributions>('/auth/contributions').then(setC).catch(() => {}) }, [])

  if (!c) return <p className="loading">Chargement...</p>

  return (
    <>
      <section className="contrib-stats">
        <h2>Mes contributions</h2>
        <div className="contrib-compteurs">
          <div className="contrib-compteur"><strong>{c.sources.length}</strong><span>sources proposees</span></div>
          <div className="contrib-compteur"><strong>{c.nbEvaluations}</strong><span>evaluations</span></div>
          <div className="contrib-compteur"><strong>{c.nbMecanismes}</strong><span>mecanismes reperes</span></div>
          <div className="contrib-compteur"><strong>{c.nbCommentaires}</strong><span>commentaires</span></div>
          <div className="contrib-compteur"><strong>{c.activites.length}</strong><span>activites</span></div>
          <div className="contrib-compteur"><strong>{c.sujets.length}</strong><span>sujets</span></div>
        </div>
      </section>

      {c.sources.length > 0 && (
        <section>
          <h3>Sources proposees ({c.sources.length})</h3>
          <div className="lecture-list">
            {c.sources.map((s) => (
              <Link key={s.id} to={`/lire/${s.id}`} className="lecture-item">
                <span>{s.titre}</span>
                <span className="lecture-media">{[s.media_nom, s.statut].filter(Boolean).join(' · ')}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {c.activites.length > 0 && (
        <section>
          <h3>Activites creees ou animees ({c.activites.length})</h3>
          <ul className="contrib-liste">
            {c.activites.map((a) => (
              <li key={`${a.type}-${a.id}`}>
                {a.titre || a.type}{' '}
                <span className="contrib-meta">{a.type} · {a.statut}{a.anime ? ' · animateur·ice' : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.sujets.length > 0 && (
        <section>
          <h3>Sujets crees ({c.sujets.length})</h3>
          <ul className="contrib-liste">
            {c.sujets.map((s) => (
              <li key={s.id}>
                <Link to={`/sujets/${s.slug}`}>{s.titre}</Link>{' '}
                <span className="contrib-meta">{s.statut}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.sources.length === 0 && c.activites.length === 0 && c.sujets.length === 0
        && c.nbEvaluations === 0 && c.nbMecanismes === 0 && c.nbCommentaires === 0 && (
        <p className="empty">Pas encore de contribution. Propose une source dans la veille pour commencer.</p>
      )}
    </>
  )
}

/* ---------- Composant principal ---------- */

const INTROS: Record<string, string> = {
  compte: 'Ton identite, ton pseudo Discord et tes droits.',
  contributions: 'Tout ce que tu as propose, analyse et anime.',
  lectures: 'Tes lectures sauvegardees et les recommandations recues.',
  chaines: 'Les chaines de nos collectifs partenaires.',
}

export default function MonEspace() {
  const { section } = useParams<{ section?: string }>()

  if (!section) return <Navigate to="/perso/compte" replace />

  return (
    <div className="page-perso">
      <p className="page-intro">{INTROS[section] || ''}</p>

      {section === 'compte' && <SectionCompte />}
      {section === 'contributions' && <SectionContributions />}
      {section === 'lectures' && <SectionLectures />}
      {section === 'chaines' && <SectionChaines />}
    </div>
  )
}
