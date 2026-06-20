import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/globals.css'
import './styles/projection.css'

// Chunk de page lazy devenu obsolete apres un redeploiement : Vite emet
// `vite:preloadError` quand un import dynamique echoue. On recharge une fois pour
// recuperer le build a jour (evite de rester bloque sur « Chargement... »).
let rechargePreload = false
window.addEventListener('vite:preloadError', () => {
  if (rechargePreload) return
  rechargePreload = true
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
