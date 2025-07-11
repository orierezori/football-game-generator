import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.alert
Object.defineProperty(window, 'alert', {
  value: vi.fn(),
  writable: true,
})

// Mock timer functions for tests
Object.defineProperty(globalThis, 'setInterval', {
  value: vi.fn((fn, delay) => {
    return setTimeout(fn, delay)
  }),
  writable: true,
})

Object.defineProperty(globalThis, 'clearInterval', {
  value: vi.fn((id) => {
    clearTimeout(id)
  }),
  writable: true,
}) 