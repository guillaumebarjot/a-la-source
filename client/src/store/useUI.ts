import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  darkMode: boolean
  toggleSidebar: () => void
  toggleDarkMode: () => void
}

export const useUI = create<UIState>((set) => ({
  sidebarOpen: true,
  // Mode sombre réactivé (doctrine non négociable). Initialisé depuis localStorage
  // pour mémoriser la préférence entre sessions.
  darkMode: typeof window !== 'undefined'
    ? localStorage.getItem('darkMode') === '1'
    : false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode
    try { localStorage.setItem('darkMode', next ? '1' : '0') } catch { /* rien */ }
    return { darkMode: next }
  }),
}))
