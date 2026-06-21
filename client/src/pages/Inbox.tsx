import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type {
  SourceQualification,
  CompteursQualification,
  QualificationReponse,
  JalonsQualification,
  MecanismeReference,
  Sujet,
} from '../types'
import '../styles/inbox.css'

/**
 * Inbox-hub : la qualite des sources (docs/conception-inbox-qualification.md).
 *
 * « Qualifier » une source n'est plus un simple « envoyer en veille » : c'est un
 * tunnel d'enrichissement pris a la carte, jamais bloquant, avec un score
 * d'avancement visible. La page liste les sources pas encore « bien qualifiees »
 * (le minimum = copie locale + accroche + image), avec :
 *  - une barre de filtres « par ce qui manque » (avec compteurs),
 *  - par source, son stepper de jalons, sa jauge de score sobre, et les actions
 *    inline de chaque etape (accepter, image, accroche, copie locale, sujet,
 *    mots-cles, analyser, mobiliser, commenter).
 *
 * Tous les jalons reutilisent les endpoints existants. Apres chaque action, la
 * carte est rechargee (jalon franchi -> score qui monte). Ouvert a tous les membres.
 */

type Filtre = 'tout' | 'accepter' | 'copie_locale' | 'accroche' | 'image' | 'sujet' | 'analyse'

const FILTRES: { cle: Filtre; label: string; compteur: keyof CompteursQualification | null }[] = [
  { cle: 'tout', label: 'A travailler', compteur: 'a_qualifier' },
  { cle: 'accepter', label: 'A accepter', compteur: 'accepter' },
  { cle: 'copie_locale', label: 'Sans copie locale', compteur: 'copie_locale' },
  { cle: 'accroche', label: 'Sans accroche', compteur: 'accroche' },
  { cle: 'image', label: 'Sans image', compteur: 'image' },
  { cle: 'sujet', label: 'Sans sujet', compteur: 'sujet' },
  { cle: 'analyse', label: 'Non analysee', compteur: 'analyse' },
]

const JALONS_ORDRE: { cle: keyof JalonsQualification; label: string }[] = [
  { cle: 'accepte', label: 'Acceptee' },
  { cle: 'copie_locale', label: 'Copie locale' },
  { cle: 'accroche', label: 'Accroche' },
  { cle: 'image', label: 'Image' },
  { cle: 'sujet', label: 'Sujet' },
  { cle: 'analysee', label: 'Analysee' },
  { cle: 'mobilisee', label: 'Mobilisee' },
  { cle: 'commentee', label: 'Commentee' },
]

const FILTRES_VALIDES: Filtre[] = FILTRES.map((f) => f.cle)

export default function Inbox() {
  // Filtre initial depuis l'URL (?manque=...), pour que les redirections d'Archiver
  // et de « sans copie locale » atterrissent sur le bon filtre.
  const [searchParams] = useSearchParams()
  const manqueParam = searchParams.get('manque')
  const filtreInitial: Filtre = manqueParam && (FILTRES_VALIDES as string[]).includes(manqueParam)
    ? (manqueParam as Filtre)
    : 'tout'

  const [sources, setSources] = useState<SourceQualification[]>([])
  const [compteurs, setCompteurs] = useState<CompteursQualification | null>(null)
  const [chargement, setChargement] = useState(true)
  const [filtre, setFiltre] = useState<Filtre>(filtreInitial)
  const [tout, setTout] = useState(false)
  const [carteOuverte, setCarteOuverte] = useState<number | null>(null)

  // Referentiels charges une fois pour les actions inline (sujet, analyse).
  const [mecanismes, setMecanismes] = useState<MecanismeReference[]>([])
  const [sujets, setSujets] = useState<Sujet[]>([])
  const [dossiers, setDossiers] = useState<{ id: number; titre: string }[]>([])
  const [ateliers, setAteliers] = useState<{ id: number; titre: string | null }[]>([])

  const charger = useCallback(async () => {
    const params = new URLSearchParams()
    if (tout) params.set('tout', '1')
    if (filtre !== 'tout') params.set('manque', filtre)
    const data = await api.get<QualificationReponse>(`/sources/qualification?${params.toString()}`)
    setSources(data.sources)
    setCompteurs(data.compteurs)
    setChargement(false)
  }, [filtre, tout])

  useEffect(() => { charger() }, [charger])

  useEffect(() => {
    api.get<MecanismeReference[]>('/mecanismes').then(setMecanismes).catch(() => {})
    api.get<Sujet[]>('/sujets').then(setSujets).catch(() => {})
    api.get<{ id: number; titre: string }[]>('/dossiers').then(setDossiers).catch(() => {})
    api.get<{ id: number; titre: string | null }[]>('/ateliers').then(setAteliers).catch(() => {})
  }, [])

  // Recharge une seule source apres action (le tri/filtre serveur la fera
  // sortir ou descendre ; on recharge la liste complete pour rester coherent).
  const apresAction = useCallback(async () => { await charger() }, [charger])

  return (
    <div className="hub-page">
      <div className="hub-header">
        <h1>Inbox</h1>
        <p className="hub-intro">
          Le hub de la qualite des sources. Qualifier une source, c'est l'enrichir a la
          carte : on traite ce qu'on veut, dans l'ordre qu'on veut. Une source est
          <strong> bien qualifiee</strong> quand elle a sa copie locale, son accroche et son
          image. Le travail est collectif.
        </p>
      </div>

      <div className="hub-filtres" role="tablist" aria-label="Filtrer par ce qui manque">
        {FILTRES.map((f) => {
          const n = f.compteur && compteurs ? compteurs[f.compteur] : null
          return (
            <button
              key={f.cle}
              type="button"
              role="tab"
              aria-selected={filtre === f.cle}
              className={`hub-filtre${filtre === f.cle ? ' hub-filtre--actif' : ''}`}
              onClick={() => setFiltre(f.cle)}
            >
              {f.label}
              {n != null && <span className="hub-filtre-compteur">{n}</span>}
            </button>
          )
        })}
        <label className="hub-toggle-tout">
          <input type="checkbox" checked={tout} onChange={(e) => setTout(e.target.checked)} />
          Voir toutes les sources
        </label>
      </div>

      {chargement ? (
        <div className="loading">Chargement...</div>
      ) : sources.length === 0 ? (
        <div className="hub-vide">
          <h2>Rien a faire ici</h2>
          <p>
            {tout
              ? 'Aucune source ne correspond a ce filtre.'
              : 'Toutes les sources de ce filtre sont bien qualifiees. Beau travail collectif.'}
          </p>
        </div>
      ) : (
        <div className="hub-liste">
          {sources.map((s) => (
            <CarteQualification
              key={s.id}
              source={s}
              ouverte={carteOuverte === s.id}
              onToggle={() => setCarteOuverte((c) => (c === s.id ? null : s.id))}
              mecanismes={mecanismes}
              sujets={sujets}
              dossiers={dossiers}
              ateliers={ateliers}
              onAction={apresAction}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Carte source : stepper de jalons + jauge de score + actions inline */
/* ------------------------------------------------------------------ */

function CarteQualification({
  source: s,
  ouverte,
  onToggle,
  mecanismes,
  sujets,
  dossiers,
  ateliers,
  onAction,
}: {
  source: SourceQualification
  ouverte: boolean
  onToggle: () => void
  mecanismes: MecanismeReference[]
  sujets: Sujet[]
  dossiers: { id: number; titre: string }[]
  ateliers: { id: number; titre: string | null }[]
  onAction: () => Promise<void>
}) {
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Formulaires inline (replies sous la carte).
  const [accroche, setAccroche] = useState(s.accroche ?? '')
  const [imageUrl, setImageUrl] = useState(s.image_url ?? '')
  const [tag, setTag] = useState('')
  const [colle, setColle] = useState('')
  const [lien, setLien] = useState(s.url ?? '')

  const lancer = async (fn: () => Promise<void>, ok: string) => {
    setEnCours(true)
    setMessage(null)
    try {
      await fn()
      setMessage(ok)
      await onAction()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Echec')
    } finally {
      setEnCours(false)
    }
  }

  const accepter = () =>
    lancer(() => api.post(`/sources/${s.id}/qualifier`, { statut: 'veille' }), 'Source acceptee, entree en veille.')

  const archiver = () =>
    lancer(async () => {
      const r = await api.post<{ statut?: string }>(`/sources/${s.id}/archiver`, {})
      if (r?.statut === 'partielle') throw new Error('Archive partielle (paywall ?) — completer dans /lire.')
    }, 'Copie locale archivee.')

  const integralOffline = () =>
    lancer(() => api.patch(`/sources/${s.id}`, { completude: 'integral_offline' }), 'Marquee « consultee hors-ligne ».')

  // Copie locale contextuelle : l'id est celui de la carte, jamais a re-saisir.
  const enregistrerLien = () => {
    if (!lien.trim()) return
    lancer(() => api.patch(`/sources/${s.id}`, { url: lien.trim() }), 'Lien d\'acces mis a jour.')
  }

  const collerCopie = () => {
    if (!colle.trim()) return
    lancer(async () => {
      await api.post(`/sources/${s.id}/archive-manuelle`, { contenu: colle, type: 'html' })
      setColle('')
    }, 'Copie locale enregistree (texte colle).')
  }

  const joindreFichier = (file: File | null) => {
    if (!file) return
    lancer(async () => {
      const fd = new FormData()
      fd.append('fichier', file)
      await api.upload(`/sources/${s.id}/archive-fichier`, fd)
    }, 'Copie locale enregistree (fichier joint).')
  }

  const enregistrerAccroche = () =>
    lancer(() => api.patch(`/sources/${s.id}`, { accroche: accroche.trim() }), 'Accroche enregistree.')

  const enregistrerImage = () =>
    lancer(() => api.patch(`/sources/${s.id}`, { image_url: imageUrl.trim() }), 'Image enregistree.')

  const rattacherSujet = (sujetId: string) => {
    if (!sujetId) return
    lancer(() => api.post(`/sujets/${sujetId}/sources`, { source_id: s.id }), 'Rattachee a un sujet.')
  }

  const ajouterTag = () => {
    if (!tag.trim()) return
    lancer(async () => {
      await api.post(`/tags/source/${s.id}`, { tag_nom: tag.trim() })
      setTag('')
    }, 'Mot-cle ajoute.')
  }

  const analyser = (mecanismeId: string) => {
    if (!mecanismeId) return
    lancer(() => api.post('/mecanismes/identifier', { source_id: s.id, mecanisme_id: Number(mecanismeId) }), 'Mecanisme identifie.')
  }

  const mobiliserDossier = (dossierId: string) => {
    if (!dossierId) return
    lancer(() => api.post(`/dossiers/${dossierId}/sources`, { source_id: s.id }), 'Versee dans un dossier.')
  }

  const mobiliserAtelier = (atelierId: string) => {
    if (!atelierId) return
    lancer(() => api.post(`/ateliers/${atelierId}/sources`, { source_id: s.id }), 'Versee au vivier d\'un atelier.')
  }

  const nbFaits = JALONS_ORDRE.filter((j) => s.jalons[j.cle]).length

  return (
    <div className={`hub-carte${s.bien_qualifiee ? ' hub-carte--ok' : ''}`}>
      <div className="hub-carte-tete">
        <Link to={`/lire/${s.id}`} className="hub-carte-vignette" aria-hidden={!s.image_url}>
          {s.image_url ? (
            <img src={s.image_url} alt="" loading="lazy" />
          ) : (
            <span className="hub-carte-initiale">{(s.titre || '?').charAt(0).toUpperCase()}</span>
          )}
        </Link>
        <div className="hub-carte-corps">
          <Link to={`/lire/${s.id}`} className="hub-carte-titre">{s.titre}</Link>
          <div className="hub-carte-meta">
            {s.media_nom && <span className="hub-badge">{s.media_nom}</span>}
            <span className="hub-badge">origine : {s.origine ?? 'web'}</span>
            {s.paywall ? <span className="hub-badge hub-badge--alerte">paywall</span> : null}
          </div>

          {/* Jauge de score sobre (factuelle, pas un verdict). */}
          <div className="hub-jauge" title={`${nbFaits}/${JALONS_ORDRE.length} jalons`}>
            <div className="hub-jauge-piste">
              <div className="hub-jauge-remplie" style={{ width: `${s.score}%` }} />
            </div>
            <span className="hub-jauge-valeur">{s.score} / 100</span>
          </div>

          {/* Stepper de jalons compact. */}
          <ol className="hub-stepper" aria-label="Jalons de qualification">
            {JALONS_ORDRE.map((j) => (
              <li
                key={j.cle}
                className={`hub-pas${s.jalons[j.cle] ? ' hub-pas--fait' : ''}`}
                title={j.label + (s.jalons[j.cle] ? ' (fait)' : ' (a faire)')}
              >
                <span className="hub-pas-puce" aria-hidden="true">{s.jalons[j.cle] ? '✓' : '○'}</span>
                <span className="hub-pas-label">{j.label}</span>
              </li>
            ))}
          </ol>
        </div>
        <button type="button" className="hub-carte-plier" onClick={onToggle} aria-expanded={ouverte}>
          {ouverte ? 'Replier' : 'Travailler'}
        </button>
      </div>

      {ouverte && (
        <div className="hub-actions">
          {message && <div className="hub-message">{message}</div>}

          {!s.jalons.accepte && (
            <div className="hub-action">
              <span className="hub-action-titre">Accepter</span>
              <button type="button" className="hub-btn hub-btn--primaire" disabled={enCours} onClick={accepter}>
                Accepter (envoyer en veille)
              </button>
            </div>
          )}

          {/* Lien d'acces et copie locale : toujours disponibles, pour AJOUTER
              ou CORRIGER une erreur (mur anti-bot, lien mort, mauvaise archive). */}
          <div className="hub-action">
            <span className="hub-action-titre">
              {s.jalons.copie_locale ? 'Lien et copie locale (corriger)' : 'Lien et copie locale'}
            </span>
            {/* Redonner un lien d'acces : source originale, version sans paywall, Europresse. */}
            <div className="hub-action-ligne">
              <input
                type="url"
                className="hub-champ"
                value={lien}
                onChange={(e) => setLien(e.target.value)}
                placeholder="Lien d'acces (source originale, sans paywall...)"
              />
              <button type="button" className="hub-btn" disabled={enCours || !lien.trim()} onClick={enregistrerLien}>
                Mettre a jour le lien
              </button>
              {s.url && (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="hub-btn hub-btn--lien">Ouvrir</a>
              )}
            </div>
            <button type="button" className="hub-btn" disabled={enCours} onClick={archiver}>
              {s.jalons.copie_locale ? 'Refaire l\'extraction auto' : 'Archiver (extraction auto)'}
            </button>
            <button type="button" className="hub-btn" disabled={enCours} onClick={integralOffline}>
              Consultee hors-ligne
            </button>
            {/* Copie locale contextuelle, sans jamais re-saisir l'id de la source. */}
            <textarea
              className="hub-champ"
              value={colle}
              onChange={(e) => setColle(e.target.value)}
              placeholder="Coller ici le texte integral (Europresse, archive...)"
              rows={3}
            />
            <div className="hub-action-ligne">
              <button type="button" className="hub-btn" disabled={enCours || !colle.trim()} onClick={collerCopie}>
                {s.jalons.copie_locale ? 'Remplacer par ce texte' : 'Enregistrer le texte colle'}
              </button>
              <label className="hub-btn hub-btn--lien">
                Joindre un PDF
                <input
                  type="file"
                  accept=".pdf,.md,.png,.jpg,.jpeg,.webp"
                  style={{ display: 'none' }}
                  disabled={enCours}
                  onChange={(e) => joindreFichier(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>

          {!s.jalons.accroche && (
            <div className="hub-action">
              <span className="hub-action-titre">Accroche</span>
              <textarea
                className="hub-champ"
                rows={2}
                value={accroche}
                onChange={(e) => setAccroche(e.target.value)}
                placeholder="Une accroche lisible…"
              />
              <button type="button" className="hub-btn" disabled={enCours || !accroche.trim()} onClick={enregistrerAccroche}>
                Enregistrer
              </button>
            </div>
          )}

          {!s.jalons.image && (
            <div className="hub-action">
              <span className="hub-action-titre">Image</span>
              <input
                type="url"
                className="hub-champ"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="URL d'une image de couverture…"
              />
              <button type="button" className="hub-btn" disabled={enCours || !imageUrl.trim()} onClick={enregistrerImage}>
                Enregistrer
              </button>
            </div>
          )}

          {!s.jalons.sujet && (
            <div className="hub-action">
              <span className="hub-action-titre">Rattacher a un sujet</span>
              <select className="hub-champ" disabled={enCours} defaultValue="" onChange={(e) => rattacherSujet(e.target.value)}>
                <option value="">Choisir un sujet…</option>
                {sujets.map((su) => <option key={su.id} value={su.id}>{su.titre}</option>)}
              </select>
            </div>
          )}

          <div className="hub-action">
            <span className="hub-action-titre">Mots-cles</span>
            <input
              type="text"
              className="hub-champ"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') ajouterTag() }}
              placeholder="Ajouter un mot-cle…"
            />
            <button type="button" className="hub-btn" disabled={enCours || !tag.trim()} onClick={ajouterTag}>Ajouter</button>
          </div>

          {!s.jalons.analysee && (
            <div className="hub-action">
              <span className="hub-action-titre">Analyser (mecanisme)</span>
              <select className="hub-champ" disabled={enCours} defaultValue="" onChange={(e) => analyser(e.target.value)}>
                <option value="">Identifier un mecanisme…</option>
                {mecanismes.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>
          )}

          <div className="hub-action">
            <span className="hub-action-titre">Mobiliser</span>
            <select className="hub-champ" disabled={enCours} defaultValue="" onChange={(e) => mobiliserDossier(e.target.value)}>
              <option value="">Verser dans un dossier…</option>
              {dossiers.map((d) => <option key={d.id} value={d.id}>{d.titre}</option>)}
            </select>
            <select className="hub-champ" disabled={enCours} defaultValue="" onChange={(e) => mobiliserAtelier(e.target.value)}>
              <option value="">Verser au vivier d'un atelier…</option>
              {ateliers.map((a) => <option key={a.id} value={a.id}>{a.titre ?? `Atelier #${a.id}`}</option>)}
            </select>
          </div>

          <div className="hub-action">
            <span className="hub-action-titre">Commenter</span>
            <CommentaireInline sourceId={s.id} disabled={enCours} onSent={() => lancer(async () => {}, 'Commentaire ajoute.')} />
          </div>
        </div>
      )}
    </div>
  )
}

function CommentaireInline({ sourceId, disabled, onSent }: { sourceId: number; disabled: boolean; onSent: () => void }) {
  const [contenu, setContenu] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  const envoyer = async () => {
    if (!contenu.trim()) return
    setEnvoi(true)
    try {
      await api.post('/commentaires', { source_id: sourceId, contenu: contenu.trim() })
      setContenu('')
      onSent()
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <>
      <textarea
        ref={ref}
        className="hub-champ"
        rows={2}
        value={contenu}
        onChange={(e) => setContenu(e.target.value)}
        placeholder="Un commentaire, une analyse…"
      />
      <button type="button" className="hub-btn" disabled={disabled || envoi || !contenu.trim()} onClick={envoyer}>
        Commenter
      </button>
    </>
  )
}
