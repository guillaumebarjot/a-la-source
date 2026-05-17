import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/useAuth'
import { useUI } from './store/useUI'
import Header from './components/layout/Header'

const Flux = lazy(() => import('./pages/Flux'))
const Lire = lazy(() => import('./pages/Lire'))
const Observatoire = lazy(() => import('./pages/Observatoire'))
const Ateliers = lazy(() => import('./pages/Ateliers'))
const Archiver = lazy(() => import('./pages/Archiver'))
const BecsRouges = lazy(() => import('./pages/BecsRouges'))
const MonEspace = lazy(() => import('./pages/MonEspace'))
const Aide = lazy(() => import('./pages/Aide'))
const AdminParametrage = lazy(() => import('./pages/AdminParametrage'))
const Projection = lazy(() => import('./pages/Projection'))
const Mecanismes = lazy(() => import('./pages/Mecanismes'))

export default function App() {
  const fetchUser = useAuth((s) => s.fetchUser)
  const darkMode = useUI((s) => s.darkMode)

  useEffect(() => { fetchUser() }, [fetchUser])

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <Header />
      <main className="main-content">
        <Suspense fallback={<div className="loading">Chargement...</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/flux" replace />} />
            <Route path="/flux" element={<Flux />} />
            <Route path="/veille" element={<Navigate to="/flux" replace />} />
            <Route path="/lire/:id" element={<Lire />} />
            <Route path="/observatoire" element={<Observatoire />} />
            <Route path="/decrypter" element={<Navigate to="/observatoire" replace />} />
            <Route path="/ateliers" element={<Ateliers />} />
            <Route path="/ateliers/:section" element={<Ateliers />} />
            <Route path="/archiver" element={<Archiver />} />
            <Route path="/archiver/:section" element={<Archiver />} />
            <Route path="/becs-rouges" element={<Navigate to="/perso/chaines" replace />} />
            <Route path="/perso" element={<MonEspace />} />
            <Route path="/perso/:section" element={<MonEspace />} />
            <Route path="/aide" element={<Aide />} />
            <Route path="/admin/parametrage" element={<AdminParametrage />} />
            <Route path="/projection" element={<Projection />} />
            <Route path="/mecanismes" element={<Mecanismes />} />
            <Route path="/mecanismes/:categorie" element={<Mecanismes />} />
            <Route path="/mecanismes/:categorie/:slug" element={<Mecanismes />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
