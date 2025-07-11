import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import GoogleLoginButton from '../components/GoogleLoginButton'
import * as storage from '../utils/storage'

vi.mock('../hooks/useScript', () => {
  return {
    useScript: () => 'ready',
  }
})

const mockLogin = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    logout: vi.fn(),
    isAuthenticated: false,
    token: null
  })
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

// Mock fetch for the auth endpoint
const mockFetch = vi.fn()
;(globalThis as any).fetch = mockFetch

describe('GoogleLoginButton', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    ;(window as any).google = {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn().mockImplementation(({ callback }) => {
            return {
              requestAccessToken: () => callback({ access_token: 'fake-token' }),
            }
          }),
        },
      },
    }
    
    // Mock the fetch call to /api/auth
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        userId: 'user_123',
        email: 'test@example.com',
        token: 'fake-token'
      })
    })
  })

  it('renders button', async () => {
    render(
      <BrowserRouter>
        <GoogleLoginButton />
      </BrowserRouter>
    )
    const btn = await screen.findByRole('button', { name: /continue with google/i })
    expect(btn).toBeInTheDocument()
  })

  it('calls login and navigates on successful login', async () => {
    render(
      <BrowserRouter>
        <GoogleLoginButton />
      </BrowserRouter>
    )
    const btn = await screen.findByRole('button', { name: /continue with google/i })
    fireEvent.click(btn)
    
    // Wait for the async operations to complete
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        'fake-token',
        expect.any(Number)
      )
    })
    
    expect(mockNavigate).toHaveBeenCalledWith('/home')
    
    // Verify the auth endpoint was called
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/auth',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: 'fake-token'
        }),
      }
    )
  })
}) 