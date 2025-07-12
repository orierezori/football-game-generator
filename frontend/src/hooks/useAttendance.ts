import { useEffect, useState, useCallback } from 'react'
import { GameRoster, AttendanceStatus, CreateGuestPlayerRequest } from '../types/profile'
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
  registerAttendance: (action: AttendanceStatus) => Promise<{ requiresGuestRemovalDialog?: boolean }>
  refreshRoster: () => Promise<void>
  addGuest: (guestData: CreateGuestPlayerRequest) => Promise<void>
  deleteGuest: (guestId: string) => Promise<void>
  isManagingGuests: boolean
}

export function useAttendance({
  token,
  gameId,
  pollInterval = 60000 // 60 seconds default
}: UseAttendanceOptions): UseAttendanceReturn {
  const [roster, setRoster] = useState<GameRoster | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isManagingGuests, setIsManagingGuests] = useState(false)
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

  const registerAttendance = useCallback(async (action: AttendanceStatus): Promise<{ requiresGuestRemovalDialog?: boolean }> => {
    if (!token || !gameId) {
      errorToast('Missing authentication or game information')
      return {}
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

      const responseData = await response.json()
      
      // Show success message based on action
      const actionMessages = {
        CONFIRMED: 'You\'re in! 🏈',
        WAITING: 'Added to wait-list ⏳',
        OUT: 'Marked as unavailable ❌',
        LATE_CONFIRMED: 'Late registration confirmed! 🏈⏰'
      }
      successToast(actionMessages[action])
      
      // Check if response includes requiresGuestRemovalDialog flag
      if (responseData.requiresGuestRemovalDialog !== undefined) {
        // Response includes roster and requiresGuestRemovalDialog flag
        setRoster(responseData)
        return { requiresGuestRemovalDialog: responseData.requiresGuestRemovalDialog }
      } else {
        // Response is just a GameRoster
        setRoster(responseData)
        return {}
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error registering attendance:', err)
      errorToast(`Failed to register attendance: ${errorMessage}`)
      return {}
    } finally {
      setIsRegistering(false)
    }
  }, [token, gameId])

  const refreshRoster = useCallback(async (): Promise<void> => {
    await fetchRoster(true)
  }, [fetchRoster])

  const addGuest = useCallback(async (guestData: CreateGuestPlayerRequest): Promise<void> => {
    if (!token || !gameId) {
      errorToast('Missing authentication or game information')
      return
    }

    setIsManagingGuests(true)
    setError(null)

    try {
      const response = await fetch(API_ENDPOINTS.GAME_GUESTS(gameId), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(guestData)
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Game not found')
        } else if (response.status === 403) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Not authorized to add guests')
        } else if (response.status === 401) {
          throw new Error('Authentication required')
        } else if (response.status === 400) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Invalid guest data')
        } else {
          throw new Error('Failed to add guest')
        }
      }

      const updatedRoster: GameRoster = await response.json()
      setRoster(updatedRoster)
      
      // Show success message
      const totalConfirmed = updatedRoster.confirmed.length + updatedRoster.guests.confirmed.length
      const isWaiting = updatedRoster.guests.waiting.some(guest => guest.fullName === guestData.fullName)
      
      if (isWaiting) {
        successToast(`${guestData.fullName} added to wait-list ⏳`)
      } else {
        successToast(`${guestData.fullName} added to game! 🏈`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error adding guest:', err)
      throw err // Re-throw so modal can handle it
    } finally {
      setIsManagingGuests(false)
    }
  }, [token, gameId])

  const deleteGuest = useCallback(async (guestId: string): Promise<void> => {
    if (!token || !gameId) {
      errorToast('Missing authentication or game information')
      return
    }

    setIsManagingGuests(true)
    setError(null)

    try {
      const response = await fetch(API_ENDPOINTS.DELETE_GUEST(gameId, guestId), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Guest not found')
        } else if (response.status === 403) {
          throw new Error('You can only delete your own guests')
        } else if (response.status === 409) {
          throw new Error('Cannot delete guest from closed game without team rebalancing')
        } else if (response.status === 401) {
          throw new Error('Authentication required')
        } else {
          throw new Error('Failed to delete guest')
        }
      }

      const updatedRoster: GameRoster = await response.json()
      setRoster(updatedRoster)
      
      successToast('Guest removed from game ❌')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error deleting guest:', err)
      errorToast(`Failed to remove guest: ${errorMessage}`)
    } finally {
      setIsManagingGuests(false)
    }
  }, [token, gameId])

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
    refreshRoster,
    addGuest,
    deleteGuest,
    isManagingGuests
  }
} 