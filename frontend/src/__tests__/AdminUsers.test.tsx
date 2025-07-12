import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import AdminUsers from '../pages/AdminUsers'
import { AuthProvider } from '../context/AuthContext'

// Mock the useAuth hook
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

// Mock fetch
const mockFetch = vi.fn()
Object.defineProperty(window, 'fetch', {
  value: mockFetch,
  writable: true
})

// Mock toast functions
vi.mock('../utils/errorToast', () => ({
  errorToast: vi.fn(),
  successToast: vi.fn()
}))

const mockAdminUser = {
  userId: 'admin_123',
  email: 'admin@test.com',
  role: 'ADMIN' as const,
  profile: null
}

const mockUsers = [
  {
    userId: 'user_1',
    email: 'user1@test.com',
    role: 'PLAYER' as const,
    profile: {
      userId: 'user_1',
      firstName: 'John',
      lastName: 'Doe',
      nickname: 'johnny',
      selfRating: 7,
      primaryPosition: 'MID' as const,
      secondaryPosition: 'ATT' as const,
      source: 'SELF',
      createdAt: '2023-01-01T00:00:00Z'
    }
  },
  {
    userId: 'user_2',
    email: 'user2@test.com',
    role: 'PLAYER' as const,
    profile: {
      userId: 'user_2',
      firstName: 'Jane',
      lastName: 'Smith',
      nickname: 'janes',
      selfRating: 5,
      primaryPosition: 'DEF' as const,
      secondaryPosition: undefined,
      source: 'ADMIN',
      createdAt: '2023-01-02T00:00:00Z'
    }
  }
]

const renderAdminUsers = (token = 'valid_token') => {
  const TestAuthProvider = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>
      {children}
    </AuthProvider>
  )

  // Mock the useAuth hook to return our test values
  vi.doMock('../context/AuthContext', () => ({
    useAuth: () => ({
      token,
      isAuthenticated: !!token,
      login: vi.fn(),
      logout: vi.fn()
    }),
    AuthProvider: TestAuthProvider
  }))

  return render(
    <BrowserRouter>
      <TestAuthProvider>
        <AdminUsers />
      </TestAuthProvider>
    </BrowserRouter>
  )
}

describe('AdminUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
  })

  it('should redirect non-admin users', async () => {
    const mockNonAdminUser = {
      ...mockAdminUser,
      role: 'PLAYER' as const
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNonAdminUser)
      })

    renderAdminUsers()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/home')
    })
  })

  it('should render users list for admin', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAdminUser)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUsers)
      })

    renderAdminUsers()

    await waitFor(() => {
      expect(screen.getByText('Manage Users')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText('johnny')).toBeInTheDocument()
      expect(screen.getByText('janes')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })
  })

  it('should show loading state initially', () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAdminUser)
      })
      .mockImplementationOnce(() => new Promise(() => {})) // Never resolves

    renderAdminUsers()

    expect(screen.getByText('Loading users...')).toBeInTheDocument()
  })

  it('should handle search functionality', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAdminUser)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUsers)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockUsers[0]])
      })

    renderAdminUsers()

    await waitFor(() => {
      expect(screen.getByText('johnny')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search by nickname or full name...')
    fireEvent.change(searchInput, { target: { value: 'johnny' } })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/admin/users?search=johnny',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        })
      )
    }, { timeout: 1000 })
  })

  it('should show empty state when no users found', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAdminUser)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      })

    renderAdminUsers()

    await waitFor(() => {
      expect(screen.getByText('No users found.')).toBeInTheDocument()
    })
  })

  it('should show search empty state', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAdminUser)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUsers)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      })

    renderAdminUsers()

    await waitFor(() => {
      expect(screen.getByText('johnny')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search by nickname or full name...')
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

    await waitFor(() => {
      expect(screen.getByText('No users found matching your search.')).toBeInTheDocument()
    })
  })

  it('should handle back button click', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAdminUser)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUsers)
      })

    renderAdminUsers()

    await waitFor(() => {
      expect(screen.getByText('← Back to Home')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('← Back to Home'))
    expect(mockNavigate).toHaveBeenCalledWith('/home')
  })

  it('should display user count summary', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAdminUser)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUsers)
      })

    renderAdminUsers()

    await waitFor(() => {
      expect(screen.getByText('2 users found')).toBeInTheDocument()
    })
  })

  it('should show source badges correctly', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAdminUser)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUsers)
      })

    renderAdminUsers()

    await waitFor(() => {
      expect(screen.getByText('SELF')).toBeInTheDocument()
      expect(screen.getByText('ADMIN')).toBeInTheDocument()
    })
  })
}) 