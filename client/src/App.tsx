import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/useAuth'
import { useUI } from './store/useUI'
import Header from './components/layout/Header'
import Nav from './components/layout/Nav'
import Veille from './pages/Veille'
import Lire from './pages/Lire'
import Decrypter from './pages/Decrypter'
import Ateliers from './pages/Ateliers'
import MonEspace from './pages/MonEspace'
import Aide from './pages/Aide'

export default function App() {
  const fetchUser = useAuth((s) => s.fetchUser)
  const darkMode = useUI((s) => s.darkMode)

  useEffect(() => { fetchUser() }, [fetchUser])

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <Header />
      <div className="app-body">
        <Nav />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/veille" replace />} />
            <Route path="/veille" element={<Veille />} />
            <Route path="/lire/:id" element={<Lire />} />
            <Route path="/decrypter" element={<Decrypter />} />
            <Route path="/ateliers" element={<Ateliers />} />
            <Route path="/perso" element={<MonEspace />} />
            <Route path="/aide" element={<Aide />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
