import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ProfileForm from '../components/ProfileForm'

// Mock fetch globally
globalThis.fetch = vi.fn()

// Mock the auth context
const mockAuth = {
  isAuthenticated: true,
  token: 'test-token',
  login: vi.fn(),
  logout: vi.fn()
}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth
}))

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

vi.mock('../utils/errorToast', () => ({
  errorToast: vi.fn()
}))

describe('ProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.token = 'test-token'
    vi.mocked(fetch).mockReset()
  })

  const renderForm = () => {
    return render(
      <BrowserRouter>
        <ProfileForm />
      </BrowserRouter>
    )
  }

  it('renders all form fields', () => {
    renderForm()
    
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/nickname/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/self-rating/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/primary position/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/secondary position/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /complete profile/i })).toBeInTheDocument()
  })

  it('validates required fields', async () => {
    renderForm()
    
    const submitButton = screen.getByRole('button', { name: /complete profile/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('First name is required')).toBeInTheDocument()
      expect(screen.getByText('Last name is required')).toBeInTheDocument()
      expect(screen.getByText('Nickname is required')).toBeInTheDocument()
    })
    
    expect(fetch).not.toHaveBeenCalled()
  })

  it('validates field lengths', async () => {
    renderForm()
    
    const firstNameInput = screen.getByLabelText(/first name/i)
    const lastNameInput = screen.getByLabelText(/last name/i)
    const nicknameInput = screen.getByLabelText(/nickname/i)
    
    fireEvent.change(firstNameInput, { target: { value: 'A' } })
    fireEvent.change(lastNameInput, { target: { value: 'B' } })
    fireEvent.change(nicknameInput, { target: { value: 'C' } })
    
    const submitButton = screen.getByRole('button', { name: /complete profile/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('First name must be at least 2 characters')).toBeInTheDocument()
      expect(screen.getByText('Last name must be at least 2 characters')).toBeInTheDocument()
      expect(screen.getByText('Nickname must be at least 2 characters')).toBeInTheDocument()
    })
  })

  it('validates nickname format', async () => {
    renderForm()
    
    const nicknameInput = screen.getByLabelText(/nickname/i)
    fireEvent.change(nicknameInput, { target: { value: 'test nickname!' } })
    
    const submitButton = screen.getByRole('button', { name: /complete profile/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Nickname can only contain letters, numbers, spaces, hyphens, and underscores')).toBeInTheDocument()
    })
  })

  it('validates nickname length limit', async () => {
    renderForm()
    
    const nicknameInput = screen.getByLabelText(/nickname/i)
    fireEvent.change(nicknameInput, { target: { value: 'a'.repeat(21) } })
    
    const submitButton = screen.getByRole('button', { name: /complete profile/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Nickname must be 20 characters or less')).toBeInTheDocument()
    })
  })

  it('validates primary and secondary positions are different', async () => {
    renderForm()
    
    // Fill in valid data
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'johndoe' } })
    
    // Set same position for both
    fireEvent.change(screen.getByLabelText(/primary position/i), { target: { value: 'GK' } })
    fireEvent.change(screen.getByLabelText(/secondary position/i), { target: { value: 'GK' } })
    
    const submitButton = screen.getByRole('button', { name: /complete profile/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Secondary position must be different from primary position')).toBeInTheDocument()
    })
  })

  it('clears errors when user starts typing', async () => {
    renderForm()
    
    const firstNameInput = screen.getByLabelText(/first name/i)
    const submitButton = screen.getByRole('button', { name: /complete profile/i })
    
    // Trigger validation error
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('First name is required')).toBeInTheDocument()
    })
    
    // Start typing
    fireEvent.change(firstNameInput, { target: { value: 'J' } })
    
    // Error should clear
    await waitFor(() => {
      expect(screen.queryByText('First name is required')).not.toBeInTheDocument()
    })
  })

  it('submits form with valid data', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'user123', firstName: 'John' })
    } as Response)
    
    renderForm()
    
    // Fill in valid data
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'johndoe' } })
    fireEvent.change(screen.getByLabelText(/self-rating/i), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText(/primary position/i), { target: { value: 'MID' } })
    fireEvent.change(screen.getByLabelText(/secondary position/i), { target: { value: 'ATT' } })
    
    const submitButton = screen.getByRole('button', { name: /complete profile/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          nickname: 'johndoe',
          selfRating: 8,
          primaryPosition: 'MID',
          secondaryPosition: 'ATT'
        })
      })
    })
    
    expect(mockNavigate).toHaveBeenCalledWith('/home')
  })

  it('handles nickname taken error', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ code: 'NICKNAME_TAKEN', error: 'Nickname is taken' })
    } as Response)
    
    renderForm()
    
    // Fill in valid data
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'johndoe' } })
    
    const submitButton = screen.getByRole('button', { name: /complete profile/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('This nickname is already taken. Please choose another.')).toBeInTheDocument()
    })
    
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('handles general API errors', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' })
    } as Response)
    
    renderForm()
    
    // Fill in valid data
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'johndoe' } })
    
    const submitButton = screen.getByRole('button', { name: /complete profile/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeInTheDocument()
    })
    
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('handles network errors', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    
    renderForm()
    
    // Fill in valid data
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'johndoe' } })
    
    const submitButton = screen.getByRole('button', { name: /complete profile/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
    
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('handles missing token', async () => {
    mockAuth.token = null
    
    renderForm()
    
    // Fill in valid data
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'johndoe' } })
    
    const submitButton = screen.getByRole('button', { name: /complete profile/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })
    
    expect(fetch).not.toHaveBeenCalled()
  })

  it('disables submit button while submitting', async () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {})) // Never resolves
    
    renderForm()
    
    // Fill in valid data
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'johndoe' } })
    
    const submitButton = screen.getByRole('button', { name: /complete profile/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })
  })

  it('handles secondary position as optional', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'user123', firstName: 'John' })
    } as Response)
    
    renderForm()
    
    // Fill in valid data without secondary position
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'johndoe' } })
    fireEvent.change(screen.getByLabelText(/self-rating/i), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText(/primary position/i), { target: { value: 'GK' } })
    // Leave secondary position as "None"
    
    const submitButton = screen.getByRole('button', { name: /complete profile/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          nickname: 'johndoe',
          selfRating: 7,
          primaryPosition: 'GK',
          secondaryPosition: undefined
        })
      })
    })
  })
}) 