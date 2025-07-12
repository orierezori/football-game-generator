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

export type AttendanceStatus = 'CONFIRMED' | 'WAITING' | 'OUT' | 'LATE_CONFIRMED'

export interface Attendance {
  id: string
  gameId: string
  playerId: string
  status: AttendanceStatus
  createdAt: string
  updatedAt: string
}

export interface RegisterAttendanceRequest {
  action: AttendanceStatus
}

export interface GuestPlayer {
  id: string
  gameId: string
  inviterId: string
  fullName: string
  selfRating: number
  primaryPosition: 'GK' | 'DEF' | 'MID' | 'ATT'
  secondaryPosition?: 'GK' | 'DEF' | 'MID' | 'ATT'
  status: 'CONFIRMED' | 'WAITING'
  createdAt: string
  updatedAt: string
}

export interface CreateGuestPlayerRequest {
  fullName: string
  selfRating: number
  primaryPosition: 'GK' | 'DEF' | 'MID' | 'ATT'
  secondaryPosition?: 'GK' | 'DEF' | 'MID' | 'ATT'
}

export interface GameRoster {
  confirmed: (Attendance & { player: Profile })[]
  waiting: (Attendance & { player: Profile })[]
  guests: {
    confirmed: (GuestPlayer & { inviter: Profile })[]
    waiting: (GuestPlayer & { inviter: Profile })[]
  }
} 