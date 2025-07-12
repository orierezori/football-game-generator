import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { User, Position } from '../types/profile'
import { API_ENDPOINTS } from '../config/api'
import { errorToast, successToast } from '../utils/errorToast'

interface AdminUser {
  userId: string
  email: string
  role: 'PLAYER' | 'ADMIN'
  profile: {
    userId: string
    firstName: string
    lastName: string
    nickname: string
    selfRating: number
    primaryPosition: Position
    secondaryPosition?: Position
    source: string
    createdAt: string
  }
}

const AdminUsers: React.FC = () => {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [updatingUsers, setUpdatingUsers] = useState<Set<string>>(new Set())

  // Fetch current user info
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!token) return

      try {
        const response = await fetch(API_ENDPOINTS.ME, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const userData = await response.json()
          setCurrentUser(userData)
        }
      } catch (error) {
        console.error('Error fetching current user:', error)
      }
    }

    fetchCurrentUser()
  }, [token])

  // Redirect if not admin
  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      navigate('/home')
    }
  }, [currentUser, navigate])

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      if (!token) return

      try {
        const url = searchTerm 
          ? `${API_ENDPOINTS.ADMIN_USERS}?search=${encodeURIComponent(searchTerm)}`
          : API_ENDPOINTS.ADMIN_USERS

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to fetch users')
        }

        const userData = await response.json()
        setUsers(userData)
      } catch (error) {
        console.error('Error fetching users:', error)
        errorToast('Failed to load users')
      } finally {
        setIsLoading(false)
      }
    }

    const timeoutId = setTimeout(() => {
      fetchUsers()
    }, searchTerm ? 300 : 0) // Debounce search

    return () => clearTimeout(timeoutId)
  }, [token, searchTerm])

  const updateUserRating = async (userId: string, newRating: number) => {
    if (newRating < 1 || newRating > 10) {
      errorToast('Rating must be between 1 and 10')
      return
    }

    setUpdatingUsers(prev => new Set(prev).add(userId))

    try {
      const response = await fetch(API_ENDPOINTS.ADMIN_USER_RATING(userId), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: newRating })
      })

      if (!response.ok) {
        throw new Error('Failed to update rating')
      }

      const updatedProfile = await response.json()
      
      // Update the user in state
      setUsers(prev => prev.map(user => 
        user.userId === userId 
          ? { ...user, profile: { ...user.profile, selfRating: updatedProfile.selfRating, source: updatedProfile.source } }
          : user
      ))

      successToast('Rating updated successfully')
    } catch (error) {
      console.error('Error updating rating:', error)
      errorToast('Failed to update rating')
    } finally {
      setUpdatingUsers(prev => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    }
  }

  const updateUserPositions = async (userId: string, primaryPosition: Position, secondaryPosition?: Position) => {
    setUpdatingUsers(prev => new Set(prev).add(userId))

    try {
      const response = await fetch(API_ENDPOINTS.ADMIN_USER_POSITIONS(userId), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          primaryPosition, 
          secondaryPosition: secondaryPosition || null 
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update positions')
      }

      const updatedProfile = await response.json()
      
      // Update the user in state
      setUsers(prev => prev.map(user => 
        user.userId === userId 
          ? { 
              ...user, 
              profile: { 
                ...user.profile, 
                primaryPosition: updatedProfile.primaryPosition,
                secondaryPosition: updatedProfile.secondaryPosition
              } 
            }
          : user
      ))

      successToast('Positions updated successfully')
    } catch (error) {
      console.error('Error updating positions:', error)
      errorToast('Failed to update positions')
    } finally {
      setUpdatingUsers(prev => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    }
  }

  const positions: Position[] = ['GK', 'DEF', 'MID', 'ATT']

  if (currentUser?.role !== 'ADMIN') {
    return null // Will redirect via useEffect
  }

  return (
    <div style={{ 
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      width: '100%'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <h1 style={{ 
          margin: 0,
          fontSize: window.innerWidth <= 425 ? '1.5rem' : '2rem'
        }}>
          Manage Users
        </h1>
        <button
          onClick={() => navigate('/home')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ← Back to Home
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search by nickname or full name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '5px',
            fontSize: '16px'
          }}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '18px', color: '#666' }}>Loading users...</div>
        </div>
      )}

      {/* No users found */}
      {!isLoading && users.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '18px', color: '#666' }}>
            {searchTerm ? 'No users found matching your search.' : 'No users found.'}
          </div>
        </div>
      )}

      {/* Users table */}
      {!isLoading && users.length > 0 && (
        <div style={{ 
          overflowX: 'auto',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            minWidth: '800px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={headerStyle}>Nickname</th>
                <th style={headerStyle}>Full Name</th>
                <th style={headerStyle}>Rating</th>
                <th style={headerStyle}>Primary Position</th>
                <th style={headerStyle}>Secondary Position</th>
                <th style={headerStyle}>Source</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserRow
                  key={user.userId}
                  user={user}
                  isUpdating={updatingUsers.has(user.userId)}
                  onRatingUpdate={updateUserRating}
                  onPositionsUpdate={updateUserPositions}
                  positions={positions}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {!isLoading && users.length > 0 && (
        <div style={{ 
          marginTop: '20px', 
          textAlign: 'center', 
          color: '#666',
          fontSize: '14px'
        }}>
          {users.length} user{users.length !== 1 ? 's' : ''} found
          {searchTerm && ` for "${searchTerm}"`}
        </div>
      )}
    </div>
  )
}

// Separate component for each user row to optimize re-renders
const UserRow: React.FC<{
  user: AdminUser
  isUpdating: boolean
  onRatingUpdate: (userId: string, rating: number) => void
  onPositionsUpdate: (userId: string, primary: Position, secondary?: Position) => void
  positions: Position[]
}> = ({ user, isUpdating, onRatingUpdate, onPositionsUpdate, positions }) => {
  const [editingRating, setEditingRating] = useState(false)
  const [ratingValue, setRatingValue] = useState(user.profile.selfRating)
  const [editingPositions, setEditingPositions] = useState(false)
  const [primaryPosition, setPrimaryPosition] = useState<Position>(user.profile.primaryPosition)
  const [secondaryPosition, setSecondaryPosition] = useState<Position | ''>(user.profile.secondaryPosition || '')

  const handleRatingSubmit = () => {
    if (ratingValue !== user.profile.selfRating) {
      onRatingUpdate(user.userId, ratingValue)
    }
    setEditingRating(false)
  }

  const handleRatingCancel = () => {
    setRatingValue(user.profile.selfRating)
    setEditingRating(false)
  }

  const handlePositionsSubmit = () => {
    const hasChanges = primaryPosition !== user.profile.primaryPosition || 
                      secondaryPosition !== (user.profile.secondaryPosition || '')
    
    if (hasChanges) {
      onPositionsUpdate(user.userId, primaryPosition, secondaryPosition || undefined)
    }
    setEditingPositions(false)
  }

  const handlePositionsCancel = () => {
    setPrimaryPosition(user.profile.primaryPosition)
    setSecondaryPosition(user.profile.secondaryPosition || '')
    setEditingPositions(false)
  }

  return (
    <tr style={{ 
      borderBottom: '1px solid #eee',
      opacity: isUpdating ? 0.6 : 1,
      pointerEvents: isUpdating ? 'none' : 'auto'
    }}>
      <td style={cellStyle}>
        <strong>{user.profile.nickname}</strong>
      </td>
      <td style={cellStyle}>
        {user.profile.firstName} {user.profile.lastName}
      </td>
      <td style={cellStyle}>
        {editingRating ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input
              type="number"
              min="1"
              max="10"
              value={ratingValue}
              onChange={(e) => setRatingValue(parseInt(e.target.value) || 1)}
              style={{ width: '60px', padding: '4px', textAlign: 'center' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRatingSubmit()
                if (e.key === 'Escape') handleRatingCancel()
              }}
              autoFocus
            />
            <button onClick={handleRatingSubmit} style={smallButtonStyle('green')}>✓</button>
            <button onClick={handleRatingCancel} style={smallButtonStyle('red')}>✗</button>
          </div>
        ) : (
          <div 
            style={{ 
              cursor: 'pointer', 
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: '#f8f9fa',
              display: 'inline-block',
              minWidth: '30px',
              textAlign: 'center'
            }}
            onClick={() => setEditingRating(true)}
            title="Click to edit rating"
          >
            {user.profile.selfRating}
          </div>
        )}
      </td>
      <td style={cellStyle}>
        {editingPositions ? (
                     <select
             value={primaryPosition}
             onChange={(e) => setPrimaryPosition(e.target.value as Position)}
             style={{ padding: '4px', fontSize: '14px' }}
           >
             {positions.map(pos => (
               <option key={pos} value={pos}>{pos}</option>
             ))}
           </select>
        ) : (
          <div 
            style={{ 
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: '#f8f9fa',
              display: 'inline-block'
            }}
            onClick={() => setEditingPositions(true)}
            title="Click to edit positions"
          >
            {user.profile.primaryPosition}
          </div>
        )}
      </td>
      <td style={cellStyle}>
        {editingPositions ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                         <select
               value={secondaryPosition}
               onChange={(e) => setSecondaryPosition(e.target.value as Position | '')}
               style={{ padding: '4px', fontSize: '14px' }}
             >
               <option value="">None</option>
               {positions.map(pos => (
                 <option key={pos} value={pos}>{pos}</option>
               ))}
             </select>
            <button onClick={handlePositionsSubmit} style={smallButtonStyle('green')}>✓</button>
            <button onClick={handlePositionsCancel} style={smallButtonStyle('red')}>✗</button>
          </div>
        ) : (
          <div 
            style={{ 
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: '#f8f9fa',
              display: 'inline-block',
              minWidth: '40px'
            }}
            onClick={() => setEditingPositions(true)}
            title="Click to edit positions"
          >
            {user.profile.secondaryPosition || '—'}
          </div>
        )}
      </td>
      <td style={cellStyle}>
        <span style={{
          padding: '2px 6px',
          borderRadius: '12px',
          fontSize: '12px',
          backgroundColor: user.profile.source === 'ADMIN' ? '#ffeaa7' : '#ddd',
          color: user.profile.source === 'ADMIN' ? '#d63031' : '#666'
        }}>
          {user.profile.source}
        </span>
      </td>
    </tr>
  )
}

const headerStyle: React.CSSProperties = {
  padding: '12px',
  textAlign: 'left',
  fontWeight: 'bold',
  borderBottom: '2px solid #dee2e6'
}

const cellStyle: React.CSSProperties = {
  padding: '12px',
  verticalAlign: 'middle'
}

const smallButtonStyle = (color: 'green' | 'red'): React.CSSProperties => ({
  padding: '2px 6px',
  border: 'none',
  borderRadius: '3px',
  cursor: 'pointer',
  fontSize: '12px',
  backgroundColor: color === 'green' ? '#28a745' : '#dc3545',
  color: 'white'
})

export default AdminUsers 