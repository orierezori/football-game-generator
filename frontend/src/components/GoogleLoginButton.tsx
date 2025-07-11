import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScript } from '../hooks/useScript'
import { saveToken } from '../utils/storage'
import { errorToast } from '../utils/errorToast'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config/api'

declare global {
  interface Window {
    google?: any
  }
}

const GOOGLE_ID_SCRIPT = 'https://accounts.google.com/gsi/client'

function GoogleLoginButton() {
  const buttonContainerRef = useRef<HTMLDivElement>(null)
  const scriptStatus = useScript(GOOGLE_ID_SCRIPT)
  const [disabled, setDisabled] = useState(!navigator.onLine)
  const [tokenClient, setTokenClient] = useState<any>(null)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleOfflineChange = () => {
    setDisabled(!navigator.onLine)
  }

  useEffect(() => {
    window.addEventListener('online', handleOfflineChange)
    window.addEventListener('offline', handleOfflineChange)

    return () => {
      window.removeEventListener('online', handleOfflineChange)
      window.removeEventListener('offline', handleOfflineChange)
    }
  }, [])

  useEffect(() => {
    if (scriptStatus !== 'ready') {
      return
    }

    if (!window.google?.accounts?.oauth2?.initTokenClient) {
      console.error('Google Identity Services unavailable')
      return
    }

    const clientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      (import.meta.env.MODE === 'test' ? 'test-client-id' : undefined)
    if (!clientId) {
      console.error('Missing VITE_GOOGLE_CLIENT_ID env variable')
      return
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: async (response: { access_token?: string; error?: any }) => {
        if (response.error || !response.access_token) {
          errorToast('Login failed. Please try again.')
          return
        }

        try {
          // Call backend auth endpoint to extract email and create/update user
          const authResponse = await fetch(`${API_BASE_URL}/api/auth`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              token: response.access_token
            }),
          })

          if (!authResponse.ok) {
            throw new Error('Authentication failed')
          }

          const authData = await authResponse.json()
          
          // Use the token for subsequent API calls
          const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days expiry assumption
          login(authData.token, expiry)
          navigate('/home')
        } catch (error) {
          console.error('Authentication error:', error)
          errorToast('Login failed. Please try again.')
        }
      },
    })

    setTokenClient(tokenClient)

  }, [scriptStatus, login, navigate])

  const handleClick = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken()
    }
  }

  return (
    <div>
      {!navigator.onLine && (
        <p style={{ color: 'red' }}>
          You are offline. Connect to the internet to log in.
        </p>
      )}
      <button
        onClick={handleClick}
        disabled={disabled || !tokenClient}
        aria-label="Continue with Google"
      >
        Continue with Google
      </button>
    </div>
  )
}

export default GoogleLoginButton 