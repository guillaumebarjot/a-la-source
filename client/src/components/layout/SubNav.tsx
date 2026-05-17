import { NavLink } from 'react-router-dom'

interface SubNavItem {
  label: string
  to: string
}

interface SubNavProps {
  items: SubNavItem[]
}

export default function SubNav({ items }: SubNavProps) {
  return (
    <nav className="subnav">
      {items.map((item) => (
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
  )
}
