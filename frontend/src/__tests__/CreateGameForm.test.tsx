import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import CreateGameForm from '../components/CreateGameForm'

// Mock the useAuth hook
const mockUseAuth = {
  token: 'mock-token',
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn()
}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

// Mock the errorToast utility
vi.mock('../utils/errorToast', () => ({
  errorToast: vi.fn()
}))

// Mock fetch
globalThis.fetch = vi.fn()

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('CreateGameForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form with all required fields', () => {
    renderWithRouter(<CreateGameForm />)
    
    expect(screen.getByText('Create New Game')).toBeInTheDocument()
    expect(screen.getByLabelText(/date and time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/game description/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create game/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('has default values populated on load', () => {
    renderWithRouter(<CreateGameForm />)
    
    const dateInput = screen.getByLabelText(/date and time/i) as HTMLInputElement
    const locationInput = screen.getByLabelText(/location/i) as HTMLInputElement
    const descriptionInput = screen.getByLabelText(/game description/i) as HTMLTextAreaElement
    
    // Check that default values are set
    expect(dateInput.value).toBeTruthy() // Should have a date value
    expect(locationInput.value).toBe('@https://goo.gl/maps/mpu4fhencfLyNfAF9')
    expect(descriptionInput.value).toContain('Hey guys,')
    expect(descriptionInput.value).toContain('registration list for the next week')
    expect(descriptionInput.value).toContain('For the new members, here\'s the location')
  })

  it('shows validation errors when fields are cleared', async () => {
    renderWithRouter(<CreateGameForm />)
    
    // Clear all the default values
    const dateInput = screen.getByLabelText(/date and time/i)
    const locationInput = screen.getByLabelText(/location/i)
    const descriptionInput = screen.getByLabelText(/game description/i)
    
    fireEvent.change(dateInput, { target: { value: '' } })
    fireEvent.change(locationInput, { target: { value: '' } })
    fireEvent.change(descriptionInput, { target: { value: '' } })
    
    const submitButton = screen.getByRole('button', { name: /create game/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/date and time is required/i)).toBeInTheDocument()
      expect(screen.getByText(/location is required/i)).toBeInTheDocument()
      expect(screen.getByText(/game description is required/i)).toBeInTheDocument()
    })
  })

  it('shows validation error for past date', async () => {
    renderWithRouter(<CreateGameForm />)
    
    const dateInput = screen.getByLabelText(/date and time/i)
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    
    fireEvent.change(dateInput, { 
      target: { value: pastDate.toISOString().slice(0, 16) } 
    })
    
    const submitButton = screen.getByRole('button', { name: /create game/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/game date must be in the future/i)).toBeInTheDocument()
    })
  })

  it('shows validation error for short location', async () => {
    renderWithRouter(<CreateGameForm />)
    
    const locationInput = screen.getByLabelText(/location/i)
    fireEvent.change(locationInput, { target: { value: 'ab' } })
    
    const submitButton = screen.getByRole('button', { name: /create game/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/location must be at least 3 characters/i)).toBeInTheDocument()
    })
  })

  it('shows validation error for short description', async () => {
    renderWithRouter(<CreateGameForm />)
    
    const descriptionInput = screen.getByLabelText(/game description/i)
    fireEvent.change(descriptionInput, { target: { value: 'short' } })
    
    const submitButton = screen.getByRole('button', { name: /create game/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/description must be at least 10 characters/i)).toBeInTheDocument()
    })
  })

  it('submits form successfully with valid data', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ id: '123', state: 'OPEN' })
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as any)
    
    renderWithRouter(<CreateGameForm />)
    
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1)
    
    fireEvent.change(screen.getByLabelText(/date and time/i), {
      target: { value: futureDate.toISOString().slice(0, 16) }
    })
    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: 'Test Stadium' }
    })
    fireEvent.change(screen.getByLabelText(/game description/i), {
      target: { value: 'A great game for everyone!' }
    })
    
    const submitButton = screen.getByRole('button', { name: /create game/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/admin/game',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          },
          body: expect.stringContaining('Test Stadium')
        })
      )
    })
  })

  it('handles server error response', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' })
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as any)
    
    renderWithRouter(<CreateGameForm />)
    
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1)
    
    fireEvent.change(screen.getByLabelText(/date and time/i), {
      target: { value: futureDate.toISOString().slice(0, 16) }
    })
    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: 'Test Stadium' }
    })
    fireEvent.change(screen.getByLabelText(/game description/i), {
      target: { value: 'A great game for everyone!' }
    })
    
    const submitButton = screen.getByRole('button', { name: /create game/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    })
  })

  it('handles 403 unauthorized error', async () => {
    const mockResponse = {
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Admin access required' })
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as any)
    
    renderWithRouter(<CreateGameForm />)
    
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1)
    
    fireEvent.change(screen.getByLabelText(/date and time/i), {
      target: { value: futureDate.toISOString().slice(0, 16) }
    })
    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: 'Test Stadium' }
    })
    fireEvent.change(screen.getByLabelText(/game description/i), {
      target: { value: 'A great game for everyone!' }
    })
    
    const submitButton = screen.getByRole('button', { name: /create game/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.queryByText(/server error/i)).not.toBeInTheDocument()
    })
  })

  it('clears errors when user starts typing', async () => {
    renderWithRouter(<CreateGameForm />)
    
    // Clear the location field to trigger validation error
    const locationInput = screen.getByLabelText(/location/i)
    fireEvent.change(locationInput, { target: { value: '' } })
    
    const submitButton = screen.getByRole('button', { name: /create game/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/location is required/i)).toBeInTheDocument()
    })
    
    // Now type something to clear the error
    fireEvent.change(locationInput, { target: { value: 'Test' } })
    
    await waitFor(() => {
      expect(screen.queryByText(/location is required/i)).not.toBeInTheDocument()
    })
  })

  it('disables submit button while submitting', async () => {
    const mockResponse = {
      ok: true,
      json: () => new Promise(resolve => setTimeout(() => resolve({ id: '123' }), 100))
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as any)
    
    renderWithRouter(<CreateGameForm />)
    
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1)
    
    fireEvent.change(screen.getByLabelText(/date and time/i), {
      target: { value: futureDate.toISOString().slice(0, 16) }
    })
    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: 'Test Stadium' }
    })
    fireEvent.change(screen.getByLabelText(/game description/i), {
      target: { value: 'A great game for everyone!' }
    })
    
    const submitButton = screen.getByRole('button', { name: /create game/i })
    fireEvent.click(submitButton)
    
    expect(screen.getByRole('button', { name: /creating game/i })).toBeDisabled()
  })
}) 