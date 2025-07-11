import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'

interface Profile {
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

interface User {
  userId: string
  profile: Profile | null
}

// In-memory storage
const users: Map<string, User> = new Map()
const nicknames: Set<string> = new Set()

// Mock token decode - extract userId from token
function decodeToken(token: string): string | null {
  // Simple mock: token format is "user_123" or actual Google token
  if (token.startsWith('user_')) {
    return token
  }
  // For Google tokens, just use first 10 chars as userId
  return `user_${token.substring(0, 10)}`
}

function createApp() {
  const app = express()
  
  app.use(cors())
  app.use(express.json())

  // Middleware to extract userId from Authorization header
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' })
    }
    
    const token = authHeader.substring(7)
    const userId = decodeToken(token)
    
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    
    req.userId = userId
    next()
  })

  // GET /api/me - returns user profile
  app.get('/api/me', (req: Request, res: Response) => {
    const userId = req.userId
    const user = users.get(userId) || { userId, profile: null }
    
    res.json(user)
  })

  // POST /api/profile - creates user profile
  app.post('/api/profile', (req: Request, res: Response) => {
    const userId = req.userId
    const { firstName, lastName, nickname, selfRating, primaryPosition, secondaryPosition } = req.body

    // Validation
    if (!firstName || !lastName || !nickname || !selfRating || !primaryPosition) {
      return res.status(400).json({ 
        error: 'Missing required fields: firstName, lastName, nickname, selfRating, primaryPosition' 
      })
    }

    if (typeof selfRating !== 'number' || selfRating < 1 || selfRating > 10) {
      return res.status(400).json({ 
        error: 'selfRating must be a number between 1 and 10' 
      })
    }

    const validPositions = ['GK', 'DEF', 'MID', 'ATT']
    if (!validPositions.includes(primaryPosition)) {
      return res.status(400).json({ 
        error: 'primaryPosition must be one of: GK, DEF, MID, ATT' 
      })
    }

    if (secondaryPosition && !validPositions.includes(secondaryPosition)) {
      return res.status(400).json({ 
        error: 'secondaryPosition must be one of: GK, DEF, MID, ATT' 
      })
    }

    // Check nickname uniqueness
    if (nicknames.has(nickname)) {
      return res.status(409).json({ 
        code: 'NICKNAME_TAKEN',
        error: 'This nickname is already taken' 
      })
    }

    // Create profile
    const profile: Profile = {
      userId,
      firstName,
      lastName,
      nickname,
      selfRating,
      primaryPosition,
      secondaryPosition,
      source: 'SELF',
      createdAt: new Date().toISOString()
    }

    // Store profile
    users.set(userId, { userId, profile })
    nicknames.add(nickname)

    res.status(201).json(profile)
  })

  return app
}

export function startMockServer(port: number = 3001) {
  const app = createApp()
  const server = app.listen(port, () => {
    console.log(`Mock server running on port ${port}`)
  })
  return server
}

export { createApp }

// For direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  startMockServer()
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      userId: string
    }
  }
} 