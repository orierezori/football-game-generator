import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useScript } from '../hooks/useScript'
import { clearToken, loadToken, saveToken, StoredToken } from '../utils/storage'
import { errorToast } from '../utils/errorToast'

interface AuthContextValue {
  token: string | null
  isAuthenticated: boolean
  login: (token: string, expiry: number) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const GOOGLE_ID_SCRIPT = 'https://accounts.google.com/gsi/client'
const EXPIRY_BUFFER_MS = 5 * 60 * 1000 // 5 minutes

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stored, setStored] = useState<StoredToken | null>(null)
  const scriptStatus = useScript(GOOGLE_ID_SCRIPT)
  const [tokenClient, setTokenClient] = useState<any>(null)

  // Load token on mount
  useEffect(() => {
    const t = loadToken()
    if (t) setStored(t)
  }, [])

  // Initialise tokenClient when script ready
  useEffect(() => {
    if (scriptStatus !== 'ready') return

    if (!window.google?.accounts?.oauth2?.initTokenClient) return

    const clientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      (import.meta.env.MODE === 'test' ? 'test-client-id' : undefined)
    if (!clientId) return

    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      prompt: '', // silent if possible
      callback: (response: { access_token?: string; error?: any }) => {
        if (response.error || !response.access_token) {
          // Could not refresh silently – log out
          logout()
          return
        }
        const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
        login(response.access_token, expiry)
      },
    })
    setTokenClient(tc)
  }, [scriptStatus])

  // Silent refresh effect
  useEffect(() => {
    if (!stored || !tokenClient) return

    const handleRefresh = () => {
      if (!stored) return
      const timeLeft = stored.expiry - Date.now()
      if (timeLeft < EXPIRY_BUFFER_MS) {
        tokenClient.requestAccessToken()
      }
    }

    const interval = setInterval(handleRefresh, 60 * 1000) // check every minute
    handleRefresh() // initial check

    return () => clearInterval(interval)
  }, [stored, tokenClient])

  const login = (token: string, expiry: number) => {
    const newToken = { token, expiry }
    saveToken(newToken)
    setStored(newToken)
  }

  const logout = () => {
    clearToken()
    setStored(null)
    errorToast('Logged out')
  }

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      token: stored?.token || null,
      isAuthenticated: !!stored && stored.expiry > Date.now(),
      login,
      logout,
    }),
    [stored]
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
} 