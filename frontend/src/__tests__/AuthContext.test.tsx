import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../context/AuthContext'
import * as storage from '../utils/storage'

vi.mock('../hooks/useScript', () => {
  return {
    useScript: () => 'ready',
  }
})

describe('AuthContext', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0) // epoch start
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('loads token from storage', () => {
    const tokenObj = { token: 't', expiry: Date.now() + 10000 }
    vi.spyOn(storage, 'loadToken').mockReturnValue(tokenObj)

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.token).toBe('t')
  })

  it('logout clears token', () => {
    const tokenObj = { token: 't', expiry: Date.now() + 10000 }
    vi.spyOn(storage, 'loadToken').mockReturnValue(tokenObj)
    const clearSpy = vi.spyOn(storage, 'clearToken')

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    act(() => {
      result.current.logout()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(clearSpy).toHaveBeenCalled()
  })

  it('refreshes token when near expiry', () => {
    const tokenObj = { token: 'old', expiry: Date.now() + 1000 }
    vi.spyOn(storage, 'loadToken').mockReturnValue(tokenObj)

    const saveSpy = vi.spyOn(storage, 'saveToken').mockImplementation(() => {})

    // mock google token client
    ;(window as any).google = {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn().mockImplementation(({ callback }) => {
            return {
              requestAccessToken: () =>
                callback({ access_token: 'new-token' }),
            }
          }),
        },
      },
    }

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    // advance timers to trigger refresh check (>1sec)
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(saveSpy).toHaveBeenCalled()
    expect(result.current.token).toBe('new-token')
  })
}) 