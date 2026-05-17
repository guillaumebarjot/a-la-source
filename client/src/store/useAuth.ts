import { create } from 'zustand'
import { api } from '../api/client'
import type { Utilisateur } from '../types'

interface AuthState {
  user: Utilisateur | null
  loading: boolean
  fetchUser: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  fetchUser: async () => {
    try {
      const user = await api.get<Utilisateur>('/auth/me')
      set({ user, loading: false })
    } catch {
      set({ user: null, loading: false })
    }
  },
}))
