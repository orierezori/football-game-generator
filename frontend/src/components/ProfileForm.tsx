import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ProfileFormData, ProfileFormErrors, Position } from '../types/profile'
import { errorToast } from '../utils/errorToast'
import { API_ENDPOINTS } from '../config/api'

const positions: Position[] = ['GK', 'DEF', 'MID', 'ATT']

const ProfileForm: React.FC = () => {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: '',
    lastName: '',
    nickname: '',
    selfRating: 5,
    primaryPosition: 'MID',
    secondaryPosition: undefined
  })
  
  const [errors, setErrors] = useState<ProfileFormErrors>({})

  const validateForm = (): boolean => {
    const newErrors: ProfileFormErrors = {}
    
    // Required field validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters'
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    } else if (formData.lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters'
    }
    
    if (!formData.nickname.trim()) {
      newErrors.nickname = 'Nickname is required'
    } else if (formData.nickname.trim().length < 2) {
      newErrors.nickname = 'Nickname must be at least 2 characters'
    } else if (formData.nickname.trim().length > 20) {
      newErrors.nickname = 'Nickname must be 20 characters or less'
    } else if (!/^[a-zA-Z0-9_\s-]+$/.test(formData.nickname.trim())) {
      newErrors.nickname = 'Nickname can only contain letters, numbers, spaces, hyphens, and underscores'
    }
    
    // Rating validation
    if (!Number.isInteger(formData.selfRating) || formData.selfRating < 1 || formData.selfRating > 10) {
      newErrors.selfRating = 'Self-rating must be a whole number between 1 and 10'
    }
    
    // Position validation
    if (!positions.includes(formData.primaryPosition)) {
      newErrors.primaryPosition = 'Please select a valid primary position'
    }
    
    if (formData.secondaryPosition && !positions.includes(formData.secondaryPosition)) {
      newErrors.secondaryPosition = 'Please select a valid secondary position'
    }
    
    if (formData.primaryPosition === formData.secondaryPosition) {
      newErrors.secondaryPosition = 'Secondary position must be different from primary position'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    if (!token) {
      errorToast('Authentication required. Please log in again.')
      navigate('/login')
      return
    }
    
    setIsSubmitting(true)
    setErrors({})
    
    try {
      const response = await fetch(API_ENDPOINTS.PROFILE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          nickname: formData.nickname.trim(),
          selfRating: formData.selfRating,
          primaryPosition: formData.primaryPosition,
          secondaryPosition: formData.secondaryPosition || undefined
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        
        if (response.status === 409 && errorData.code === 'NICKNAME_TAKEN') {
          setErrors({ nickname: 'This nickname is already taken. Please choose another.' })
          return
        }
        
        throw new Error(errorData.error || 'Failed to save profile')
      }
      
      // Success - navigate to home
      navigate('/home')
      
    } catch (error) {
      console.error('Error submitting profile:', error)
      setErrors({ 
        submit: error instanceof Error ? error.message : 'Failed to save profile. Please try again.' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof ProfileFormData, value: string | number) => {
    // Handle secondaryPosition: convert empty string to undefined
    const processedValue = field === 'secondaryPosition' && value === '' ? undefined : value
    
    setFormData(prev => ({ ...prev, [field]: processedValue }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ 
      width: '100%', 
      maxWidth: '400px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {/* First Name */}
      <div>
        <label htmlFor="firstName" style={{ 
          display: 'block', 
          marginBottom: '4px',
          fontWeight: 'bold'
        }}>
          First Name *
        </label>
        <input
          id="firstName"
          type="text"
          value={formData.firstName}
          onChange={(e) => handleInputChange('firstName', e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '4px',
            border: errors.firstName ? '2px solid red' : '1px solid #ccc',
            fontSize: '16px', // Prevents zoom on iOS
            minHeight: '48px' // Touch target size
          }}
          aria-invalid={!!errors.firstName}
          aria-describedby={errors.firstName ? 'firstName-error' : undefined}
        />
        {errors.firstName && (
          <div id="firstName-error" style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
            {errors.firstName}
          </div>
        )}
      </div>

      {/* Last Name */}
      <div>
        <label htmlFor="lastName" style={{ 
          display: 'block', 
          marginBottom: '4px',
          fontWeight: 'bold'
        }}>
          Last Name *
        </label>
        <input
          id="lastName"
          type="text"
          value={formData.lastName}
          onChange={(e) => handleInputChange('lastName', e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '4px',
            border: errors.lastName ? '2px solid red' : '1px solid #ccc',
            fontSize: '16px',
            minHeight: '48px'
          }}
          aria-invalid={!!errors.lastName}
          aria-describedby={errors.lastName ? 'lastName-error' : undefined}
        />
        {errors.lastName && (
          <div id="lastName-error" style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
            {errors.lastName}
          </div>
        )}
      </div>

      {/* Nickname */}
      <div>
        <label htmlFor="nickname" style={{ 
          display: 'block', 
          marginBottom: '4px',
          fontWeight: 'bold'
        }}>
          Nickname *
        </label>
        <input
          id="nickname"
          type="text"
          value={formData.nickname}
          onChange={(e) => handleInputChange('nickname', e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '4px',
            border: errors.nickname ? '2px solid red' : '1px solid #ccc',
            fontSize: '16px',
            minHeight: '48px'
          }}
          aria-invalid={!!errors.nickname}
          aria-describedby={errors.nickname ? 'nickname-error' : undefined}
          placeholder="How others will see you"
        />
        {errors.nickname && (
          <div id="nickname-error" style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
            {errors.nickname}
          </div>
        )}
      </div>

      {/* Self Rating */}
      <div>
        <label htmlFor="selfRating" style={{ 
          display: 'block', 
          marginBottom: '4px',
          fontWeight: 'bold'
        }}>
          Self-Rating (1-10) *
        </label>
        <select
          id="selfRating"
          value={formData.selfRating}
          onChange={(e) => handleInputChange('selfRating', parseInt(e.target.value))}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '4px',
            border: errors.selfRating ? '2px solid red' : '1px solid #ccc',
            fontSize: '16px',
            minHeight: '48px',
            backgroundColor: 'white'
          }}
          aria-invalid={!!errors.selfRating}
          aria-describedby={errors.selfRating ? 'selfRating-error' : undefined}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
            <option key={num} value={num}>{num}</option>
          ))}
        </select>
        {errors.selfRating && (
          <div id="selfRating-error" style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
            {errors.selfRating}
          </div>
        )}
      </div>

      {/* Primary Position */}
      <div>
        <label htmlFor="primaryPosition" style={{ 
          display: 'block', 
          marginBottom: '4px',
          fontWeight: 'bold'
        }}>
          Primary Position *
        </label>
        <select
          id="primaryPosition"
          value={formData.primaryPosition}
          onChange={(e) => handleInputChange('primaryPosition', e.target.value as Position)}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '4px',
            border: errors.primaryPosition ? '2px solid red' : '1px solid #ccc',
            fontSize: '16px',
            minHeight: '48px',
            backgroundColor: 'white'
          }}
          aria-invalid={!!errors.primaryPosition}
          aria-describedby={errors.primaryPosition ? 'primaryPosition-error' : undefined}
        >
          {positions.map(pos => (
            <option key={pos} value={pos}>
              {pos === 'GK' && 'Goalkeeper'}
              {pos === 'DEF' && 'Defender'}
              {pos === 'MID' && 'Midfielder'}
              {pos === 'ATT' && 'Attacker'}
            </option>
          ))}
        </select>
        {errors.primaryPosition && (
          <div id="primaryPosition-error" style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
            {errors.primaryPosition}
          </div>
        )}
      </div>

      {/* Secondary Position */}
      <div>
        <label htmlFor="secondaryPosition" style={{ 
          display: 'block', 
          marginBottom: '4px',
          fontWeight: 'bold'
        }}>
          Secondary Position (Optional)
        </label>
        <select
          id="secondaryPosition"
          value={formData.secondaryPosition || ''}
          onChange={(e) => handleInputChange('secondaryPosition', e.target.value as Position)}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '4px',
            border: errors.secondaryPosition ? '2px solid red' : '1px solid #ccc',
            fontSize: '16px',
            minHeight: '48px',
            backgroundColor: 'white'
          }}
          aria-invalid={!!errors.secondaryPosition}
          aria-describedby={errors.secondaryPosition ? 'secondaryPosition-error' : undefined}
        >
          <option value="">None</option>
          {positions.map(pos => (
            <option key={pos} value={pos}>
              {pos === 'GK' && 'Goalkeeper'}
              {pos === 'DEF' && 'Defender'}
              {pos === 'MID' && 'Midfielder'}
              {pos === 'ATT' && 'Attacker'}
            </option>
          ))}
        </select>
        {errors.secondaryPosition && (
          <div id="secondaryPosition-error" style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
            {errors.secondaryPosition}
          </div>
        )}
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div style={{ color: 'red', fontSize: '14px', textAlign: 'center', padding: '8px' }}>
          {errors.submit}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: '4px',
          border: 'none',
          backgroundColor: isSubmitting ? '#ccc' : '#007bff',
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold',
          minHeight: '48px',
          cursor: isSubmitting ? 'not-allowed' : 'pointer'
        }}
      >
        {isSubmitting ? 'Saving...' : 'Complete Profile'}
      </button>
    </form>
  )
}

export default ProfileForm 