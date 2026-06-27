import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/useAuth'
import { useUI } from './store/useUI'
import Header from './components/layout/Header'

const Sujets = lazy(() => import('./pages/Sujets'))
const Sujet = lazy(() => import('./pages/Sujet'))
const Flux = lazy(() => import('./pages/Flux'))
const Inbox = lazy(() => import('./pages/Inbox'))
const Lire = lazy(() => import('./pages/Lire'))
const Observatoire = lazy(() => import('./pages/Observatoire'))
const Ateliers = lazy(() => import('./pages/Ateliers'))
const Atelier = lazy(() => import('./pages/Atelier'))
const Accueil = lazy(() => import('./pages/Accueil'))
// BecsRouges: route redirects to /perso/chaines, component kept but not lazy-loaded
const MonEspace = lazy(() => import('./pages/MonEspace'))
const AdminParametrage = lazy(() => import('./pages/AdminParametrage'))
const Projection = lazy(() => import('./pages/Projection'))
const Mecanismes = lazy(() => import('./pages/Mecanismes'))
const Debunkages = lazy(() => import('./pages/Debunkages'))
const Debunkage = lazy(() => import('./pages/Debunkage'))
const Parcours = lazy(() => import('./pages/Parcours'))
const ParcoursSession = lazy(() => import('./pages/ParcoursSession'))
const Activites = lazy(() => import('./pages/Activites'))
const Dossiers = lazy(() => import('./pages/Dossiers'))
const Dossier = lazy(() => import('./pages/Dossier'))
const Arpentages = lazy(() => import('./pages/Arpentages'))
const Arpentage = lazy(() => import('./pages/Arpentage'))

export default function App() {
  const fetchUser = useAuth((s) => s.fetchUser)
  const darkMode = useUI((s) => s.darkMode)

  useEffect(() => { fetchUser() }, [fetchUser])

  // Intercepteur global 401/403 : notifie l'utilisateur d'une session expirée.
  useEffect(() => {
    const handler = (e: Event) => {
      const status = (e as CustomEvent<{ status: number }>).detail?.status
      if (status === 401) {
        // On re-fetch silencieusement ; si l'utilisateur n'est plus connecté,
        // l'app le détectera et affichera l'état déconnecté.
        fetchUser()
      }
    }
    window.addEventListener('als:auth-error', handler)
    return () => window.removeEventListener('als:auth-error', handler)
  }, [fetchUser])

  return (
    <div className={`app${darkMode ? ' dark' : ''}`}>
      <Header />
      <main className="main-content">
        <Suspense fallback={<div className="loading">Chargement...</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/accueil" replace />} />
            <Route path="/accueil" element={<Accueil />} />
            <Route path="/sujets" element={<Sujets />} />
            <Route path="/sujets/:slug" element={<Sujet />} />
            <Route path="/veille" element={<Flux />} />
            <Route path="/flux" element={<Flux />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/lire/:id" element={<Lire />} />
            <Route path="/observatoire" element={<Observatoire />} />
            <Route path="/observatoire/:section" element={<Observatoire />} />
            {/* Anciennes routes supprimées (phase 3a) : score de confiance et classement retraits */}
            <Route path="/observatoire/medias" element={<Navigate to="/observatoire/fiches" replace />} />
            <Route path="/observatoire/sources" element={<Navigate to="/observatoire/catalogue" replace />} />
            <Route path="/decrypter" element={<Navigate to="/observatoire" replace />} />
            <Route path="/debunkages" element={<Debunkages />} />
            <Route path="/debunkages/:id" element={<Debunkage />} />
            {/* Hub Activités + Dossiers & décryptages */}
            <Route path="/activites" element={<Activites />} />
            <Route path="/dossiers" element={<Dossiers />} />
            <Route path="/dossiers/:id" element={<Dossier />} />
            {/* Arpentages (lecture collective fragmentee) */}
            <Route path="/arpentages" element={<Arpentages />} />
            <Route path="/arpentages/:id" element={<Arpentage />} />
            <Route path="/ateliers" element={<Ateliers />} />
            {/* /ateliers/vivier AVANT /ateliers/:id pour ne pas avaler 'vivier' comme id */}
            <Route path="/ateliers/vivier" element={<Ateliers />} />
            {/* Redirects des anciennes sections (en-cours, preparation, archives) */}
            <Route path="/ateliers/en-cours" element={<Ateliers />} />
            <Route path="/ateliers/preparation" element={<Ateliers />} />
            <Route path="/ateliers/archives" element={<Ateliers />} />
            {/* Objet atelier (id numérique) */}
            <Route path="/ateliers/:id" element={<Atelier />} />
            {/* Archiver a fondu dans l'Inbox-hub : ses fonctions sont des filtres.
                On redirige les anciennes routes vers l'Inbox avec le bon filtre,
                pour ne casser aucun lien. */}
            <Route path="/archiver" element={<Navigate to="/inbox?manque=copie_locale" replace />} />
            <Route path="/archiver/:section" element={<Navigate to="/inbox?manque=copie_locale" replace />} />
            {/* Ancienne route « sans copie locale » : redirige vers le filtre de l'Inbox. */}
            <Route path="/a-archiver" element={<Navigate to="/inbox?manque=copie_locale" replace />} />
            <Route path="/becs-rouges" element={<Navigate to="/perso/chaines" replace />} />
            <Route path="/perso" element={<MonEspace />} />
            <Route path="/perso/:section" element={<MonEspace />} />
            {/* Apprendre (ex-Mecanismes + Aide) */}
            <Route path="/apprendre" element={<Mecanismes />} />
            <Route path="/apprendre/:categorie" element={<Mecanismes />} />
            <Route path="/apprendre/:categorie/:slug" element={<Mecanismes />} />
            {/* Parcours / Quiz (cursus d'apprentissage) */}
            <Route path="/parcours" element={<Parcours />} />
            <Route path="/parcours/:id" element={<ParcoursSession />} />
            {/* Anciennes routes — redirects */}
            <Route path="/aide" element={<Navigate to="/apprendre/aide" replace />} />
            <Route path="/mecanismes" element={<Navigate to="/apprendre" replace />} />
            <Route path="/mecanismes/:categorie" element={<Navigate to="/apprendre" replace />} />
            <Route path="/mecanismes/:categorie/:slug" element={<Navigate to="/apprendre" replace />} />
            {/* Admin */}
            <Route path="/admin" element={<Navigate to="/admin/parametrage" replace />} />
            <Route path="/admin/:section" element={<AdminParametrage />} />
            <Route path="/projection/:atelierId" element={<Projection />} />
            <Route path="/projection" element={<Navigate to="/ateliers" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
