import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Globe, FileText, AlertTriangle, Bookmark, Target, UserPlus, MessageCircle, FileUp, FolderPlus } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { api } from '../api/client'
import { useAuth } from '../store/useAuth'
import type { SourceDetail } from '../types'
import Reader from '../components/reader/Reader'
import Sidebar from '../components/sidebar/Sidebar'
import '../styles/lire.css'

type ReaderMode = 'original' | 'archive'

interface UserItem { id: number; nom: string }

export default function Lire() {
  const { id } = useParams<{ id: string }>()
  const [source, setSource] = useState<SourceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<ReaderMode>('archive')
  const user = useAuth((s) => s.user)

  // Partage a un utilisateur
  const [users, setUsers] = useState<UserItem[]>([])
  const [shareMsg, setShareMsg] = useState('')

  // Ranger dans un dossier (parcours inverse veille -> dossier)
  const [dossiers, setDossiers] = useState<{ id: number; titre: string; sujet_titre?: string | null }[]>([])
  const [dossierMsg, setDossierMsg] = useState('')

  // Corriger l'acces : remettre un lien ou une copie locale (lien mort, bot, paywall)
  const [lien, setLien] = useState('')
  const [colle, setColle] = useState('')
  const [corrMsg, setCorrMsg] = useState<string | null>(null)
  const [corrSaving, setCorrSaving] = useState(false)

  // Retour visuel des actions rapides (lire plus tard, vers atelier...).
  const [actionMsg, setActionMsg] = useState('')

  const loadSource = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const data = await api.get<SourceDetail>(`/sources/${id}`)
    setSource(data)
    setLoading(false)
  }, [id])

  useEffect(() => { loadSource() }, [loadSource])
  useEffect(() => { setLien(source?.url ?? '') }, [source?.url])

  if (loading) return <div className="loading">Chargement...</div>
  if (!source) return <div className="error">Source introuvable.</div>

  const hasUrl = !!source.url
  const hasArchive = !!source.archive
  const archivePartielle = source.archive?.statut === 'partielle'
  const isPaywall = source.paywall === 1

  function flashAction(msg: string) {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(''), 2200)
  }
  async function aLirePlusTard() {
    try { await api.post('/auth/lectures', { source_id: source!.id, statut: 'a_lire' }); flashAction('Ajoutee a vos lectures.') }
    catch { flashAction('Echec, reessayez.') }
  }
  async function proposerAtelier() {
    try { await api.patch(`/sources/${source!.id}`, { statut: 'vivier' }); flashAction('Versee au vivier des ateliers.'); loadSource() }
    catch { flashAction('Echec, reessayez.') }
  }

  async function handleShareOpenChange(open: boolean) {
    if (open && users.length === 0) {
      const all = await api.get<UserItem[]>('/auth/users')
      setUsers(all.filter(u => u.id !== user?.id))
    }
    if (!open) setShareMsg('')
  }

  async function recommander(toUserId: number) {
    await api.post('/auth/lectures', {
      source_id: source!.id,
      statut: 'recommande',
      recommande_a: toUserId,
    })
    setShareMsg('Recommandation envoyee !')
    setTimeout(() => setShareMsg(''), 1500)
  }

  function partagerDiscord() {
    const text = `${source!.titre} — ${source!.media_nom || ''}\n${source!.url || window.location.href}`
    navigator.clipboard.writeText(text)
    setShareMsg('Lien copie ! Collez-le dans Discord.')
    setTimeout(() => setShareMsg(''), 3000)
  }

  async function handleDossierOpenChange(open: boolean) {
    if (open && dossiers.length === 0) {
      const all = await api.get<{ id: number; titre: string; sujet_titre?: string | null }[]>('/dossiers')
      setDossiers(all)
    }
    if (!open) setDossierMsg('')
  }

  async function rangerDansDossier(dossierId: number) {
    await api.post(`/dossiers/${dossierId}/sources`, { source_id: source!.id })
    setDossierMsg('Rangee dans le dossier !')
    setTimeout(() => setDossierMsg(''), 1800)
  }

  // Corriger l'acces a une source bloquee (lien mort, bot, paywall) : tout est
  // contextuel a source.id, jamais a re-saisir.
  async function corriger(fn: () => Promise<void>, ok: string) {
    setCorrSaving(true); setCorrMsg(null)
    try { await fn(); setCorrMsg(ok); await loadSource() }
    catch (e) { setCorrMsg(e instanceof Error ? e.message : 'Echec') }
    finally { setCorrSaving(false) }
  }
  function remettreLien() {
    if (!lien.trim()) return
    corriger(() => api.patch(`/sources/${source!.id}`, { url: lien.trim() }), 'Lien d\'acces mis a jour.')
  }
  function collerCopie() {
    if (!colle.trim()) return
    corriger(async () => { await api.post(`/sources/${source!.id}/archive-manuelle`, { contenu: colle, type: 'html' }); setColle('') }, 'Copie locale enregistree.')
  }
  function joindreFichier(file: File | null) {
    if (!file) return
    corriger(async () => { const fd = new FormData(); fd.append('fichier', file); await api.upload(`/sources/${source!.id}/archive-fichier`, fd) }, 'Copie locale enregistree.')
  }

  return (
    <div className="page-lire">
      <div className="lire-header">
        <h1 className="lire-title">{source.titre}</h1>
        {source.url && (
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">
            Original ↗
          </a>
        )}
      </div>
      <div className="lire-reader-toolbar">
        <Link to="/flux" className="back-link">← Retour</Link>
        <div className="reader-mode-toggle">
          <button
            className={`reader-mode-btn ${mode === 'original' ? 'reader-mode-btn--active' : ''}`}
            onClick={() => setMode('original')}
            disabled={!hasUrl}
            title={hasUrl ? 'Afficher la source originale (site web)' : "Pas d'URL disponible"}
          >
            <Globe size={14} /> Source
          </button>
          <button
            className={`reader-mode-btn ${mode === 'archive' ? 'reader-mode-btn--active' : ''}`}
            onClick={() => setMode('archive')}
            disabled={!hasArchive}
            title={hasArchive ? 'Afficher la copie locale extraite' : 'Pas de copie locale disponible'}
          >
            <FileText size={14} /> Locale {archivePartielle && <AlertTriangle size={14} />}
          </button>
        </div>
        <div className="lire-quick-actions">
          {user && (
            <>
              <button className="btn-action-sm" onClick={aLirePlusTard} title="A lire plus tard"><Bookmark size={14} /> Lire plus tard</button>
              {source.statut === 'veille' && (
                <button className="btn-action-sm" onClick={proposerAtelier} title="Proposer pour un atelier"><Target size={14} /> Vers atelier</button>
              )}
              <DropdownMenu.Root onOpenChange={handleShareOpenChange}>
                <DropdownMenu.Trigger asChild>
                  <button className="btn-action-sm" title="Recommander a un membre"><UserPlus size={14} /> Partager</button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="share-dropdown" sideOffset={4}>
                    <div className="share-dropdown-section">
                      <span className="share-dropdown-label">Recommander a :</span>
                      {users.length === 0 && <span className="share-dropdown-empty">Aucun membre</span>}
                      {users.map(u => (
                        <DropdownMenu.Item key={u.id} className="share-dropdown-item" onSelect={() => recommander(u.id)}>
                          {u.nom}
                        </DropdownMenu.Item>
                      ))}
                    </div>
                    <DropdownMenu.Separator className="share-dropdown-divider" />
                    <DropdownMenu.Item className="share-dropdown-item" onSelect={partagerDiscord}>
                      <MessageCircle size={14} /> Copier pour Discord
                    </DropdownMenu.Item>
                    {shareMsg && <div className="share-dropdown-msg">{shareMsg}</div>}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              <DropdownMenu.Root onOpenChange={handleDossierOpenChange}>
                <DropdownMenu.Trigger asChild>
                  <button className="btn-action-sm" title="Ranger cette source dans un dossier"><FolderPlus size={14} /> Dossier</button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="share-dropdown" sideOffset={4}>
                    <div className="share-dropdown-section">
                      <span className="share-dropdown-label">Ranger dans :</span>
                      {dossiers.length === 0 && <span className="share-dropdown-empty">Aucun dossier</span>}
                      {dossiers.map(d => (
                        <DropdownMenu.Item key={d.id} className="share-dropdown-item" onSelect={() => rangerDansDossier(d.id)}>
                          {d.titre}{d.sujet_titre ? ` · ${d.sujet_titre}` : ''}
                        </DropdownMenu.Item>
                      ))}
                    </div>
                    {dossierMsg && <div className="share-dropdown-msg">{dossierMsg}</div>}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </>
          )}
          <a href="#corriger-acces" className="btn-action-sm" title="Remettre un lien ou une copie locale"><FileUp size={14} /> Corriger l'acces</a>
        </div>
        {actionMsg && <span className="lire-action-msg" role="status" style={{ fontSize: '0.8rem', color: 'var(--color-success, #2e7d32)' }}>{actionMsg}</span>}
      </div>

      {/* Corriger l'acces : remettre un lien ou une copie locale, contextuel a la source. */}
      <details id="corriger-acces" className="lire-corriger" open={isPaywall || archivePartielle}>
        <summary>
          Corriger l'acces : remettre un lien ou une copie locale (lien mort, bot, paywall)
        </summary>
        <div className="lire-corriger-corps">
          <div className="lire-corriger-ligne">
            <input
              type="url"
              value={lien}
              onChange={(e) => setLien(e.target.value)}
              placeholder="Lien d'acces (source originale, version sans paywall...)"
            />
            <button type="button" className="btn btn-sm btn-secondary" disabled={corrSaving || !lien.trim()} onClick={remettreLien}>
              Mettre a jour le lien
            </button>
          </div>
          <textarea
            value={colle}
            onChange={(e) => setColle(e.target.value)}
            placeholder="Coller ici le texte integral (Europresse, archive...)"
            rows={4}
          />
          <div className="lire-corriger-ligne">
            <button type="button" className="btn btn-sm btn-primary" disabled={corrSaving || !colle.trim()} onClick={collerCopie}>
              Enregistrer le texte colle
            </button>
            <label className="btn btn-sm btn-secondary">
              Joindre un PDF
              <input
                type="file"
                accept=".pdf,.md,.png,.jpg,.jpeg,.webp"
                style={{ display: 'none' }}
                disabled={corrSaving}
                onChange={(e) => joindreFichier(e.target.files?.[0] ?? null)}
              />
            </label>
            {corrMsg && <span className="lire-corriger-msg">{corrMsg}</span>}
          </div>
        </div>
      </details>

      <div className="lire-body">
        <div className="lire-reader">
          {mode === 'original' && hasUrl ? (
            <div className="reader-original">
              {isPaywall && !hasArchive && (
                <div className="reader-archive-warning">
                  Source protegee par un paywall, aucune copie locale complete disponible.{' '}
                  <a href="#corriger-acces">Remettre un lien ou une copie locale</a>
                </div>
              )}
              <iframe
                src={source.url!}
                sandbox="allow-same-origin allow-scripts"
                className="reader-iframe"
                title={source.titre}
              />
              <p className="reader-fallback">
                <a href={source.url!} target="_blank" rel="noopener noreferrer">
                  Ouvrir dans un nouvel onglet
                </a>
              </p>
            </div>
          ) : (
            <Reader
              archive={source.archive}
              url={source.url}
              sourceId={source.id}
              onArchived={loadSource}
            />
          )}
        </div>
        <Sidebar source={source} onRefresh={loadSource} />
      </div>
    </div>
  )
}
