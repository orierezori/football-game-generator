import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { User, Game } from '../types/profile'
import { API_ENDPOINTS } from '../config/api'
import { errorToast, successToast } from '../utils/errorToast'

const Home: React.FC = () => {
  const { logout, token } = useAuth()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [openGame, setOpenGame] = useState<Game | null>(null)
  const [previousGameId, setPreviousGameId] = useState<string | null>(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [isLoadingGame, setIsLoadingGame] = useState(true)

  useEffect(() => {
    const fetchUserData = async () => {
      if (!token) return
      
      try {
        const response = await fetch(API_ENDPOINTS.ME, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to fetch user data')
        }

        const userData = await response.json()
        setUser(userData)
      } catch (error) {
        console.error('Error fetching user data:', error)
        errorToast('Failed to load user data')
      } finally {
        setIsLoadingUser(false)
      }
    }

    fetchUserData()
  }, [token])

  useEffect(() => {
    const fetchOpenGame = async (isInitialLoad = false) => {
      if (!token) return
      
      try {
        const response = await fetch(API_ENDPOINTS.OPEN_GAME, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const gameData = await response.json()
          
          // Check if this is a new game (different ID from previous)
          if (!isInitialLoad && previousGameId && gameData.id !== previousGameId) {
            successToast('🏈 New game is live! Check out the details below.')
          }
          
          setOpenGame(gameData)
          setPreviousGameId(gameData.id)
        } else if (response.status === 404) {
          setOpenGame(null)
          setPreviousGameId(null)
        } else {
          throw new Error('Failed to fetch open game')
        }
      } catch (error) {
        console.error('Error fetching open game:', error)
        // Don't show error toast for game fetch - it's optional
      } finally {
        if (isInitialLoad) {
          setIsLoadingGame(false)
        }
      }
    }

    // Initial load
    fetchOpenGame(true)

    // Set up polling every 60 seconds
    const pollInterval = setInterval(() => {
      fetchOpenGame(false)
    }, 60000)

    // Cleanup interval on unmount
    return () => {
      clearInterval(pollInterval)
    }
  }, [token, previousGameId])

  const isAdmin = user?.role === 'ADMIN'

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Football Game Generator</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isLoadingUser ? (
            <span>Loading...</span>
          ) : (
            <>
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin/create-game')}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Create Game
                </button>
              )}
              <span style={{ fontSize: '14px', color: '#666' }}>
                {user?.profile?.nickname} ({user?.role})
              </span>
              <button onClick={logout} style={{ padding: '10px 20px' }}>
                Logout
              </button>
            </>
          )}
        </div>
      </div>
      
      <div style={{ marginTop: '40px' }}>
        <h2>Welcome!</h2>
        
        {/* Current Game Section */}
        <div style={{ marginBottom: '30px' }}>
          <h3>Current Game</h3>
          {isLoadingGame ? (
            <p>Loading game information...</p>
          ) : openGame ? (
            <div style={{ 
              padding: '20px', 
              backgroundColor: '#e8f5e8', 
              borderRadius: '8px',
              border: '1px solid #28a745'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#28a745' }}>
                🏈 Game Scheduled!
              </h4>
              <p><strong>Date:</strong> {formatDate(openGame.date)}</p>
              <p><strong>Location:</strong> {openGame.location}</p>
              <div style={{ marginTop: '15px' }}>
                <strong>Details:</strong>
                <div style={{ 
                  marginTop: '10px', 
                  padding: '10px', 
                  backgroundColor: 'white', 
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {openGame.markdown}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ 
              padding: '20px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px',
              border: '1px solid #dee2e6'
            }}>
              <p style={{ color: '#6c757d', margin: 0 }}>
                No game scheduled yet. {isAdmin ? 'Create a new game to get started!' : 'Check back later for updates!'}
              </p>
            </div>
          )}
        </div>
        
        {/* Admin Section */}
        {isAdmin && (
          <div style={{ 
            padding: '20px', 
            backgroundColor: '#fff3cd', 
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #ffc107'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#856404' }}>
              🔧 Admin Tools
            </h3>
            <p style={{ color: '#856404', margin: '0 0 15px 0' }}>
              You have admin access to manage games.
            </p>
            <button
              onClick={() => navigate('/admin/create-game')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              Create New Game
            </button>
          </div>
        )}
        
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#f5f5f5', 
          borderRadius: '8px',
          marginTop: '20px'
        }}>
          <h3>Next Features Coming Soon:</h3>
          <ul>
            <li>Register for games</li>
            <li>View your game history</li>
            <li>Update availability</li>
            <li>Team selection</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Home 