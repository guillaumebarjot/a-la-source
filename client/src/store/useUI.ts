import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  darkMode: boolean
  toggleSidebar: () => void
  toggleDarkMode: () => void
}

export const useUI = create<UIState>((set) => ({
  sidebarOpen: true,
  // Mode clair forcé partout (jamais de thème sombre, même si l'OS est en sombre) :
  // l'app sert en atelier et en projection, le sombre nuit à la lisibilité.
  darkMode: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDarkMode: () => set(() => ({ darkMode: false })),
}))
