const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

export const API_ENDPOINTS = {
  ME: `${API_BASE_URL}/api/me`,
  PROFILE: `${API_BASE_URL}/api/profile`,
  ADMIN_GAME: `${API_BASE_URL}/api/admin/game`,
  OPEN_GAME: `${API_BASE_URL}/api/game/open`,
} as const

export { API_BASE_URL } 