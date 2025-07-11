import { useEffect, useState, useCallback } from 'react'
import { GameRoster, AttendanceStatus } from '../types/profile'
import { API_ENDPOINTS } from '../config/api'
import { errorToast, successToast } from '../utils/errorToast'

export interface UseAttendanceOptions {
  token: string | null
  gameId: string | null
  pollInterval?: number // in milliseconds, default 60 seconds
}

export interface UseAttendanceReturn {
  roster: GameRoster | null
  isLoading: boolean
  isRegistering: boolean
  error: string | null
  registerAttendance: (action: AttendanceStatus) => Promise<void>
  refreshRoster: () => Promise<void>
}

export function useAttendance({
  token,
  gameId,
  pollInterval = 60000 // 60 seconds default
}: UseAttendanceOptions): UseAttendanceReturn {
  const [roster, setRoster] = useState<GameRoster | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRoster = useCallback(async (isInitialLoad = false): Promise<void> => {
    if (!token || !gameId) {
      setRoster(null)
      return
    }

    if (isInitialLoad) {
      setIsLoading(true)
    }
    setError(null)

    try {
      const response = await fetch(API_ENDPOINTS.GAME_ATTENDANCE(gameId), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Game not found')
        } else if (response.status === 401) {
          throw new Error('Authentication required')
        } else {
          throw new Error('Failed to fetch roster')
        }
      }

      const rosterData: GameRoster = await response.json()
      setRoster(rosterData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error fetching roster:', err)
      
      // Don't show error toast for polling updates to avoid spam
      if (isInitialLoad) {
        errorToast(`Failed to load roster: ${errorMessage}`)
      }
    } finally {
      if (isInitialLoad) {
        setIsLoading(false)
      }
    }
  }, [token, gameId])

  const registerAttendance = useCallback(async (action: AttendanceStatus): Promise<void> => {
    if (!token || !gameId) {
      errorToast('Missing authentication or game information')
      return
    }

    setIsRegistering(true)
    setError(null)

    try {
      const response = await fetch(API_ENDPOINTS.GAME_ATTENDANCE(gameId), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Game not found')
        } else if (response.status === 403) {
          throw new Error('Game is not open for attendance changes')
        } else if (response.status === 401) {
          throw new Error('Authentication required')
        } else if (response.status === 400) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Invalid request')
        } else {
          throw new Error('Failed to register attendance')
        }
      }

      const updatedRoster: GameRoster = await response.json()
      setRoster(updatedRoster)
      
      // Show success message based on action
      const actionMessages = {
        CONFIRMED: 'You\'re in! 🏈',
        WAITING: 'Added to wait-list ⏳',
        OUT: 'Marked as unavailable ❌',
        LATE_CONFIRMED: 'Late registration confirmed! 🏈⏰'
      }
      successToast(actionMessages[action])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error registering attendance:', err)
      errorToast(`Failed to register attendance: ${errorMessage}`)
    } finally {
      setIsRegistering(false)
    }
  }, [token, gameId])

  const refreshRoster = useCallback(async (): Promise<void> => {
    await fetchRoster(true)
  }, [fetchRoster])

  // Set up polling for roster updates
  useEffect(() => {
    if (!token || !gameId) {
      setRoster(null)
      setIsLoading(false)
      return
    }

    // Initial load
    fetchRoster(true)

    // Set up polling interval
    const pollIntervalId = setInterval(() => {
      fetchRoster(false)
    }, pollInterval)

    // Cleanup interval on unmount or dependency change
    return () => {
      clearInterval(pollIntervalId)
    }
  }, [token, gameId, pollInterval, fetchRoster])

  return {
    roster,
    isLoading,
    isRegistering,
    error,
    registerAttendance,
    refreshRoster
  }
} 