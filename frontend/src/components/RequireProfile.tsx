import React, { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { errorToast } from '../utils/errorToast'
import { User } from '../types/profile'
import { API_ENDPOINTS } from '../config/api'

interface RequireProfileProps {
  children: React.ReactNode
}

const RequireProfile: React.FC<RequireProfileProps> = ({ children }) => {
  const { token, isAuthenticated } = useAuth()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setIsLoading(false)
      return
    }

    const fetchUserProfile = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.ME, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to fetch user profile')
        }

        const userData = await response.json()
        setUser(userData)
      } catch (error) {
        console.error('Error fetching user profile:', error)
        errorToast('Failed to load profile. Please try again.')
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserProfile()
  }, [token, isAuthenticated])

  // Show loading while fetching profile
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <div>Loading...</div>
      </div>
    )
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // If authenticated but no profile, redirect to registration
  if (user && !user.profile) {
    return <Navigate to="/register" state={{ from: location }} replace />
  }

  // If authenticated and has profile, render children
  if (user && user.profile) {
    return <>{children}</>
  }

  // If user is null (error case), redirect to login
  return <Navigate to="/login" state={{ from: location }} replace />
}

export default RequireProfile 