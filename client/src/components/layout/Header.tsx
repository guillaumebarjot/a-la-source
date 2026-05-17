import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/useAuth'
import { useUI } from '../../store/useUI'

interface SubNavItem {
  label: string
  to: string
}

const SUBNAV_CONFIG: Record<string, SubNavItem[]> = {
  '/observatoire': [
    { label: 'Mecanismes', to: '/observatoire/mecanismes' },
    { label: 'Medias', to: '/observatoire/medias' },
    { label: 'Fiches medias', to: '/observatoire/fiches' },
    { label: 'Sources', to: '/observatoire/sources' },
  ],
  '/ateliers': [
    { label: 'Vivier', to: '/ateliers/vivier' },
    { label: 'Preparation', to: '/ateliers/preparation' },
    { label: 'En cours', to: '/ateliers/en-cours' },
    { label: 'Archives', to: '/ateliers/archives' },
  ],
  '/archiver': [
    { label: 'A archiver', to: '/archiver/priorite' },
    { label: 'Archives partielles', to: '/archiver/partielles' },
    { label: 'Completer', to: '/archiver/contribuer' },
  ],
  '/apprendre': [
    { label: 'Catalogue', to: '/apprendre' },
    { label: 'Aide & Ressources', to: '/apprendre/aide' },
  ],
  '/admin': [
    { label: 'Parametrage', to: '/admin/parametrage' },
    { label: 'Utilisateurs', to: '/admin/utilisateurs' },
  ],
  '/perso': [
    { label: 'Mes lectures', to: '/perso/lectures' },
    { label: 'Chaines amies', to: '/perso/chaines' },
  ],
}

function getSubNavItems(pathname: string): SubNavItem[] | null {
  // Match the longest prefix
  const keys = Object.keys(SUBNAV_CONFIG).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (pathname === key || pathname.startsWith(key + '/')) {
      return SUBNAV_CONFIG[key]
    }
  }
  return null
}

export default function Header() {
  const user = useAuth((s) => s.user)
  const { darkMode, toggleDarkMode } = useUI()
  const isAdmin = user?.role === 'admin'
  const location = useLocation()
  const subNavItems = getSubNavItems(location.pathname)

  return (
    <header className="header">
      <div className="header-band">
        <div className="header-identity">
          <img src="/logo-rc.png" alt="Rouge Coquelicot" className="header-logo" />
          <div className="header-titles">
            <h1 className="header-h1">A la source</h1>
            <h2 className="header-h2">Education populaire sur l'information</h2>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-icon" onClick={toggleDarkMode} title="Theme">
            {darkMode ? '☀️' : '🌙'}
          </button>
          {user && <span className="header-user">{user.nom}</span>}
        </div>
      </div>
      <nav className="header-nav">
        <NavLink to="/flux" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Flux
        </NavLink>
        <NavLink to="/observatoire" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Observatoire
        </NavLink>
        <NavLink to="/ateliers" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Ateliers
        </NavLink>
        <NavLink to="/archiver" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Archiver
        </NavLink>
        <NavLink to="/apprendre" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Apprendre
        </NavLink>
        <NavLink to="/perso" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Mon espace
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin/parametrage" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Admin
          </NavLink>
        )}
      </nav>
      {subNavItems && (
        <nav className="header-subnav">
          {subNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) => isActive ? 'subnav-link active' : 'subnav-link'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}
