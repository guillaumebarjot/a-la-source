import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/useAuth'

interface SubNavItem {
  label: string
  to: string
}

const SUBNAV_CONFIG: Record<string, SubNavItem[]> = {
  '/activites': [
    { label: 'Ateliers', to: '/ateliers' },
    { label: 'Dossiers', to: '/dossiers' },
    { label: 'Debunkages', to: '/debunkages' },
    { label: 'Parcours', to: '/parcours' },
  ],
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
  '/archiver': [
    { label: 'A archiver', to: '/archiver/priorite' },
    { label: 'Sans copie locale', to: '/a-archiver' },
    { label: 'Archives partielles', to: '/archiver/partielles' },
    { label: 'Completer', to: '/archiver/contribuer' },
  ],
  '/apprendre': [
    { label: 'Catalogue', to: '/apprendre' },
    { label: 'Parcours', to: '/parcours' },
    { label: 'Manuel', to: '/apprendre/manuel' },
    { label: 'Aide & Ressources', to: '/apprendre/aide' },
  ],
  '/parcours': [
    { label: 'Catalogue', to: '/apprendre' },
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
  // « Sans copie locale » vit hors de /archiver mais appartient au meme groupe.
  if (pathname === '/a-archiver') return SUBNAV_CONFIG['/archiver']
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
      <nav className="header-nav">
        <NavLink to="/accueil" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Accueil
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
        <NavLink to="/veille" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Veille
        </NavLink>
        <NavLink to="/observatoire" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Observatoire
        </NavLink>
        <NavLink
          to="/archiver"
          className={({ isActive }) =>
            (isActive || location.pathname === '/a-archiver') ? 'nav-link active' : 'nav-link'
          }
        >
          Archiver
        </NavLink>
        <NavLink
          to="/apprendre"
          className={({ isActive }) =>
            (isActive || location.pathname.startsWith('/parcours')) ? 'nav-link active' : 'nav-link'
          }
        >
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
