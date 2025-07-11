import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import Home from '../pages/Home'

// Mock the useAuth hook
const mockUseAuth = {
  token: 'mock-token',
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn()
}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

// Mock the toast utilities
vi.mock('../utils/errorToast', () => ({
  errorToast: vi.fn(),
  successToast: vi.fn()
}))

import { errorToast, successToast } from '../utils/errorToast'

// Mock fetch
globalThis.fetch = vi.fn()

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  )
}

const mockUserResponse = {
  ok: true,
  json: () => Promise.resolve({
    userId: 'user_123',
    email: 'test@example.com',
    role: 'ADMIN',
    profile: {
      userId: 'user_123',
      firstName: 'Test',
      lastName: 'User',
      nickname: 'testuser',
      selfRating: 5,
      primaryPosition: 'MID',
      source: 'SELF',
      createdAt: '2024-01-01T00:00:00Z'
    }
  })
}

const mockGameResponse = (gameId: string) => ({
  ok: true,
  json: () => Promise.resolve({
    id: gameId,
    date: '2024-12-25T18:00:00Z',
    location: 'Test Stadium',
    markdown: '# Test Game',
    state: 'OPEN',
    createdBy: 'admin_123',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  })
})

const mockNoGameResponse = {
  ok: false,
  status: 404,
  json: () => Promise.resolve({ error: 'No open game found' })
}

describe('Home Component - Basic Polling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches user data and open game on mount', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockUserResponse as any)
      .mockResolvedValueOnce(mockGameResponse('game_1') as any)

    renderWithRouter(<Home />)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/me',
        expect.objectContaining({
          headers: { 'Authorization': 'Bearer mock-token' }
        })
      )
    })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/game/open',
        expect.objectContaining({
          headers: { 'Authorization': 'Bearer mock-token' }
        })
      )
    })

    // Should not show success toast on initial load
    expect(vi.mocked(successToast)).not.toHaveBeenCalled()
  })

  it('displays game information when game exists', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockUserResponse as any)
      .mockResolvedValueOnce(mockGameResponse('game_1') as any)

    renderWithRouter(<Home />)

    await waitFor(() => {
      expect(screen.getByText('🏈 Game Scheduled!')).toBeInTheDocument()
    })

    expect(screen.getByText('Test Stadium')).toBeInTheDocument()
    expect(screen.getByText(/wednesday/i)).toBeInTheDocument() // Date formatting
  })

  it('displays no game message when no game exists', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockUserResponse as any)
      .mockResolvedValueOnce(mockNoGameResponse as any)

    renderWithRouter(<Home />)

    await waitFor(() => {
      expect(screen.getByText(/no game scheduled yet/i)).toBeInTheDocument()
    })
  })

  it('shows admin tools for admin users', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockUserResponse as any)
      .mockResolvedValueOnce(mockNoGameResponse as any)

    renderWithRouter(<Home />)

    await waitFor(() => {
      expect(screen.getByText('🔧 Admin Tools')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /create new game/i })).toBeInTheDocument()
  })

  it('shows player view for non-admin users', async () => {
    const playerResponse = {
      ...mockUserResponse,
      json: () => Promise.resolve({
        ...mockUserResponse.json(),
        role: 'PLAYER'
      })
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce(playerResponse as any)
      .mockResolvedValueOnce(mockNoGameResponse as any)

    renderWithRouter(<Home />)

    await waitFor(() => {
      expect(screen.getByText(/no game scheduled yet/i)).toBeInTheDocument()
    })

    // Should not show admin tools
    expect(screen.queryByText('🔧 Admin Tools')).not.toBeInTheDocument()
  })

  it('handles user fetch errors gracefully', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockNoGameResponse as any)

    renderWithRouter(<Home />)

    await waitFor(() => {
      expect(vi.mocked(errorToast)).toHaveBeenCalledWith('Failed to load user data')
    })
  })

  it('handles game fetch errors gracefully', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockUserResponse as any)
      .mockRejectedValueOnce(new Error('Network error'))

    renderWithRouter(<Home />)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    // Should not show error toast for game fetch failures
    expect(vi.mocked(errorToast)).toHaveBeenCalledTimes(0)
  })
}) 