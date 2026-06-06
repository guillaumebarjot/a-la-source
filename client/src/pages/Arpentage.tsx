import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type {
  ArpentageDetail, ArpentageFragment, ArpentageRestitution,
  UtilisateurOption, MecanismeOption,
} from '../types/arpentage'
import '../styles/arpentage.css'

/**
 * Arpentage (detail) — l'etabli de la lecture collective.
 *
 * Trois operations : (1) DECOUPER le document en fragments, (2) ATTRIBUER
 * chaque fragment a un participant, (3) COLLECTER les restitutions (points
 * cles, citation, question, mecanisme repere) puis rediger la SYNTHESE
 * collective. On rattache un document (source) au pipeline.
 */
export default function Arpentage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ArpentageDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [participants, setParticipants] = useState<UtilisateurOption[]>([])
  const [mecanismes, setMecanismes] = useState<MecanismeOption[]>([])

  // Pipeline editable
  const [synthese, setSynthese] = useState('')
  const [modeDecoupage, setModeDecoupage] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // Nouveau fragment
  const [fTitre, setFTitre] = useState('')
  const [fRef, setFRef] = useState('')
  const [fContenu, setFContenu] = useState('')

  const recharger = useCallback(() => {
    if (!id) return
    return api.get<ArpentageDetail>(`/arpentages/${id}`).then((d) => {
      setData(d)
      setSynthese(d.pipeline?.synthese_md ?? '')
      setModeDecoupage(d.pipeline?.mode_decoupage ?? '')
      setSourceId(d.pipeline?.source_id ? String(d.pipeline.source_id) : '')
    })
  }, [id])

  useEffect(() => {
    recharger()?.finally(() => setLoading(false))
    api.get<UtilisateurOption[]>('/auth/users').then(setParticipants).catch(() => setParticipants([]))
    api.get<MecanismeOption[]>('/mecanismes').then(setMecanismes).catch(() => setMecanismes([]))
  }, [recharger])

  async function sauverPipeline() {
    if (!id) return
    setSaving(true)
    try {
      await api.put(`/arpentages/${id}`, {
        synthese_md: synthese,
        mode_decoupage: modeDecoupage,
        source_id: sourceId.trim() ? Number(sourceId.trim()) : null,
      })
      setSavedAt(new Date().toLocaleTimeString())
      await recharger()
    } finally {
      setSaving(false)
    }
  }

  async function ajouterFragment(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    if (!fTitre.trim() && !fContenu.trim()) return
    await api.post(`/arpentages/${id}/fragments`, {
      titre: fTitre.trim() || undefined,
      reference: fRef.trim() || undefined,
      contenu_md: fContenu.trim() || undefined,
    })
    setFTitre(''); setFRef(''); setFContenu('')
    await recharger()
  }

  async function attribuer(fid: number, uid: string) {
    await api.put(`/arpentages/fragments/${fid}`, {
      attribue_a: uid ? Number(uid) : null,
    })
    await recharger()
  }

  async function supprimerFragment(fid: number) {
    await api.delete(`/arpentages/fragments/${fid}`)
    await recharger()
  }

  if (loading) return <div className="loading">Chargement de l'arpentage...</div>
  if (!data) return <div className="arp-page"><p className="arp-empty">Arpentage introuvable.</p></div>

  const restitutionsParFragment = (fid: number): ArpentageRestitution[] =>
    data.restitutions.filter((r) => r.fragment_id === fid)

  return (
    <div className="arp-page">
      <header className="arp-header">
        <div className="arp-row">
          <h1>{data.titre}</h1>
          <span className={`arp-badge${data.statut_activite === 'publie' ? ' publie' : ''}`}>
            {data.statut_activite === 'publie' ? 'Publie' : 'Brouillon'}
          </span>
        </div>
        {data.sujet_slug && (
          <p className="arp-card-sub">
            Theme : <Link to={`/sujets/${data.sujet_slug}`} className="arp-titre-lien">{data.sujet_titre}</Link>
          </p>
        )}
      </header>

      {/* Le document : carte source (id) + mode de decoupage */}
      <section className="arp-section">
        <h2>Le document</h2>
        <div className="arp-row">
          <div>
            <label className="arp-field-label" htmlFor="arp-src">Id de la source-document</label>
            <input
              id="arp-src"
              className="arp-input"
              style={{ maxWidth: 160 }}
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              placeholder="id source"
              inputMode="numeric"
            />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="arp-field-label" htmlFor="arp-mode">Mode de decoupage</label>
            <input
              id="arp-mode"
              className="arp-input"
              value={modeDecoupage}
              onChange={(e) => setModeDecoupage(e.target.value)}
              placeholder="Ex : par chapitre, par pages..."
            />
          </div>
        </div>
        {data.pipeline?.source_titre && (
          <p className="arp-card-sub" style={{ marginTop: 'var(--space-sm)' }}>
            Document actuel :{' '}
            {data.pipeline.source_url
              ? <a href={data.pipeline.source_url} target="_blank" rel="noopener noreferrer" className="arp-titre-lien">{data.pipeline.source_titre}</a>
              : <span className="arp-titre-lien">{data.pipeline.source_titre}</span>}
          </p>
        )}
        <div className="arp-actions">
          <button className="btn btn-primary" onClick={sauverPipeline} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer le document'}
          </button>
          {savedAt && <span className="arp-card-meta">Enregistre a {savedAt}</span>}
        </div>
      </section>

      {/* Decouper : ajout de fragments */}
      <section className="arp-section">
        <h2>Decouper en fragments</h2>
        <form className="arp-create-form" onSubmit={ajouterFragment}>
          <div className="arp-row">
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="arp-field-label" htmlFor="frag-titre">Titre du fragment</label>
              <input
                id="frag-titre"
                className="arp-input"
                value={fTitre}
                onChange={(e) => setFTitre(e.target.value)}
                placeholder="Ex : Chapitre 1 — Introduction"
              />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="arp-field-label" htmlFor="frag-ref">Reference (pages...)</label>
              <input
                id="frag-ref"
                className="arp-input"
                value={fRef}
                onChange={(e) => setFRef(e.target.value)}
                placeholder="Ex : p. 1-12"
              />
            </div>
          </div>
          <div>
            <label className="arp-field-label" htmlFor="frag-contenu">Contenu / consigne (optionnel)</label>
            <textarea
              id="frag-contenu"
              className="arp-textarea"
              value={fContenu}
              onChange={(e) => setFContenu(e.target.value)}
              placeholder="Le texte du fragment, ou la consigne de lecture."
            />
          </div>
          <div className="arp-actions">
            <button type="submit" className="btn btn-secondary" disabled={!fTitre.trim() && !fContenu.trim()}>
              Ajouter le fragment
            </button>
          </div>
        </form>
      </section>

      {/* Attribuer + restitutions par fragment */}
      <section className="arp-section">
        <h2>Fragments, attributions et restitutions</h2>
        {data.fragments.length === 0 ? (
          <p className="arp-empty">Aucun fragment. Decoupez le document ci-dessus.</p>
        ) : (
          <div className="arp-fragments">
            {data.fragments.map((f) => (
              <FragmentBloc
                key={f.id}
                fragment={f}
                restitutions={restitutionsParFragment(f.id)}
                participants={participants}
                mecanismes={mecanismes}
                onAttribuer={attribuer}
                onSupprimer={supprimerFragment}
                onRestitue={recharger}
              />
            ))}
          </div>
        )}
      </section>

      {/* Synthese collective */}
      <section className="arp-section">
        <h2>Synthese collective</h2>
        <textarea
          className="arp-textarea arp-textarea-lg"
          value={synthese}
          onChange={(e) => setSynthese(e.target.value)}
          placeholder="La mise en commun : ce que le groupe retient de la lecture fragmentee."
        />
        <div className="arp-actions">
          <button className="btn btn-primary" onClick={sauverPipeline} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer la synthese'}
          </button>
        </div>
      </section>
    </div>
  )
}

/** Bloc d'un fragment : attribution, restitutions existantes, formulaire de restitution. */
function FragmentBloc({
  fragment: f, restitutions, participants, mecanismes,
  onAttribuer, onSupprimer, onRestitue,
}: {
  fragment: ArpentageFragment
  restitutions: ArpentageRestitution[]
  participants: UtilisateurOption[]
  mecanismes: MecanismeOption[]
  onAttribuer: (fid: number, uid: string) => void
  onSupprimer: (fid: number) => void
  onRestitue: () => (Promise<void> | undefined)
}) {
  const [pointsCles, setPointsCles] = useState('')
  const [citation, setCitation] = useState('')
  const [question, setQuestion] = useState('')
  const [mecanismeId, setMecanismeId] = useState('')
  const [ouvert, setOuvert] = useState(false)

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    if (!pointsCles.trim() && !citation.trim() && !question.trim() && !mecanismeId) return
    await api.post(`/arpentages/fragments/${f.id}/restitutions`, {
      points_cles_md: pointsCles.trim() || undefined,
      citation: citation.trim() || undefined,
      question_md: question.trim() || undefined,
      mecanisme_id: mecanismeId ? Number(mecanismeId) : undefined,
    })
    setPointsCles(''); setCitation(''); setQuestion(''); setMecanismeId(''); setOuvert(false)
    await onRestitue()
  }

  return (
    <div className="arp-fragment">
      <div className="arp-fragment-head">
        <div>
          <h3 className="arp-fragment-titre">
            {f.titre || `Fragment ${f.ordre}`}
            {f.reference && <span className="arp-fragment-ref"> — {f.reference}</span>}
          </h3>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => onSupprimer(f.id)}>Retirer</button>
      </div>

      {f.contenu_md && <p className="arp-fragment-contenu">{f.contenu_md}</p>}

      <div className="arp-row">
        <label className="arp-field-label" htmlFor={`attr-${f.id}`} style={{ marginBottom: 0 }}>Lecteur attribue</label>
        <select
          id={`attr-${f.id}`}
          className="arp-select"
          style={{ maxWidth: 260 }}
          value={f.attribue_a ? String(f.attribue_a) : ''}
          onChange={(e) => onAttribuer(f.id, e.target.value)}
        >
          <option value="">Non attribue</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </select>
      </div>

      {restitutions.length > 0 && (
        <div className="arp-restitutions">
          {restitutions.map((r) => (
            <div key={r.id} className="arp-restitution">
              {r.par_nom && <p className="arp-restitution-par">{r.par_nom}</p>}
              {r.points_cles_md && <p className="arp-restitution-bloc"><strong>Points cles :</strong> {r.points_cles_md}</p>}
              {r.citation && <blockquote className="arp-restitution-citation">{r.citation}</blockquote>}
              {r.question_md && <p className="arp-restitution-bloc"><strong>Question :</strong> {r.question_md}</p>}
              {r.mecanisme_nom && <span className="arp-badge">{r.mecanisme_nom}</span>}
            </div>
          ))}
        </div>
      )}

      {ouvert ? (
        <form className="arp-restitution-form" onSubmit={envoyer}>
          <div>
            <label className="arp-field-label" htmlFor={`pc-${f.id}`}>Points cles</label>
            <textarea
              id={`pc-${f.id}`}
              className="arp-textarea"
              value={pointsCles}
              onChange={(e) => setPointsCles(e.target.value)}
              placeholder="Ce que retient le lecteur du fragment."
            />
          </div>
          <div>
            <label className="arp-field-label" htmlFor={`cit-${f.id}`}>Citation</label>
            <input
              id={`cit-${f.id}`}
              className="arp-input"
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              placeholder="Une phrase marquante du fragment."
            />
          </div>
          <div>
            <label className="arp-field-label" htmlFor={`q-${f.id}`}>Question</label>
            <input
              id={`q-${f.id}`}
              className="arp-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Une question soulevee par la lecture."
            />
          </div>
          <div>
            <label className="arp-field-label" htmlFor={`mec-${f.id}`}>Mecanisme repere (optionnel)</label>
            <select
              id={`mec-${f.id}`}
              className="arp-select"
              value={mecanismeId}
              onChange={(e) => setMecanismeId(e.target.value)}
            >
              <option value="">Aucun mecanisme</option>
              {mecanismes.map((m) => (
                <option key={m.id} value={m.id}>{m.nom}</option>
              ))}
            </select>
          </div>
          <div className="arp-actions">
            <button type="submit" className="btn btn-primary btn-sm">Enregistrer la restitution</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOuvert(false)}>Annuler</button>
          </div>
        </form>
      ) : (
        <div className="arp-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setOuvert(true)}>Ajouter une restitution</button>
        </div>
      )}
    </div>
  )
}
