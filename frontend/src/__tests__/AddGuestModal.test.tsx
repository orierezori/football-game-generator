import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AddGuestModal from '../components/AddGuestModal'
import { GuestFormData } from '../types/profile'

describe('AddGuestModal', () => {
  const mockOnClose = vi.fn()
  const mockOnSubmit = vi.fn()

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSubmit: mockOnSubmit,
    isSubmitting: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render when isOpen is false', () => {
    render(<AddGuestModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByRole('heading', { name: 'Add Friend' })).not.toBeInTheDocument()
  })

  it('should render modal when isOpen is true', () => {
    render(<AddGuestModal {...defaultProps} />)
    expect(screen.getByRole('heading', { name: 'Add Friend' })).toBeInTheDocument()
    expect(screen.getByLabelText('Full Name *')).toBeInTheDocument()
    expect(screen.getByLabelText('Skill Rating (1-10) *')).toBeInTheDocument()
    expect(screen.getByLabelText('Primary Position *')).toBeInTheDocument()
    expect(screen.getByLabelText('Secondary Position (Optional)')).toBeInTheDocument()
  })

  it('should close modal when close button is clicked', () => {
    render(<AddGuestModal {...defaultProps} />)
    fireEvent.click(screen.getByText('×'))
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should close modal when cancel button is clicked', () => {
    render(<AddGuestModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should validate required fields', async () => {
    render(<AddGuestModal {...defaultProps} />)
    
    // Try to submit empty form
    fireEvent.click(screen.getByRole('button', { name: 'Add Friend' }))
    
    await waitFor(() => {
      expect(screen.getByText('Full name is required')).toBeInTheDocument()
    })
    
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should validate full name length', async () => {
    render(<AddGuestModal {...defaultProps} />)
    
    // Test too short name
    fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: 'A' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Friend' }))
    
    await waitFor(() => {
      expect(screen.getByText('Full name must be at least 2 characters')).toBeInTheDocument()
    })
    
    // Test too long name
    fireEvent.change(screen.getByLabelText('Full Name *'), { 
      target: { value: 'A'.repeat(51) } 
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Friend' }))
    
    await waitFor(() => {
      expect(screen.getByText('Full name must be 50 characters or less')).toBeInTheDocument()
    })
  })

  it('should validate position selections', async () => {
    render(<AddGuestModal {...defaultProps} />)
    
    // Fill valid name and rating
    fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: 'John Doe' } })
    
    // Set same primary and secondary position
    fireEvent.change(screen.getByLabelText('Primary Position *'), { target: { value: 'MID' } })
    fireEvent.change(screen.getByLabelText('Secondary Position (Optional)'), { target: { value: 'MID' } })
    
    fireEvent.click(screen.getByRole('button', { name: 'Add Friend' }))
    
    await waitFor(() => {
      expect(screen.getByText('Secondary position must be different from primary position')).toBeInTheDocument()
    })
  })

  it('should submit valid form data', async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined)
    
    render(<AddGuestModal {...defaultProps} />)
    
    // Fill form with valid data
    fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: 'John Doe' } })
    fireEvent.change(screen.getByLabelText('Skill Rating (1-10) *'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Primary Position *'), { target: { value: 'ATT' } })
    fireEvent.change(screen.getByLabelText('Secondary Position (Optional)'), { target: { value: 'MID' } })
    
    fireEvent.click(screen.getByRole('button', { name: 'Add Friend' }))
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        fullName: 'John Doe',
        selfRating: 7,
        primaryPosition: 'ATT',
        secondaryPosition: 'MID'
      })
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('should handle form submission without secondary position', async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined)
    
    render(<AddGuestModal {...defaultProps} />)
    
    // Fill form with valid data but no secondary position
    fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: 'Jane Smith' } })
    fireEvent.change(screen.getByLabelText('Skill Rating (1-10) *'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Primary Position *'), { target: { value: 'DEF' } })
    
    fireEvent.click(screen.getByRole('button', { name: 'Add Friend' }))
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        fullName: 'Jane Smith',
        selfRating: 8,
        primaryPosition: 'DEF',
        secondaryPosition: undefined
      })
    })
  })

  it('should handle submission errors', async () => {
    const error = new Error('Failed to add guest')
    mockOnSubmit.mockRejectedValueOnce(error)
    
    render(<AddGuestModal {...defaultProps} />)
    
    // Fill valid form
    fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: 'John Doe' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Friend' }))
    
    await waitFor(() => {
      expect(screen.getByText('Failed to add guest')).toBeInTheDocument()
    })
    
    // Modal should stay open on error
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('should disable form when isSubmitting is true', () => {
    render(<AddGuestModal {...defaultProps} isSubmitting={true} />)
    
    expect(screen.getByText('Adding...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('should clear errors when user starts typing', async () => {
    render(<AddGuestModal {...defaultProps} />)
    
    // Trigger validation error
    fireEvent.click(screen.getByRole('button', { name: 'Add Friend' }))
    
    await waitFor(() => {
      expect(screen.getByText('Full name is required')).toBeInTheDocument()
    })
    
    // Start typing to clear error
    fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: 'J' } })
    
    await waitFor(() => {
      expect(screen.queryByText('Full name is required')).not.toBeInTheDocument()
    })
  })

  it('should reset form data after successful submission', async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined)
    
    render(<AddGuestModal {...defaultProps} />)
    
    // Fill form
    fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: 'John Doe' } })
    fireEvent.change(screen.getByLabelText('Skill Rating (1-10) *'), { target: { value: '9' } })
    
    fireEvent.click(screen.getByRole('button', { name: 'Add Friend' }))
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled()
      expect(mockOnClose).toHaveBeenCalled()
    })
    
    // Re-open modal to check if form is reset
    render(<AddGuestModal {...defaultProps} />)
    
    expect((screen.getByLabelText('Full Name *') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Skill Rating (1-10) *') as HTMLSelectElement).value).toBe('5')
  })

  it('should have proper accessibility attributes', () => {
    render(<AddGuestModal {...defaultProps} />)
    
    const fullNameInput = screen.getByLabelText('Full Name *')
    expect(fullNameInput).toHaveAttribute('aria-invalid', 'false')
    
    const ratingSelect = screen.getByLabelText('Skill Rating (1-10) *')
    expect(ratingSelect).toHaveAttribute('aria-invalid', 'false')
    
    const primaryPosSelect = screen.getByLabelText('Primary Position *')
    expect(primaryPosSelect).toHaveAttribute('aria-invalid', 'false')
    
    const secondaryPosSelect = screen.getByLabelText('Secondary Position (Optional)')
    expect(secondaryPosSelect).toHaveAttribute('aria-invalid', 'false')
  })
}) 