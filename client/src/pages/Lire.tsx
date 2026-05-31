import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Globe, FileText, AlertTriangle, Bookmark, Target, UserPlus, MessageCircle, FileUp } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { api } from '../api/client'
import { useAuth } from '../store/useAuth'
import type { SourceDetail } from '../types'
import Reader from '../components/reader/Reader'
import Sidebar from '../components/sidebar/Sidebar'

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

  const loadSource = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const data = await api.get<SourceDetail>(`/sources/${id}`)
    setSource(data)
    setLoading(false)
  }, [id])

  useEffect(() => { loadSource() }, [loadSource])

  if (loading) return <div className="loading">Chargement...</div>
  if (!source) return <div className="error">Source introuvable.</div>

  const hasUrl = !!source.url
  const hasArchive = !!source.archive
  const archivePartielle = source.archive?.statut === 'partielle'
  const isPaywall = source.paywall === 1

  async function aLirePlusTard() {
    await api.post('/auth/lectures', { source_id: source!.id, statut: 'a_lire' })
  }
  async function proposerAtelier() {
    await api.patch(`/sources/${source!.id}`, { statut: 'vivier' })
    loadSource()
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
            </>
          )}
          <Link to={`/archiver/contribuer?source=${source.id}`} className="btn-action-sm" title="Deposer une copie locale de cette source"><FileUp size={14} /> Contribuer</Link>
        </div>
      </div>
      <div className="lire-body">
        <div className="lire-reader">
          {mode === 'original' && hasUrl ? (
            <div className="reader-original">
              {isPaywall && !hasArchive && (
                <div className="reader-archive-warning">
                  Source protegee par un paywall — aucune copie locale complete disponible.{' '}
                  <Link to={`/archiver/contribuer?source=${source.id}`}>Deposer une archive</Link>
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
