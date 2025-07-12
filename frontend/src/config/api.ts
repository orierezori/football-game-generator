const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

export const API_ENDPOINTS = {
  ME: `${API_BASE_URL}/api/me`,
  PROFILE: `${API_BASE_URL}/api/profile`,
  ADMIN_GAME: `${API_BASE_URL}/api/admin/game`,
  ADMIN_USERS: `${API_BASE_URL}/api/admin/users`,
  ADMIN_USER_RATING: (userId: string) => `${API_BASE_URL}/api/admin/users/${userId}/rating`,
  ADMIN_USER_POSITIONS: (userId: string) => `${API_BASE_URL}/api/admin/users/${userId}/positions`,
  OPEN_GAME: `${API_BASE_URL}/api/game/open`,
  GAME_ATTENDANCE: (gameId: string) => `${API_BASE_URL}/api/game/${gameId}/attendance`,
  GAME_GUESTS: (gameId: string) => `${API_BASE_URL}/api/games/${gameId}/guests`,
  DELETE_GUEST: (gameId: string, guestId: string) => `${API_BASE_URL}/api/games/${gameId}/guests/${guestId}`,
  ADMIN_GUEST: (guestId: string) => `${API_BASE_URL}/api/admin/guests/${guestId}`,
} as const

export { API_BASE_URL } 