import React, { useState } from 'react'
import { GuestFormData, GuestFormErrors, Position } from '../types/profile'

const positions: Position[] = ['GK', 'DEF', 'MID', 'ATT']

interface AddGuestModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (guestData: GuestFormData) => Promise<void>
  isSubmitting: boolean
}

const AddGuestModal: React.FC<AddGuestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting
}) => {
  const [formData, setFormData] = useState<GuestFormData>({
    fullName: '',
    selfRating: 5,
    primaryPosition: 'MID',
    secondaryPosition: undefined
  })
  
  const [errors, setErrors] = useState<GuestFormErrors>({})

  const validateForm = (): boolean => {
    const newErrors: GuestFormErrors = {}
    
    // Full name validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required'
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters'
    } else if (formData.fullName.trim().length > 50) {
      newErrors.fullName = 'Full name must be 50 characters or less'
    }
    
    // Rating validation
    if (!Number.isInteger(formData.selfRating) || formData.selfRating < 1 || formData.selfRating > 10) {
      newErrors.selfRating = 'Rating must be a whole number between 1 and 10'
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
    
    try {
      await onSubmit(formData)
      // Reset form on success
      setFormData({
        fullName: '',
        selfRating: 5,
        primaryPosition: 'MID',
        secondaryPosition: undefined
      })
      setErrors({})
      onClose()
    } catch (error) {
      setErrors({ 
        submit: error instanceof Error ? error.message : 'Failed to add guest. Please try again.' 
      })
    }
  }

  const handleInputChange = (field: keyof GuestFormData, value: string | number) => {
    // Handle secondaryPosition: convert empty string to undefined
    const processedValue = field === 'secondaryPosition' && value === '' ? undefined : value
    
    setFormData(prev => ({ ...prev, [field]: processedValue }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  if (!isOpen) return null

  return (
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
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: 0 }}>Add Friend</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              color: '#666'
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ 
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Full Name */}
          <div>
            <label htmlFor="guestFullName" style={{ 
              display: 'block', 
              marginBottom: '4px',
              fontWeight: 'bold'
            }}>
              Full Name *
            </label>
            <input
              id="guestFullName"
              type="text"
              value={formData.fullName}
              onChange={(e) => handleInputChange('fullName', e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '4px',
                border: errors.fullName ? '2px solid red' : '1px solid #ccc',
                fontSize: '16px',
                minHeight: '48px'
              }}
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? 'guestFullName-error' : undefined}
              placeholder="Enter friend's full name"
            />
            {errors.fullName && (
              <div id="guestFullName-error" style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
                {errors.fullName}
              </div>
            )}
          </div>

          {/* Self Rating */}
          <div>
            <label htmlFor="guestSelfRating" style={{ 
              display: 'block', 
              marginBottom: '4px',
              fontWeight: 'bold'
            }}>
              Skill Rating (1-10) *
            </label>
            <select
              id="guestSelfRating"
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
              aria-describedby={errors.selfRating ? 'guestSelfRating-error' : undefined}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
            {errors.selfRating && (
              <div id="guestSelfRating-error" style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
                {errors.selfRating}
              </div>
            )}
          </div>

          {/* Primary Position */}
          <div>
            <label htmlFor="guestPrimaryPosition" style={{ 
              display: 'block', 
              marginBottom: '4px',
              fontWeight: 'bold'
            }}>
              Primary Position *
            </label>
            <select
              id="guestPrimaryPosition"
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
              aria-describedby={errors.primaryPosition ? 'guestPrimaryPosition-error' : undefined}
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
              <div id="guestPrimaryPosition-error" style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
                {errors.primaryPosition}
              </div>
            )}
          </div>

          {/* Secondary Position */}
          <div>
            <label htmlFor="guestSecondaryPosition" style={{ 
              display: 'block', 
              marginBottom: '4px',
              fontWeight: 'bold'
            }}>
              Secondary Position (Optional)
            </label>
            <select
              id="guestSecondaryPosition"
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
              aria-describedby={errors.secondaryPosition ? 'guestSecondaryPosition-error' : undefined}
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
              <div id="guestSecondaryPosition-error" style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
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

          {/* Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            justifyContent: 'flex-end',
            marginTop: '10px'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '12px 20px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                backgroundColor: 'white',
                color: '#666',
                fontSize: '14px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '12px 20px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: isSubmitting ? '#ccc' : '#28a745',
                color: 'white',
                fontSize: '14px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? 'Adding...' : 'Add Friend'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddGuestModal 