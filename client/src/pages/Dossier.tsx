import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { DossierDetail, EvenementOption } from '../types/dossier'
import type { Source } from '../types'
import CorpusDnD from '../components/corpus/CorpusDnD'
import EtapesActivite, { type Etape } from '../components/activite/EtapesActivite'
import '../styles/dossier.css'

// Jalons de completude FACTUELS renvoyes par GET /dossiers/:id (chantier #1).
interface DossierJalons {
  a_sujet: boolean
  a_mise_en_perspective: boolean
  a_corpus: boolean
  a_contenu: boolean
  est_publie: boolean
}

/**
 * Dossier (détail) — l'établi de fond.
 *
 * On rédige la mise en perspective et le contenu, on mobilise des sources de
 * référence (cartes image + titre), et on peut basculer le dossier en mode
 * « à chaud » (DÉCRYPTAGE) en le rattachant à un événement daté. On publie
 * enfin le dossier.
 */
export default function Dossier() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<DossierDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [evenements, setEvenements] = useState<EvenementOption[]>([])

  // Champs éditables
  const [perspective, setPerspective] = useState('')
  const [contenu, setContenu] = useState('')
  const [aChaud, setAChaud] = useState(false)
  const [evenementId, setEvenementId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // Vivier de candidates (veille) pour le glisser-déposer
  const [veille, setVeille] = useState<Source[]>([])

  // Partage hors appli
  const [copieLien, setCopieLien] = useState(false)
  const [copieYeswiki, setCopieYeswiki] = useState<'idle' | 'ok' | 'erreur'>('idle')

  const recharger = useCallback(() => {
    if (!id) return
    return api.get<DossierDetail>(`/dossiers/${id}`).then((d) => {
      setData(d)
      setPerspective(d.contenu?.mise_en_perspective_md ?? '')
      setContenu(d.contenu?.contenu_md ?? '')
      setAChaud(!!d.contenu?.a_chaud)
      setEvenementId(d.contenu?.evenement_id ? String(d.contenu.evenement_id) : '')
    })
  }, [id])

  useEffect(() => {
    recharger()?.finally(() => setLoading(false))
    api.get<EvenementOption[]>('/evenements').then(setEvenements).catch(() => setEvenements([]))
    api.get<Source[]>('/sources?limit=40').then(setVeille).catch(() => setVeille([]))
  }, [recharger])

  async function sauverContenu() {
    if (!id) return
    setSaving(true)
    try {
      await api.put(`/dossiers/${id}`, {
        mise_en_perspective_md: perspective,
        contenu_md: contenu,
        a_chaud: aChaud,
        evenement_id: aChaud ? (evenementId ? Number(evenementId) : null) : null,
      })
      setSavedAt(new Date().toLocaleTimeString())
      await recharger()
    } finally {
      setSaving(false)
    }
  }

  async function ajouterSource(sid: number, role?: string) {
    if (!id) return
    await api.post(`/dossiers/${id}/sources`, { source_id: sid, role: role || undefined })
    await recharger()
  }

  async function retirerSource(sid: number) {
    if (!id) return
    await api.delete(`/dossiers/${id}/sources/${sid}`)
    await recharger()
  }

  async function reordonner(ids: number[]) {
    if (!id) return
    await api.patch(`/dossiers/${id}/sources/order`, { source_ids: ids })
  }

  async function publier() {
    if (!id) return
    await api.post(`/dossiers/${id}/publier`, {})
    await recharger()
  }

  // Lien public absolu vers la page autoportante (hors /api).
  const lienPublic = id ? `${window.location.origin}/partage/dossier/${id}` : ''

  async function copierLien() {
    if (!lienPublic) return
    try {
      await navigator.clipboard.writeText(lienPublic)
      setCopieLien(true)
      setTimeout(() => setCopieLien(false), 2000)
    } catch {
      setCopieLien(false)
    }
  }

  async function exporterYeswiki() {
    if (!id) return
    setCopieYeswiki('idle')
    try {
      const res = await fetch(`/api/dossiers/${id}/yeswiki`)
      if (!res.ok) throw new Error('export indisponible')
      const texte = await res.text()
      await navigator.clipboard.writeText(texte)
      setCopieYeswiki('ok')
      setTimeout(() => setCopieYeswiki('idle'), 2500)
    } catch {
      setCopieYeswiki('erreur')
      setTimeout(() => setCopieYeswiki('idle'), 2500)
    }
  }

  if (loading) return <div className="loading">Chargement du dossier...</div>
  if (!data) return <div className="dossier-page"><p className="dossier-empty">Dossier introuvable.</p></div>

  const estPublie = data.statut_activite === 'publie'
  const roleById = new Map(data.sources.map((s) => [s.id, s.role]))
  const candidates = veille.filter((s) => !data.sources.some((d) => d.id === s.id))

  // Stepper : on lit les jalons factuels exposes par le serveur (cast local, le
  // type partage n'est pas modifie). Aucun jalon n'est bloquant.
  const jalons = (data as DossierDetail & { jalons?: DossierJalons }).jalons
  const allerVers = (sel: string) => {
    document.getElementById(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const etapes: Etape[] = jalons ? [
    { cle: 'sujet', label: 'Theme', fait: jalons.a_sujet,
      invitation: 'rattacher un theme au dossier' },
    { cle: 'perspective', label: 'Mise en perspective', fait: jalons.a_mise_en_perspective,
      invitation: 'rediger la mise en perspective',
      action: { libelle: 'Aller a la mise en perspective', onClick: () => allerVers('dossier-perspective') } },
    { cle: 'corpus', label: 'Corpus', fait: jalons.a_corpus,
      invitation: 'mobiliser au moins une source',
      action: { libelle: 'Aller au corpus', onClick: () => allerVers('dossier-corpus') } },
    { cle: 'contenu', label: 'Contenu', fait: jalons.a_contenu,
      invitation: 'rediger le corps du dossier',
      action: { libelle: 'Aller au contenu', onClick: () => allerVers('dossier-contenu') } },
    { cle: 'publie', label: 'Publie', fait: jalons.est_publie,
      invitation: 'publier quand vous le souhaitez (rien ne presse)',
      action: { libelle: 'Aller a la publication', onClick: () => allerVers('dossier-publier') } },
  ] : []

  return (
    <div className="dossier-page">
      <header className="dossier-header">
        <div className="dossier-row">
          <h1>{data.titre}</h1>
          {aChaud && <span className="dossier-badge chaud">A chaud</span>}
          <span className={`dossier-badge${estPublie ? ' publie' : ''}`}>
            {estPublie ? 'Publie' : 'Brouillon'}
          </span>
        </div>
        {data.sujet_slug && (
          <p className="dossier-card-sub">
            Theme : <Link to={`/sujets/${data.sujet_slug}`} className="dossier-source-titre" style={{ display: 'inline' }}>{data.sujet_titre}</Link>
          </p>
        )}
      </header>

      {etapes.length > 0 && <EtapesActivite etapes={etapes} />}

      <section className="dossier-section">
        <h2>Format</h2>
        <label className="dossier-toggle">
          <input type="checkbox" checked={aChaud} onChange={(e) => setAChaud(e.target.checked)} />
          <span>Decryptage a chaud (dossier date sur un evenement)</span>
        </label>
        {aChaud && (
          <div className="dossier-row" style={{ marginTop: 'var(--space-md)' }}>
            <label className="dossier-field-label" htmlFor="dos-ev" style={{ marginBottom: 0 }}>Evenement</label>
            <select
              id="dos-ev"
              className="dossier-select"
              style={{ maxWidth: 360 }}
              value={evenementId}
              onChange={(e) => setEvenementId(e.target.value)}
            >
              <option value="">Aucun evenement</option>
              {evenements.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.titre}{ev.date_evenement ? ` (${ev.date_evenement})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      <section className="dossier-section" id="dossier-perspective">
        <h2>Mise en perspective</h2>
        <textarea
          className="dossier-textarea"
          value={perspective}
          onChange={(e) => setPerspective(e.target.value)}
          placeholder="Le cadre, l'angle, ce qui se joue derriere le sujet."
        />
      </section>

      <section className="dossier-section" id="dossier-contenu">
        <h2>Contenu</h2>
        <textarea
          className="dossier-textarea dossier-textarea-lg"
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          placeholder="Le corps du dossier : faits, mecanismes recurrents, mise en regard des sources."
        />
        <div className="dossier-actions">
          <button className="btn btn-primary" onClick={sauverContenu} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {savedAt && <span className="dossier-card-meta">Enregistre a {savedAt}</span>}
        </div>
      </section>

      <section className="dossier-section" id="dossier-corpus">
        <h2>Sources mobilisees</h2>
        <p className="dossier-card-meta">Promène une carte de la veille vers le corpus, choisis son rôle, réordonne par la poignée.</p>
        <CorpusDnD
          vivier={candidates}
          corpus={data.sources}
          onAdd={(sid) => ajouterSource(sid)}
          onRemove={retirerSource}
          onReorder={reordonner}
          lienSource={(sid) => `/lire/${sid}`}
          titreVivier="Veille"
          titreCorpus="Corpus du dossier"
          videVivier="Aucune source disponible."
          videCorpus="Aucune source rattachée."
          renderExtra={(c) => (
            <select
              className="dossier-select"
              style={{ maxWidth: 160, marginTop: 4 }}
              value={roleById.get(c.id) || ''}
              onChange={(e) => ajouterSource(c.id, e.target.value)}
            >
              <option value="">Sans rôle</option>
              <option value="pour">Pour</option>
              <option value="neutre">Neutre</option>
              <option value="contre">Contre</option>
            </select>
          )}
        />
      </section>

      <section className="dossier-section">
        <h2>Partager hors appli</h2>
        {!estPublie && (
          <p className="dossier-empty">
            Le partage public est concu pour un dossier publie. Marquez-le comme publie ci-dessous pour diffuser une page lisible par tous.
          </p>
        )}
        <div className="dossier-partage">
          <div className="dossier-partage-bloc">
            <span className="dossier-field-label">Page publique (Discord, partage direct)</span>
            <div className="dossier-row">
              <input
                className="dossier-input"
                style={{ flex: 1, minWidth: 200 }}
                value={lienPublic}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
              />
              <button type="button" className="btn btn-secondary" onClick={copierLien}>
                {copieLien ? 'Lien copie' : 'Copier le lien'}
              </button>
              <a
                className="btn btn-secondary"
                href={lienPublic}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ouvrir
              </a>
            </div>
            <p className="dossier-card-meta">
              Cette page affiche une carte (titre, apercu, image) quand on colle le lien dans Discord.
            </p>
          </div>

          <div className="dossier-partage-bloc">
            <span className="dossier-field-label">Export YesWiki (becs-rouges.fr, rouge-coquelicot.fr)</span>
            <div className="dossier-row">
              <button type="button" className="btn btn-secondary" onClick={exporterYeswiki}>
                {copieYeswiki === 'ok'
                  ? 'Texte YesWiki copie'
                  : copieYeswiki === 'erreur'
                    ? 'Echec, reessayez'
                    : 'Exporter en YesWiki'}
              </button>
            </div>
            <p className="dossier-card-meta">
              Le texte est copie dans le presse-papiers en syntaxe YesWiki, pret a coller dans une page du wiki.
            </p>
          </div>
        </div>
      </section>

      <section className="dossier-section" id="dossier-publier">
        <div className="dossier-actions">
          <button className="btn btn-primary" onClick={publier} disabled={estPublie}>
            {estPublie ? 'Deja publie' : 'Marquer comme publie'}
          </button>
        </div>
      </section>
    </div>
  )
}

