import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/useAuth'
import { useUI } from './store/useUI'
import Header from './components/layout/Header'

const Sujets = lazy(() => import('./pages/Sujets'))
const Sujet = lazy(() => import('./pages/Sujet'))
const Flux = lazy(() => import('./pages/Flux'))
const Lire = lazy(() => import('./pages/Lire'))
const Observatoire = lazy(() => import('./pages/Observatoire'))
const Ateliers = lazy(() => import('./pages/Ateliers'))
const Archiver = lazy(() => import('./pages/Archiver'))
// BecsRouges: route redirects to /perso/chaines, component kept but not lazy-loaded
const MonEspace = lazy(() => import('./pages/MonEspace'))
const AdminParametrage = lazy(() => import('./pages/AdminParametrage'))
const Projection = lazy(() => import('./pages/Projection'))
const Mecanismes = lazy(() => import('./pages/Mecanismes'))
const Debunkages = lazy(() => import('./pages/Debunkages'))
const Debunkage = lazy(() => import('./pages/Debunkage'))

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
            <Route path="/" element={<Navigate to="/sujets" replace />} />
            <Route path="/sujets" element={<Sujets />} />
            <Route path="/sujets/:slug" element={<Sujet />} />
            <Route path="/veille" element={<Flux />} />
            <Route path="/flux" element={<Flux />} />
            <Route path="/lire/:id" element={<Lire />} />
            <Route path="/observatoire" element={<Observatoire />} />
            <Route path="/observatoire/:section" element={<Observatoire />} />
            <Route path="/decrypter" element={<Navigate to="/observatoire" replace />} />
            <Route path="/debunkages" element={<Debunkages />} />
            <Route path="/debunkages/:id" element={<Debunkage />} />
            <Route path="/ateliers" element={<Ateliers />} />
            <Route path="/ateliers/:section" element={<Ateliers />} />
            <Route path="/archiver" element={<Archiver />} />
            <Route path="/archiver/:section" element={<Archiver />} />
            <Route path="/becs-rouges" element={<Navigate to="/perso/chaines" replace />} />
            <Route path="/perso" element={<MonEspace />} />
            <Route path="/perso/:section" element={<MonEspace />} />
            {/* Apprendre (ex-Mecanismes + Aide) */}
            <Route path="/apprendre" element={<Mecanismes />} />
            <Route path="/apprendre/:categorie" element={<Mecanismes />} />
            <Route path="/apprendre/:categorie/:slug" element={<Mecanismes />} />
            {/* Anciennes routes — redirects */}
            <Route path="/aide" element={<Navigate to="/apprendre/aide" replace />} />
            <Route path="/mecanismes" element={<Navigate to="/apprendre" replace />} />
            <Route path="/mecanismes/:categorie" element={<Navigate to="/apprendre" replace />} />
            <Route path="/mecanismes/:categorie/:slug" element={<Navigate to="/apprendre" replace />} />
            {/* Admin */}
            <Route path="/admin" element={<Navigate to="/admin/parametrage" replace />} />
            <Route path="/admin/:section" element={<AdminParametrage />} />
            <Route path="/projection/:atelierId" element={<Projection />} />
            <Route path="/projection" element={<Navigate to="/ateliers/en-cours" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
