import { useAuth } from '../../store/useAuth'
import { useUI } from '../../store/useUI'

export default function Header() {
  const user = useAuth((s) => s.user)
  const { darkMode, toggleDarkMode } = useUI()

  return (
    <header className="header">
      <div className="header-left">
        <img src="/logo-rc.png" alt="Rouge Coquelicot" className="header-logo" />
        <h1 className="header-title">A la source</h1>
      </div>
      <div className="header-right">
        <button className="btn-icon" onClick={toggleDarkMode} title="Theme">
          {darkMode ? '☀️' : '🌙'}
        </button>
        {user && <span className="header-user">{user.nom}</span>}
      </div>
    </header>
  )
}
