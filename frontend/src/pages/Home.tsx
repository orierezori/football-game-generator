import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { User, Game, GuestFormData, AttendanceStatus } from '../types/profile'
import { API_ENDPOINTS } from '../config/api'
import { errorToast, successToast } from '../utils/errorToast'
import MarkdownRenderer from '../components/MarkdownRenderer'
import AddGuestModal from '../components/AddGuestModal'
import { useAttendance } from '../hooks/useAttendance'

const Home: React.FC = () => {
  const { logout, token } = useAuth()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [openGame, setOpenGame] = useState<Game | null>(null)
  const [previousGameId, setPreviousGameId] = useState<string | null>(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [isLoadingGame, setIsLoadingGame] = useState(true)
  const [isAddGuestModalOpen, setIsAddGuestModalOpen] = useState(false)
  const [showGuestRemovalDialog, setShowGuestRemovalDialog] = useState(false)
  
  // Attendance hook - only active when we have an open game
  const { 
    roster, 
    isLoading: isLoadingRoster, 
    isRegistering, 
    registerAttendance,
    addGuest,
    deleteGuest,
    isManagingGuests
  } = useAttendance({
    token,
    gameId: openGame?.id || null,
    pollInterval: 60000 // 60 second polling interval
  })

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
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleAddGuest = async (guestData: GuestFormData) => {
    await addGuest(guestData)
  }

  const handleDeleteGuest = async (guestId: string) => {
    if (window.confirm('Are you sure you want to remove this guest?')) {
      await deleteGuest(guestId)
    }
  }

  const handleAttendanceChange = async (action: AttendanceStatus) => {
    const result = await registerAttendance(action)
    if (result.requiresGuestRemovalDialog) {
      setShowGuestRemovalDialog(true)
    }
  }

  const handleGuestRemovalConfirm = async () => {
    // Remove all guests for the current user
    for (const guest of userGuests) {
      await deleteGuest(guest.id)
    }
    setShowGuestRemovalDialog(false)
  }

  const handleGuestRemovalCancel = () => {
    setShowGuestRemovalDialog(false)
  }

  // Check if current user is registered for the game
  const userAttendance = roster?.confirmed.find(att => att.playerId === user?.userId) ||
                        roster?.waiting.find(att => att.playerId === user?.userId)
  const isUserRegistered = userAttendance && userAttendance.status !== 'OUT'

  // Get current user's guests
  const userGuests = roster ? [
    ...roster.guests.confirmed.filter(guest => guest.inviterId === user?.userId),
    ...roster.guests.waiting.filter(guest => guest.inviterId === user?.userId)
  ] : []

  return (
    <div style={{ 
      padding: '20px',
      maxWidth: '600px',
      margin: '0 auto',
      width: '100%'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <h1 style={{ 
          margin: 0,
          fontSize: window.innerWidth <= 425 ? '1.5rem' : '2rem'
        }}>
          Football Game Generator
        </h1>
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          alignItems: 'center', 
          flexWrap: 'wrap',
          justifyContent: window.innerWidth <= 425 ? 'center' : 'flex-end'
        }}>
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
              border: '1px solid #28a745',
              display: 'flex',
              flexDirection: 'column',
              gap: '15px'
            }}>
              <h4 style={{ margin: '0', color: '#28a745' }}>
                🏈 Game Scheduled!
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: 0 }}>
                  <strong>Date:</strong> {formatDate(openGame.date)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Time:</strong> at {formatTime(openGame.date)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Location:</strong> {openGame.location}
                </p>
              </div>
              <div>
                <strong>Details:</strong>
                <div style={{ 
                  marginTop: '10px', 
                  padding: '15px', 
                  backgroundColor: 'white', 
                  borderRadius: '4px',
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}>
                  <MarkdownRenderer markdown={openGame.markdown} />
                </div>
              </div>
              {/* Attendance Section */}
              <div style={{ 
                marginTop: '15px',
                padding: '15px',
                backgroundColor: 'rgba(255, 255, 255, 0.5)',
                borderRadius: '4px'
              }}>
                <h5 style={{ margin: '0 0 15px 0', color: '#28a745' }}>
                  📋 Your Attendance
                </h5>
                
                {/* Attendance Buttons */}
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  marginBottom: '20px',
                  flexWrap: 'wrap'
                }}>
                  {/* Show "I'm In" button only if player is not registered */}
                  {!isUserRegistered && (
                    <button
                      onClick={() => handleAttendanceChange('CONFIRMED')}
                      disabled={isRegistering}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor: isRegistering ? '#ccc' : '#28a745',
                        color: 'white',
                        fontSize: '14px',
                        cursor: isRegistering ? 'not-allowed' : 'pointer',
                        minHeight: '36px',
                        flex: 1,
                        minWidth: '80px'
                      }}
                    >
                      {isRegistering ? '...' : "I'm In 🏈"}
                    </button>
                  )}
                  {/* Show "Can't Make It" button only if player is registered */}
                  {isUserRegistered && (
                    <button
                      onClick={() => handleAttendanceChange('OUT')}
                      disabled={isRegistering}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor: isRegistering ? '#ccc' : '#dc3545',
                        color: 'white',
                        fontSize: '14px',
                        cursor: isRegistering ? 'not-allowed' : 'pointer',
                        minHeight: '36px',
                        flex: 1,
                        minWidth: '120px'
                      }}
                    >
                      {isRegistering ? '...' : "Can't Make It ❌"}
                    </button>
                  )}
                </div>

                {/* Add Friend Button */}
                <div style={{ marginBottom: '20px' }}>
                  <button
                    onClick={() => setIsAddGuestModalOpen(true)}
                    disabled={isManagingGuests}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '4px',
                      border: '1px solid #28a745',
                      backgroundColor: isManagingGuests ? '#ccc' : 'white',
                      color: isManagingGuests ? 'white' : '#28a745',
                      fontSize: '14px',
                      cursor: isManagingGuests ? 'not-allowed' : 'pointer',
                      minHeight: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    👥 {isManagingGuests ? 'Adding...' : 'Add Friend'}
                  </button>
                </div>

                {/* User's Guests Display */}
                {userGuests.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h6 style={{ margin: '0 0 8px 0', color: '#17a2b8' }}>
                      👥 Your Friends ({userGuests.length})
                    </h6>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      {userGuests.map((guest) => (
                        <div
                          key={guest.id}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: guest.status === 'CONFIRMED' ? '#d1ecf1' : '#fff3cd',
                            borderRadius: '8px',
                            border: `1px solid ${guest.status === 'CONFIRMED' ? '#17a2b8' : '#ffc107'}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '14px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 'bold' }}>{guest.fullName}</span>
                            <span style={{ 
                              padding: '2px 6px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              borderRadius: '10px',
                              fontSize: '11px'
                            }}>
                              {guest.primaryPosition}
                            </span>
                            {guest.secondaryPosition && (
                              <span style={{ 
                                padding: '2px 6px',
                                backgroundColor: '#6c757d',
                                color: 'white',
                                borderRadius: '10px',
                                fontSize: '11px'
                              }}>
                                {guest.secondaryPosition}
                              </span>
                            )}
                            <span style={{ 
                              padding: '2px 6px',
                              backgroundColor: '#28a745',
                              color: 'white',
                              borderRadius: '10px',
                              fontSize: '11px'
                            }}>
                              ⭐{guest.selfRating}
                            </span>
                            {guest.status === 'WAITING' && (
                              <span style={{ color: '#856404', fontSize: '12px' }}>
                                (Wait-list)
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteGuest(guest.id)}
                            disabled={isManagingGuests}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#dc3545',
                              cursor: isManagingGuests ? 'not-allowed' : 'pointer',
                              padding: '4px',
                              fontSize: '16px'
                            }}
                            title="Remove friend"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Roster Display */}
                {isLoadingRoster && !roster ? (
                  <div style={{ textAlign: 'center', color: '#666' }}>
                    Loading roster...
                  </div>
                ) : roster ? (
                  <div>
                    {/* Confirmed Players */}
                    <div style={{ marginBottom: '15px' }}>
                      <h6 style={{ margin: '0 0 8px 0', color: '#28a745' }}>
                        ✅ Confirmed ({roster.confirmed.length + roster.guests.confirmed.length}/24)
                      </h6>
                      {roster.confirmed.length > 0 ? (
                        <div style={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: '4px',
                          fontSize: '12px'
                        }}>
                                                     {roster.confirmed.map((attendance) => (
                             <span
                               key={attendance.id}
                               style={{
                                 padding: '4px 8px',
                                 backgroundColor: '#d4edda',
                                 borderRadius: '12px',
                                 color: '#155724',
                                 fontSize: '12px'
                               }}
                             >
                               {attendance.player.nickname}
                             </span>
                           ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          No confirmed players yet
                        </div>
                      )}
                    </div>
                    
                    {/* Waiting Players */}
                    {roster.waiting.length > 0 && (
                      <div>
                        <h6 style={{ margin: '0 0 8px 0', color: '#ffc107' }}>
                          ⏳ Wait-list ({roster.waiting.length})
                        </h6>
                        <div style={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: '4px',
                          fontSize: '12px'
                        }}>
                                                     {roster.waiting.map((attendance) => (
                             <span
                               key={attendance.id}
                               style={{
                                 padding: '4px 8px',
                                 backgroundColor: '#fff3cd',
                                 borderRadius: '12px',
                                 color: '#856404',
                                 fontSize: '12px'
                               }}
                             >
                               {attendance.player.nickname}
                             </span>
                           ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
                    No roster data available
                  </div>
                )}
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
              You have admin access to manage games and users.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
              <button
                onClick={() => navigate('/admin/users')}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                Manage Users
              </button>
            </div>
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

      {/* Guest Removal Dialog */}
      {showGuestRemovalDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Remove Your Friends?</h3>
            <p style={{ margin: '0 0 20px 0', color: '#666' }}>
              You've marked yourself as unavailable. Do you want to remove all your friends from this game as well?
            </p>
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={handleGuestRemovalCancel}
                style={{
                  padding: '12px 20px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  color: '#666',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Keep Friends
              </button>
              <button
                onClick={handleGuestRemovalConfirm}
                style={{
                  padding: '12px 20px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Remove Friends
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Guest Modal */}
      <AddGuestModal
        isOpen={isAddGuestModalOpen}
        onClose={() => setIsAddGuestModalOpen(false)}
        onSubmit={handleAddGuest}
        isSubmitting={isManagingGuests}
      />
    </div>
  )
}

export default Home 