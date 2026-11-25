'use client'

import { create } from 'zustand'
import type { User } from '@/types'
import { setToken, setRefreshToken, removeToken, removeRefreshToken, getToken, getRefreshToken } from '@/lib/auth'
import * as api from '@/lib/api'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<string | null>
  completeMfa: (challenge: string, code: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

async function startSession(tokens: api.SessionTokens): Promise<User> {
  setToken(tokens.access_token)
  setRefreshToken(tokens.refresh_token)
  try {
    return await api.getMe()
  } catch (error) {
    removeToken()
    removeRefreshToken()
    throw error
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async (email, password) => {
    const result = await api.login(email, password)
    if ('challenge_token' in result) return result.challenge_token
    const user = await startSession(result)
    set({ user, isAuthenticated: true, isLoading: false })
    return null
  },
  completeMfa: async (challenge, code) => {
    const user = await startSession(await api.completeMfa(challenge, code))
    set({ user, isAuthenticated: true, isLoading: false })
  },
  logout: () => {
    removeToken()
    removeRefreshToken()
    set({ user: null, isAuthenticated: false, isLoading: false })
  },
  checkAuth: async () => {
    if (!getToken() && !getRefreshToken()) {
      set({ user: null, isAuthenticated: false, isLoading: false })
      return
    }
    try {
      const user = await api.getMe()
      set({ user, isAuthenticated: true, isLoading: false })
    } catch {
      removeToken()
      removeRefreshToken()
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },
}))
