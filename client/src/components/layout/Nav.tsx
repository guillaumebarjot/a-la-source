import { NavLink } from 'react-router-dom'
import { useAuth } from '../../store/useAuth'

export default function Nav() {
  const user = useAuth((s) => s.user)
  const isAnimateur = user?.role === 'animateur' || user?.role === 'admin'

  return (
    <nav className="nav">
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
  )
}
