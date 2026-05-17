import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  darkMode: boolean
  toggleSidebar: () => void
  toggleDarkMode: () => void
}

export const useUI = create<UIState>((set) => ({
  sidebarOpen: true,
  darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
}))
