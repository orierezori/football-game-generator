import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.alert
Object.defineProperty(window, 'alert', {
  value: vi.fn(),
  writable: true,
}) 