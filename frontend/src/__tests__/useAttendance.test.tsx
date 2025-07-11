import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAttendance } from '../hooks/useAttendance'
import { GameRoster, AttendanceStatus } from '../types/profile'
import * as errorToast from '../utils/errorToast'

// Mock the error toast utilities
vi.mock('../utils/errorToast', () => ({
  errorToast: vi.fn(),
  successToast: vi.fn()
}))

// Mock fetch globally
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

describe('useAttendance', () => {
  const mockToken = 'test-token'
  const mockGameId = 'test-game-id'
  const mockRoster: GameRoster = {
    confirmed: [
      {
        id: '1',
        gameId: mockGameId,
        playerId: 'player1',
        status: 'CONFIRMED',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        player: {
          userId: 'player1',
          firstName: 'John',
          lastName: 'Doe',
          nickname: 'johndoe',
          selfRating: 5,
          primaryPosition: 'MID',
          source: 'SELF',
          createdAt: '2024-01-01T00:00:00Z'
        }
      }
    ],
    waiting: [
      {
        id: '2',
        gameId: mockGameId,
        playerId: 'player2',
        status: 'WAITING',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        player: {
          userId: 'player2',
          firstName: 'Jane',
          lastName: 'Smith',
          nickname: 'janesmith',
          selfRating: 6,
          primaryPosition: 'DEF',
          source: 'SELF',
          createdAt: '2024-01-01T00:00:00Z'
        }
      }
    ]
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useAttendance({ token: mockToken, gameId: mockGameId })
    )

    expect(result.current.roster).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isRegistering).toBe(false)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.registerAttendance).toBe('function')
    expect(typeof result.current.refreshRoster).toBe('function')
  })

  it('should fetch roster on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockRoster)
    })

    const { result } = renderHook(() =>
      useAttendance({ token: mockToken, gameId: mockGameId })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/game/${mockGameId}/attendance`,
      {
        headers: {
          'Authorization': `Bearer ${mockToken}`
        }
      }
    )
    expect(result.current.roster).toEqual(mockRoster)
    expect(result.current.error).toBeNull()
  })

  it('should handle fetch error on initial load', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() =>
      useAttendance({ token: mockToken, gameId: mockGameId })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.roster).toBeNull()
    expect(result.current.error).toBe('Network error')
    expect(errorToast.errorToast).toHaveBeenCalledWith('Failed to load roster: Network error')
  })

  it('should handle 404 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404
    })

    const { result } = renderHook(() =>
      useAttendance({ token: mockToken, gameId: mockGameId })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Game not found')
  })

  it('should set roster to null when token or gameId is null', () => {
    const { result: resultNoToken } = renderHook(() =>
      useAttendance({ token: null, gameId: mockGameId })
    )

    const { result: resultNoGameId } = renderHook(() =>
      useAttendance({ token: mockToken, gameId: null })
    )

    expect(resultNoToken.current.roster).toBeNull()
    expect(resultNoGameId.current.roster).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should poll for updates at specified interval', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRoster)
    })

    const pollInterval = 5000 // 5 seconds for testing
    const { result } = renderHook(() =>
      useAttendance({ token: mockToken, gameId: mockGameId, pollInterval })
    )

    // Initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    // Advance timer to trigger polling
    act(() => {
      vi.advanceTimersByTime(pollInterval)
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    // Advance timer again
    act(() => {
      vi.advanceTimersByTime(pollInterval)
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  it('should register attendance successfully', async () => {
    const updatedRoster = { ...mockRoster, confirmed: [...mockRoster.confirmed] }
    
    // Mock initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockRoster)
    })

    // Mock registration response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(updatedRoster)
    })

    const { result } = renderHook(() =>
      useAttendance({ token: mockToken, gameId: mockGameId })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.registerAttendance('CONFIRMED')
    })

    expect(mockFetch).toHaveBeenLastCalledWith(
      `http://localhost:3001/api/game/${mockGameId}/attendance`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mockToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'CONFIRMED' })
      }
    )

    expect(result.current.roster).toEqual(updatedRoster)
    expect(result.current.isRegistering).toBe(false)
    expect(errorToast.successToast).toHaveBeenCalledWith('You\'re in! 🏈')
  })

  it('should handle registration errors', async () => {
    // Mock initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockRoster)
    })

    // Mock registration error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Game is not open for attendance changes' })
    })

    const { result } = renderHook(() =>
      useAttendance({ token: mockToken, gameId: mockGameId })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.registerAttendance('CONFIRMED')
    })

    expect(result.current.error).toBe('Game is not open for attendance changes')
    expect(result.current.isRegistering).toBe(false)
    expect(errorToast.errorToast).toHaveBeenCalledWith(
      'Failed to register attendance: Game is not open for attendance changes'
    )
  })

  it('should handle registration without token or gameId', async () => {
    const { result } = renderHook(() =>
      useAttendance({ token: null, gameId: mockGameId })
    )

    await act(async () => {
      await result.current.registerAttendance('CONFIRMED')
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(errorToast.errorToast).toHaveBeenCalledWith(
      'Missing authentication or game information'
    )
  })

  it('should show correct success messages for different actions', async () => {
    // Mock initial fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRoster)
    })

    const { result } = renderHook(() =>
      useAttendance({ token: mockToken, gameId: mockGameId })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const testCases: { action: AttendanceStatus; message: string }[] = [
      { action: 'CONFIRMED', message: 'You\'re in! 🏈' },
      { action: 'WAITING', message: 'Added to wait-list ⏳' },
      { action: 'OUT', message: 'Marked as unavailable ❌' },
      { action: 'LATE_CONFIRMED', message: 'Late registration confirmed! 🏈⏰' }
    ]

    for (const testCase of testCases) {
      vi.clearAllMocks()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRoster)
      })

      await act(async () => {
        await result.current.registerAttendance(testCase.action)
      })

      expect(errorToast.successToast).toHaveBeenCalledWith(testCase.message)
    }
  })

  it('should refresh roster manually', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRoster)
    })

    const { result } = renderHook(() =>
      useAttendance({ token: mockToken, gameId: mockGameId })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Clear the initial fetch
    mockFetch.mockClear()

    await act(async () => {
      await result.current.refreshRoster()
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/game/${mockGameId}/attendance`,
      {
        headers: {
          'Authorization': `Bearer ${mockToken}`
        }
      }
    )
  })

  it('should clean up polling interval on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRoster)
    })

    const { unmount } = renderHook(() =>
      useAttendance({ token: mockToken, gameId: mockGameId })
    )

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it('should handle different HTTP error status codes for registration', async () => {
    // Mock initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockRoster)
    })

    const { result } = renderHook(() =>
      useAttendance({ token: mockToken, gameId: mockGameId })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const errorCases = [
      { status: 404, expectedError: 'Game not found' },
      { status: 401, expectedError: 'Authentication required' },
      { status: 400, expectedError: 'Invalid request', responseBody: { error: 'Invalid request' } },
      { status: 500, expectedError: 'Failed to register attendance' }
    ]

    for (const errorCase of errorCases) {
      vi.clearAllMocks()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: errorCase.status,
        json: () => Promise.resolve(errorCase.responseBody || {})
      })

      await act(async () => {
        await result.current.registerAttendance('CONFIRMED')
      })

      expect(result.current.error).toBe(errorCase.expectedError)
    }
  })
}) 