import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CreateGameFormData, CreateGameFormErrors } from '../types/profile'
import { errorToast } from '../utils/errorToast'
import { API_ENDPOINTS } from '../config/api'

// Helper function to get next Wednesday at 20:30 
const getNextWednesday = (): string => {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const wednesday = 3 // Wednesday is day 3
  
  // Calculate days until next Wednesday
  let daysUntilWednesday = (wednesday - dayOfWeek + 7) % 7
  
  // If today is Wednesday, check if it's before 20:30 Amsterdam time
  if (daysUntilWednesday === 0) {
    // Get current time in Amsterdam
    const amsterdamNow = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Amsterdam"}))
    
    if (amsterdamNow.getHours() < 20 || (amsterdamNow.getHours() === 20 && amsterdamNow.getMinutes() < 30)) {
      // It's Wednesday but before 20:30 Amsterdam time, use today
      daysUntilWednesday = 0
    } else {
      // It's Wednesday but after 20:30 Amsterdam time, use next Wednesday
      daysUntilWednesday = 7
    }
  }
  
  const nextWednesday = new Date(now)
  nextWednesday.setDate(now.getDate() + daysUntilWednesday)
  
  // Format as YYYY-MM-DD and append 20:30 to ensure the datetime-local shows 20:30
  const year = nextWednesday.getFullYear()
  const month = String(nextWednesday.getMonth() + 1).padStart(2, '0')
  const day = String(nextWednesday.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}T20:30`
}

// Helper function to format date and time for the template
const formatDateTime = (date: Date): string => {
  // Format the date as-is, treating it as Amsterdam time
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' (Amsterdam time)'
}

// Default location
const DEFAULT_LOCATION = '@https://goo.gl/maps/mpu4fhencfLyNfAF9'

// Default markdown template
const getDefaultMarkdown = (date: Date, location: string): string => {
  const dateTime = formatDateTime(date)
  return `Hey guys,
Here's the registration list for the next week. 

We kindly ask that if you're not certain you'll be able to join, either place yourself in the reserves list, or wait for Wednesday. Please try not to cancel a couple of hours before the game.

${dateTime}

For the new members, here's the location - ${location}`
}

const CreateGameForm: React.FC = () => {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Calculate default values
  const defaultDateString = getNextWednesday()
  const defaultLocation = DEFAULT_LOCATION
  const defaultMarkdown = getDefaultMarkdown(new Date(defaultDateString), defaultLocation)
  
  const [formData, setFormData] = useState<CreateGameFormData>({
    date: defaultDateString, // Already in datetime-local format
    location: defaultLocation,
    markdown: defaultMarkdown
  })
  
  const [errors, setErrors] = useState<CreateGameFormErrors>({})

  const validateForm = (): boolean => {
    const newErrors: CreateGameFormErrors = {}
    
    // Date validation
    if (!formData.date.trim()) {
      newErrors.date = 'Date and time is required'
    } else {
      const gameDate = new Date(formData.date)
      if (isNaN(gameDate.getTime())) {
        newErrors.date = 'Please enter a valid date and time'
      } else if (gameDate < new Date()) {
        newErrors.date = 'Game date must be in the future'
      }
    }
    
    // Location validation
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required'
    } else if (formData.location.trim().length < 3) {
      newErrors.location = 'Location must be at least 3 characters'
    } else if (formData.location.trim().length > 100) {
      newErrors.location = 'Location must be 100 characters or less'
    }
    
    // Markdown validation
    if (!formData.markdown.trim()) {
      newErrors.markdown = 'Game description is required'
    } else if (formData.markdown.trim().length < 10) {
      newErrors.markdown = 'Description must be at least 10 characters'
    } else if (formData.markdown.trim().length > 1000) {
      newErrors.markdown = 'Description must be 1000 characters or less'
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
      const response = await fetch(API_ENDPOINTS.ADMIN_GAME, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: formData.date + ':00', // Add seconds to make it a complete ISO datetime string
          location: formData.location.trim(),
          markdown: formData.markdown.trim()
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        
        if (response.status === 403) {
          errorToast('Admin access required to create games.')
          navigate('/home')
          return
        }
        
        throw new Error(errorData.error || 'Failed to create game')
      }
      
      // Success - show success message and navigate back
      alert('Game created successfully! All players will be notified.')
      navigate('/home')
      
    } catch (error) {
      console.error('Error creating game:', error)
      setErrors({ 
        submit: error instanceof Error ? error.message : 'Failed to create game. Please try again.' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof CreateGameFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }



  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1>Create New Game</h1>
        <p style={{ color: '#666' }}>
          Create a new football game. This will archive any existing open games.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} style={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Date and Time */}
        <div>
          <label htmlFor="date" style={{ 
            display: 'block', 
            marginBottom: '8px',
            fontWeight: 'bold'
          }}>
            Date and Time *
          </label>
          <input
            id="date"
            type="datetime-local"
            value={formData.date}
            onChange={(e) => handleInputChange('date', e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '4px',
              border: errors.date ? '2px solid red' : '1px solid #ccc',
              fontSize: '16px',
              minHeight: '48px'
            }}
            aria-invalid={!!errors.date}
            aria-describedby={errors.date ? 'date-error' : undefined}
          />
          {errors.date && (
            <div id="date-error" style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
              {errors.date}
            </div>
          )}
        </div>

        {/* Location */}
        <div>
          <label htmlFor="location" style={{ 
            display: 'block', 
            marginBottom: '8px',
            fontWeight: 'bold'
          }}>
            Location *
          </label>
          <input
            id="location"
            type="text"
            value={formData.location}
            onChange={(e) => handleInputChange('location', e.target.value)}
            placeholder="e.g., Central Park Field 3, 123 Main St"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '4px',
              border: errors.location ? '2px solid red' : '1px solid #ccc',
              fontSize: '16px',
              minHeight: '48px'
            }}
            aria-invalid={!!errors.location}
            aria-describedby={errors.location ? 'location-error' : undefined}
          />
          {errors.location && (
            <div id="location-error" style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
              {errors.location}
            </div>
          )}
        </div>

        {/* Game Description */}
        <div>
          <label htmlFor="markdown" style={{ 
            display: 'block', 
            marginBottom: '8px',
            fontWeight: 'bold'
          }}>
            Game Description *
          </label>
          <textarea
            id="markdown"
            value={formData.markdown}
            onChange={(e) => handleInputChange('markdown', e.target.value)}
            placeholder="# Game Details&#10;&#10;Join us for a friendly football match!&#10;&#10;## What to bring:&#10;- Football boots&#10;- Water bottle&#10;- Enthusiasm!"
            rows={8}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '4px',
              border: errors.markdown ? '2px solid red' : '1px solid #ccc',
              fontSize: '16px',
              resize: 'vertical',
              fontFamily: 'monospace'
            }}
            aria-invalid={!!errors.markdown}
            aria-describedby={errors.markdown ? 'markdown-error' : undefined}
          />
          {errors.markdown && (
            <div id="markdown-error" style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
              {errors.markdown}
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            Supports Markdown formatting. Players will see this description when they view the game.
          </div>
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div style={{ color: 'red', fontSize: '14px', padding: '12px', backgroundColor: '#ffebee', borderRadius: '4px' }}>
            {errors.submit}
          </div>
        )}

        {/* Form Actions */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button
            type="button"
            onClick={() => navigate('/home')}
            style={{
              padding: '12px 24px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              backgroundColor: 'white',
              color: '#333',
              fontSize: '16px',
              cursor: 'pointer',
              minHeight: '48px'
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '12px 24px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: isSubmitting ? '#ccc' : '#007bff',
              color: 'white',
              fontSize: '16px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              minHeight: '48px',
              flex: 1
            }}
          >
            {isSubmitting ? 'Creating Game...' : 'Create Game'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreateGameForm 