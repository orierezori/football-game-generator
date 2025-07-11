export interface Profile {
  userId: string
  firstName: string
  lastName: string
  nickname: string
  selfRating: number
  primaryPosition: 'GK' | 'DEF' | 'MID' | 'ATT'
  secondaryPosition?: 'GK' | 'DEF' | 'MID' | 'ATT'
  source: 'SELF'
  createdAt: string
}

export interface User {
  userId: string
  email: string
  role: 'PLAYER' | 'ADMIN'
  profile: Profile | null
}

export interface Game {
  id: string
  date: string
  location: string
  markdown: string
  state: 'OPEN' | 'CLOSED' | 'ARCHIVED'
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CreateProfileRequest {
  firstName: string
  lastName: string
  nickname: string
  selfRating: number
  primaryPosition: 'GK' | 'DEF' | 'MID' | 'ATT'
  secondaryPosition?: 'GK' | 'DEF' | 'MID' | 'ATT'
}

export interface CreateGameRequest {
  date: string
  location: string
  markdown: string
} 