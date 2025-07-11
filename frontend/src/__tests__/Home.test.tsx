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

describe('Home Component - Markdown Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders markdown content with headings', async () => {
    const gameWithMarkdown = {
      ...mockGameResponse('game_1'),
      json: () => Promise.resolve({
        id: 'game_1',
        date: '2024-12-25T18:00:00Z',
        location: 'Test Stadium',
        markdown: '# Game Title\n\nBring your boots and water!',
        state: 'OPEN',
        createdBy: 'admin_123',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      })
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce(mockUserResponse as any)
      .mockResolvedValueOnce(gameWithMarkdown as any)

    renderWithRouter(<Home />)

    await waitFor(() => {
      expect(screen.getByText('🏈 Game Scheduled!')).toBeInTheDocument()
    })

    // Check that markdown content is rendered correctly
    const gameTitle = screen.getByText('Game Title')
    expect(gameTitle).toBeInTheDocument()
    expect(gameTitle.tagName).toBe('H1')
    expect(screen.getByText('Bring your boots and water!')).toBeInTheDocument()
  })

  it('displays formatted date matching expected pattern', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockUserResponse as any)
      .mockResolvedValueOnce(mockGameResponse('game_1') as any)

    renderWithRouter(<Home />)

    await waitFor(() => {
      expect(screen.getByText('🏈 Game Scheduled!')).toBeInTheDocument()
    })

    // Check that date is formatted as "Wednesday, Dec 25"
    const dateElement = screen.getByText(/Wednesday, Dec 25/)
    expect(dateElement).toBeInTheDocument()
    expect(dateElement.textContent).toMatch(/Wednesday, Dec 25/)
  })

  it('displays separate time formatting', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockUserResponse as any)
      .mockResolvedValueOnce(mockGameResponse('game_1') as any)

    renderWithRouter(<Home />)

    await waitFor(() => {
      expect(screen.getByText('🏈 Game Scheduled!')).toBeInTheDocument()
    })

    // Check that time is displayed separately with "at" prefix
    const timeElement = screen.getByText(/at \d{1,2}:\d{2}/)
    expect(timeElement).toBeInTheDocument()
  })

  it('shows attendance section with buttons', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockUserResponse as any)
      .mockResolvedValueOnce(mockGameResponse('game_1') as any)

    renderWithRouter(<Home />)

    await waitFor(() => {
      expect(screen.getByText('🏈 Game Scheduled!')).toBeInTheDocument()
    })

    // Check for attendance section
    expect(screen.getByText('📋 Your Attendance')).toBeInTheDocument()
    
    // Check for attendance buttons
    expect(screen.getByText("I'm In 🏈")).toBeInTheDocument()
    expect(screen.getByText('Wait-list ⏳')).toBeInTheDocument()
    expect(screen.getByText("Can't Make It ❌")).toBeInTheDocument()
    
    // Check for roster display (should show "No roster data available" initially)
    expect(screen.getByText('No roster data available')).toBeInTheDocument()
  })
})

describe('Home Component - Mobile Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly on mobile viewport (375px)', async () => {
    // Mock window.innerWidth for mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    })

    vi.mocked(fetch)
      .mockResolvedValueOnce(mockUserResponse as any)
      .mockResolvedValueOnce(mockGameResponse('game_1') as any)

    const { container } = renderWithRouter(<Home />)

    await waitFor(() => {
      expect(screen.getByText('🏈 Game Scheduled!')).toBeInTheDocument()
    })

    // Check that main container has appropriate max-width and mobile styles
    const mainContainer = container.firstChild as HTMLElement
    expect(mainContainer).toHaveStyle({ maxWidth: '600px' })
    expect(mainContainer).toHaveStyle({ width: '100%' })
    expect(mainContainer).toHaveStyle({ margin: '0 auto' })

    // Verify no horizontal scroll would occur
    expect(mainContainer.scrollWidth).toBeLessThanOrEqual(375)
  })

  it('renders correctly on desktop viewport (1024px)', async () => {
    // Mock window.innerWidth for desktop
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })

    vi.mocked(fetch)
      .mockResolvedValueOnce(mockUserResponse as any)
      .mockResolvedValueOnce(mockGameResponse('game_1') as any)

    const { container } = renderWithRouter(<Home />)

    await waitFor(() => {
      expect(screen.getByText('🏈 Game Scheduled!')).toBeInTheDocument()
    })

    // Check that main container still has max-width constraint
    const mainContainer = container.firstChild as HTMLElement
    expect(mainContainer).toHaveStyle({ maxWidth: '600px' })
    expect(mainContainer).toHaveStyle({ width: '100%' })
    expect(mainContainer).toHaveStyle({ margin: '0 auto' })
  })

  it('handles responsive title sizing', async () => {
    // Test mobile first
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    })

    vi.mocked(fetch)
      .mockResolvedValueOnce(mockUserResponse as any)
      .mockResolvedValueOnce(mockGameResponse('game_1') as any)

    renderWithRouter(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Football Game Generator')).toBeInTheDocument()
    })

    // The title should be rendered (responsive sizing is handled by inline styles)
    const titleElement = screen.getByRole('heading', { level: 1, name: /football game generator/i })
    expect(titleElement).toBeInTheDocument()
  })
}) 