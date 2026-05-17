import { useState, useEffect } from 'react'
import { useParams, Navigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Source } from '../types'
import SubNav from '../components/layout/SubNav'

const SUBNAV_ITEMS = [
  { label: 'A archiver', to: '/archiver/priorite' },
  { label: 'Archives partielles', to: '/archiver/partielles' },
  { label: 'Contribuer', to: '/archiver/contribuer' },
]

/* ---------- Section : A archiver en priorite ---------- */

function SectionPriorite() {
  const [sources, setSources] = useState<Source[]>([])
  const [url, setUrl] = useState('')
  const [archivageEnCours, setArchivageEnCours] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.get<Source[]>('/sources?sans_archive=1&ordre=consultations')
      .then(setSources).catch(() => {})
  }, [])

  const lancerArchivage = async (sourceId: number) => {
    setArchivageEnCours(sourceId)
    setMessage('')
    try {
      const res = await api.post<{ ok: boolean; statut: string }>(`/sources/${sourceId}/archiver`, {})
      const label = res.statut === 'partielle' ? 'archivee (partielle — paywall probable)' : 'archivee avec succes'
      setMessage(`Source #${sourceId} ${label}`)
      setSources((prev) => prev.filter((s) => s.id !== sourceId))
    } catch {
      setMessage(`Echec de l'archivage pour la source #${sourceId}`)
    } finally {
      setArchivageEnCours(null)
    }
  }

  const archiverDepuisUrl = async () => {
    if (!url.trim()) return
    setMessage('')
    try {
      const source = await api.post<Source>('/sources', { url: url.trim(), titre: 'Import depuis Archiver' })
      await api.post(`/sources/${source.id}/archiver`, {})
      setMessage(`Source creee et archivee : ${source.titre}`)
      setUrl('')
    } catch {
      setMessage('Echec — verifiez l\'URL')
    }
  }

  return (
    <>
      {message && <div className="alert">{message}</div>}

      <section className="archiver-section">
        <h2>Sources a archiver en priorite</h2>
        <p className="section-subtitle">Les plus consultees et commentees, sans archive complete</p>
        {sources.length === 0 ? (
          <p className="empty">Toutes les sources sont archivees !</p>
        ) : (
          <div className="archiver-list">
            {sources.map((s) => (
              <div key={s.id} className="archiver-item">
                <div className="archiver-item-info">
                  <Link to={`/lire/${s.id}`}><strong>{s.titre}</strong></Link>
                  <span className="archiver-item-meta">
                    {s.media_nom}
                    {s.paywall === 1 && <span className="badge badge-paywall">Paywall</span>}
                  </span>
                </div>
                <button
                  className="btn btn-sm"
                  disabled={archivageEnCours === s.id}
                  onClick={() => lancerArchivage(s.id)}
                >
                  {archivageEnCours === s.id ? 'En cours...' : 'Archiver'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="archiver-section">
        <h2>Archiver une URL</h2>
        <div className="archiver-url-form">
          <input
            type="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="input-url"
          />
          <button className="btn btn-primary" onClick={archiverDepuisUrl}>
            Archiver
          </button>
        </div>
      </section>
    </>
  )
}

/* ---------- Section : Archives partielles ---------- */

interface PartielleSource extends Source {
  archive_nb_mots: number
  archive_date: string
}

function SectionPartielles() {
  const [sources, setSources] = useState<PartielleSource[]>([])

  useEffect(() => {
    api.get<PartielleSource[]>('/sources/archives-partielles')
      .then(setSources).catch(() => {})
  }, [])

  return (
    <>
      <section className="archiver-section">
        <h2>Archives incompletes</h2>
        <p className="section-subtitle">
          Ces sources ont ete archivees mais le contenu est probablement tronque
          (paywall non contourne, extraction partielle). Aidez en fournissant une version complete.
        </p>
        {sources.length === 0 ? (
          <p className="empty">Aucune archive partielle detectee.</p>
        ) : (
          <div className="archiver-list">
            {sources.map((s) => (
              <div key={s.id} className="archiver-item archiver-item--partielle">
                <div className="archiver-item-info">
                  <Link to={`/lire/${s.id}`}><strong>{s.titre}</strong></Link>
                  <span className="archiver-item-meta">
                    {s.media_nom} — {s.archive_nb_mots} mots extraits
                    {s.paywall === 1 && <span className="badge badge-paywall">Paywall</span>}
                  </span>
                </div>
                <Link to={`/archiver/contribuer?source=${s.id}`} className="btn btn-sm btn-primary">
                  Completer
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

/* ---------- Section : Contribuer (archive manuelle) ---------- */

function SectionContribuer() {
  const [sourceId, setSourceId] = useState('')
  const [sourceTitre, setSourceTitre] = useState('')
  const [searchResults, setSearchResults] = useState<Source[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [mode, setMode] = useState<'texte' | 'fichier'>('texte')
  const [contenu, setContenu] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  // Pre-remplir depuis l'URL si ?source=XX
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('source')
    if (id) {
      setSourceId(id)
      api.get<{ titre: string }>(`/sources/${id}`).then((s) => setSourceTitre(s.titre)).catch(() => {})
    }
  }, [])

  // Recherche de source par titre
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    const timeout = setTimeout(() => {
      api.get<Source[]>(`/sources?limit=8`).then((all) => {
        const q = searchQuery.toLowerCase()
        setSearchResults(all.filter((s) =>
          s.titre.toLowerCase().includes(q) || s.media_nom?.toLowerCase().includes(q)
        ).slice(0, 6))
      })
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  const selectSource = (s: Source) => {
    setSourceId(String(s.id))
    setSourceTitre(s.titre)
    setSearchQuery('')
    setSearchResults([])
  }

  const soumettreTexte = async () => {
    if (!sourceId || !contenu.trim()) return
    setSending(true)
    setMessage('')
    try {
      await api.post(`/sources/${sourceId}/archive-manuelle`, { contenu: contenu.trim() })
      setMessage('Archive soumise avec succes. Merci pour votre contribution !')
      setContenu('')
    } catch {
      setMessage('Echec de la soumission.')
    } finally {
      setSending(false)
    }
  }

  const soumettreFichier = async () => {
    if (!sourceId || !fichier) return
    setSending(true)
    setMessage('')
    try {
      const formData = new FormData()
      formData.append('fichier', fichier)
      const resp = await fetch(`/api/sources/${sourceId}/archive-fichier`, {
        method: 'POST',
        body: formData,
      })
      if (!resp.ok) throw new Error()
      setMessage('Fichier soumis avec succes. Merci !')
      setFichier(null)
    } catch {
      setMessage('Echec de l\'envoi du fichier.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <section className="archiver-section">
        <h2>Contribuer une archive complete</h2>
        <p className="section-subtitle">
          Vous avez acces a l'article complet (abonnement personnel, bibliotheque, Cafeyn, Europresse...) ?
          Fournissez le contenu ci-dessous. Vos identifiants restent chez vous — nous ne les demandons jamais.
        </p>

        <div className="archiver-contribuer-form">
          {/* Selecteur de source */}
          <label className="archiver-label">
            Source concernee
            {sourceTitre ? (
              <div className="archiver-source-selected">
                <span>{sourceTitre}</span>
                <button type="button" className="btn-icon-sm" onClick={() => { setSourceId(''); setSourceTitre('') }}>×</button>
              </div>
            ) : (
              <div className="archiver-source-search">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par titre de source..."
                  className="input-url"
                />
                {searchResults.length > 0 && (
                  <ul className="archiver-source-results">
                    {searchResults.map((s) => (
                      <li key={s.id}>
                        <button type="button" onClick={() => selectSource(s)}>
                          <strong>{s.titre}</strong>
                          <span>{s.media_nom}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </label>

          {/* Mode : texte ou fichier */}
          <div className="archiver-mode-toggle">
            <button
              type="button"
              className={`archiver-mode-btn ${mode === 'texte' ? 'archiver-mode-btn--active' : ''}`}
              onClick={() => setMode('texte')}
            >
              Coller le texte
            </button>
            <button
              type="button"
              className={`archiver-mode-btn ${mode === 'fichier' ? 'archiver-mode-btn--active' : ''}`}
              onClick={() => setMode('fichier')}
            >
              Envoyer un fichier
            </button>
          </div>

          {mode === 'texte' && (
            <>
              <label className="archiver-label">
                Contenu integral (texte brut ou HTML)
                <textarea
                  value={contenu}
                  onChange={(e) => setContenu(e.target.value)}
                  placeholder="Collez ici le texte integral de l'article..."
                  rows={12}
                  className="archiver-textarea"
                />
              </label>
              <button
                className="btn btn-primary"
                onClick={soumettreTexte}
                disabled={sending || !sourceId || !contenu.trim()}
              >
                {sending ? 'Envoi...' : 'Soumettre l\'archive'}
              </button>
            </>
          )}

          {mode === 'fichier' && (
            <>
              <label className="archiver-label">
                Fichier (.md, .pdf, .html, .txt, .png, .jpg, .webp)
                <input
                  type="file"
                  accept=".md,.pdf,.html,.htm,.txt,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setFichier(e.target.files?.[0] || null)}
                  className="archiver-file-input"
                />
              </label>
              {fichier && (
                <p className="archiver-file-info">
                  Fichier selectionne : <strong>{fichier.name}</strong> ({(fichier.size / 1024).toFixed(0)} Ko)
                </p>
              )}
              <p className="archiver-file-hint">
                Pour les images (captures d'ecran) : assurez-vous qu'elles sont lisibles,
                en bonne resolution et dans le bon sens avant l'envoi.
              </p>
              <button
                className="btn btn-primary"
                onClick={soumettreFichier}
                disabled={sending || !sourceId || !fichier}
              >
                {sending ? 'Envoi...' : 'Envoyer le fichier'}
              </button>
            </>
          )}
        </div>

        {message && <div className="alert">{message}</div>}
      </section>

      <section className="archiver-section archiver-info">
        <h2>Comment ca marche ?</h2>
        <ul>
          <li>Ouvrez l'article dans votre navigateur (avec votre abonnement personnel)</li>
          <li>Option 1 : selectionnez et copiez tout le texte, puis collez-le ici</li>
          <li>Option 2 : enregistrez la page en PDF ou HTML et envoyez le fichier</li>
          <li>Option 3 : faites une capture d'ecran lisible de l'article complet</li>
          <li>Nous ne stockons aucun identifiant, mot de passe ou cookie</li>
        </ul>
        <p>
          <strong>Outils complementaires :</strong> vous pouvez utiliser
          {' '}<a href="https://wallabag.org" target="_blank" rel="noopener noreferrer">Wallabag</a>{' '}
          ou{' '}<a href="https://archivebox.io" target="_blank" rel="noopener noreferrer">ArchiveBox</a>{' '}
          pour archiver vos articles en local, puis exporter et deposer ici.
        </p>
      </section>
    </>
  )
}

/* ---------- Composant principal ---------- */

export default function Archiver() {
  const { section } = useParams<{ section?: string }>()

  if (!section) return <Navigate to="/archiver/priorite" replace />

  return (
    <div className="page-archiver">
      <h1>Archiver</h1>
      <SubNav items={SUBNAV_ITEMS} />
      <p className="page-intro">
        L'archivage preserve le contenu des sources contre la disparition des liens.
        Aidez la communaute en archivant les sources les plus consultees.
      </p>

      {section === 'priorite' && <SectionPriorite />}
      {section === 'partielles' && <SectionPartielles />}
      {section === 'contribuer' && <SectionContribuer />}
    </div>
  )
}
