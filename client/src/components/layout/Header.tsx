import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/useAuth'

interface SubNavItem {
  label: string
  to: string
}

const SUBNAV_CONFIG: Record<string, SubNavItem[]> = {
  // Activites : Parcours retire (ne vit plus que sous Apprendre).
  '/activites': [
    { label: 'Ateliers', to: '/ateliers' },
    { label: 'Dossiers', to: '/dossiers' },
    { label: 'Debunkages', to: '/debunkages' },
  ],
  // Observatoire : porte les Mecanismes (retires d'Apprendre).
  '/observatoire': [
    { label: 'Mecanismes', to: '/observatoire/mecanismes' },
    { label: 'Medias', to: '/observatoire/medias' },
    { label: 'Fiches medias', to: '/observatoire/fiches' },
    { label: 'Couverture', to: '/observatoire/couverture' },
    { label: 'Sources', to: '/observatoire/sources' },
  ],
  '/ateliers': [
    { label: 'Vivier', to: '/ateliers/vivier' },
    { label: 'Preparation', to: '/ateliers/preparation' },
    { label: 'En cours', to: '/ateliers/en-cours' },
    { label: 'Archives', to: '/ateliers/archives' },
  ],
  // Apprendre : garde Parcours/quiz, Manuel, Aide (Mecanismes deplaces vers Observatoire).
  '/apprendre': [
    { label: 'Parcours', to: '/parcours' },
    { label: 'Manuel', to: '/apprendre/manuel' },
    { label: 'Aide & Ressources', to: '/apprendre/aide' },
  ],
  '/parcours': [
    { label: 'Parcours', to: '/parcours' },
    { label: 'Manuel', to: '/apprendre/manuel' },
    { label: 'Aide & Ressources', to: '/apprendre/aide' },
  ],
  '/admin': [
    { label: 'Parametrage', to: '/admin/parametrage' },
    { label: 'Utilisateurs', to: '/admin/utilisateurs' },
  ],
  '/perso': [
    { label: 'Mon compte', to: '/perso/compte' },
    { label: 'Mes contributions', to: '/perso/contributions' },
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
            <h2 className="header-h2">Éducation populaire aux médias</h2>
          </div>
        </div>
        <div className="header-right">
          {user && <span className="header-user">{user.nom}</span>}
        </div>
      </div>
      {/* Nav H1 : Accueil · Mon espace · Inbox · Veille · Sujets · Activites · Apprendre · Observatoire.
          Archiver retire (fondu dans l'Inbox-hub via filtres). */}
      <nav className="header-nav">
        <NavLink to="/accueil" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Accueil
        </NavLink>
        <NavLink to="/perso" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Mon espace
        </NavLink>
        <NavLink
          to="/inbox"
          className={({ isActive }) =>
            (isActive || location.pathname === '/a-archiver' || location.pathname.startsWith('/archiver')) ? 'nav-link active' : 'nav-link'
          }
        >
          Inbox
        </NavLink>
        <NavLink to="/veille" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Veille
        </NavLink>
        <NavLink to="/sujets" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Sujets
        </NavLink>
        <NavLink
          to="/activites"
          className={({ isActive }) =>
            (isActive || location.pathname.startsWith('/dossiers')) ? 'nav-link active' : 'nav-link'
          }
        >
          Activites
        </NavLink>
        <NavLink
          to="/apprendre"
          className={({ isActive }) =>
            (isActive || location.pathname.startsWith('/parcours')) ? 'nav-link active' : 'nav-link'
          }
        >
          Apprendre
        </NavLink>
        <NavLink to="/observatoire" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Observatoire
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
