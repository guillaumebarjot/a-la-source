import { NavLink } from 'react-router-dom'
import { useAuth } from '../../store/useAuth'
import { useUI } from '../../store/useUI'

export default function Header() {
  const user = useAuth((s) => s.user)
  const { darkMode, toggleDarkMode } = useUI()
  const isAdmin = user?.role === 'admin'

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
        <NavLink to="/perso" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Mon espace
        </NavLink>
        <NavLink to="/aide" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Aide &amp; Mecanismes
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin/parametrage" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Admin
          </NavLink>
        )}
      </nav>
    </header>
  )
}
