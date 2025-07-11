import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import RequireProfile from '../components/RequireProfile'
import { AuthProvider } from '../context/AuthContext'

// Mock fetch globally
globalThis.fetch = vi.fn()

// Mock the auth context
const mockAuth = {
  isAuthenticated: false,
  token: null as string | null,
  login: vi.fn(),
  logout: vi.fn()
}

vi.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockAuth
}))

vi.mock('../hooks/useScript', () => ({
  useScript: () => 'ready'
}))

vi.mock('../utils/errorToast', () => ({
  errorToast: vi.fn()
}))

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Navigate: ({ to }: { to: string }) => <div>Navigate to {to}</div>
  }
})

describe('RequireProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.isAuthenticated = false
    mockAuth.token = null
  })

  it('redirects to login when not authenticated', async () => {
    mockAuth.isAuthenticated = false
    
    render(
      <BrowserRouter>
        <RequireProfile>
          <div>Protected Content</div>
        </RequireProfile>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Navigate to /login')).toBeInTheDocument()
    })
  })

  it('shows loading while fetching profile', async () => {
    mockAuth.isAuthenticated = true
    mockAuth.token = 'valid-token'
    
    // Mock fetch to never resolve
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
    
    render(
      <BrowserRouter>
        <RequireProfile>
          <div>Protected Content</div>
        </RequireProfile>
      </BrowserRouter>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('redirects to register when authenticated but no profile', async () => {
    mockAuth.isAuthenticated = true
    mockAuth.token = 'valid-token'
    
    // Mock API response with no profile
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'user123', profile: null })
    } as Response)
    
    render(
      <BrowserRouter>
        <RequireProfile>
          <div>Protected Content</div>
        </RequireProfile>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Navigate to /register')).toBeInTheDocument()
    })
  })

  it('renders children when authenticated and has profile', async () => {
    mockAuth.isAuthenticated = true
    mockAuth.token = 'valid-token'
    
    // Mock API response with profile
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        userId: 'user123',
        profile: {
          userId: 'user123',
          firstName: 'John',
          lastName: 'Doe',
          nickname: 'johndoe',
          selfRating: 7,
          primaryPosition: 'MID',
          source: 'SELF',
          createdAt: '2023-01-01T00:00:00.000Z'
        }
      })
    } as Response)
    
    render(
      <BrowserRouter>
        <RequireProfile>
          <div>Protected Content</div>
        </RequireProfile>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })
  })

  it('calls API with correct authorization header', async () => {
    mockAuth.isAuthenticated = true
    mockAuth.token = 'test-token'
    
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'user123', profile: null })
    } as Response)
    
    render(
      <BrowserRouter>
        <RequireProfile>
          <div>Protected Content</div>
        </RequireProfile>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/me', {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      })
    })
  })

  it('handles API errors gracefully', async () => {
    mockAuth.isAuthenticated = true
    mockAuth.token = 'valid-token'
    
    // Mock API error
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    
    render(
      <BrowserRouter>
        <RequireProfile>
          <div>Protected Content</div>
        </RequireProfile>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Navigate to /login')).toBeInTheDocument()
    })
  })
}) 