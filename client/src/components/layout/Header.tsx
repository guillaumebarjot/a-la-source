import { NavLink } from 'react-router-dom'
import { useAuth } from '../../store/useAuth'
import { useUI } from '../../store/useUI'

export default function Header() {
  const user = useAuth((s) => s.user)
  const { darkMode, toggleDarkMode } = useUI()
  const isAnimateur = user?.role === 'animateur' || user?.role === 'admin'

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
        <NavLink to="/veille" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Veille
        </NavLink>
        <NavLink to="/decrypter" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Decrypter
        </NavLink>
        <NavLink to="/ateliers" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Ateliers{isAnimateur ? '' : ' (lecture)'}
        </NavLink>
        <NavLink to="/perso" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Mon espace
        </NavLink>
        <NavLink to="/aide" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Aide
        </NavLink>
      </nav>
    </header>
  )
}
