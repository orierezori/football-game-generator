export type Position = 'GK' | 'DEF' | 'MID' | 'ATT'

export interface Profile {
  userId: string
  firstName: string
  lastName: string
  nickname: string
  selfRating: number
  primaryPosition: Position
  secondaryPosition?: Position
  source: 'SELF'
  createdAt: string
}

export interface User {
  userId: string
  email: string
  role: 'PLAYER' | 'ADMIN'
  profile: Profile | null
}

export interface ProfileFormData {
  firstName: string
  lastName: string
  nickname: string
  selfRating: number
  primaryPosition: Position
  secondaryPosition?: Position
}

export interface ProfileFormErrors {
  firstName?: string
  lastName?: string
  nickname?: string
  selfRating?: string
  primaryPosition?: string
  secondaryPosition?: string
  submit?: string
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

export interface CreateGameFormData {
  date: string
  location: string
  markdown: string
}

export interface CreateGameFormErrors {
  date?: string
  location?: string
  markdown?: string
  submit?: string
}

export type AttendanceStatus = 'CONFIRMED' | 'WAITING' | 'OUT' | 'LATE_CONFIRMED'

export interface Attendance {
  id: string
  gameId: string
  playerId: string
  status: AttendanceStatus
  createdAt: string
  updatedAt: string
  player: Profile
}

export interface GameRoster {
  confirmed: Attendance[]
  waiting: Attendance[]
}

export interface RegisterAttendanceRequest {
  action: AttendanceStatus
} 