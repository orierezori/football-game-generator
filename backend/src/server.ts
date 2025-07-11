import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { UserService } from './services/userService.js'
import { GameService } from './services/gameService.js'
import { AttendanceService } from './services/attendanceService.js'
import { runMigrations, closeDatabase } from './database/migrations.js'
import { CreateProfileRequest, CreateGameRequest, RegisterAttendanceRequest } from './types/index.js'

dotenv.config()

const userService = new UserService()
const gameService = new GameService()
const attendanceService = new AttendanceService()

// Mock token decode - extract userId from token
function decodeToken(token: string): string | null {
  // Simple mock: token format is "user_123" or actual Google token
  if (token.startsWith('user_')) {
    return token
  }
  // For Google tokens, just use first 10 chars as userId
  return `user_${token.substring(0, 10)}`
}

// Mock Google token decoding - in real implementation, you'd use Google's token verification
async function decodeGoogleToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    // Simple mock: in real implementation, you'd call Google's token info endpoint
    // For now, we'll simulate extracting user info from the token
    if (token.startsWith('user_')) {
      return {
        userId: token,
        email: `${token}@example.com`
      }
    }
    
    // For Google tokens, create a mock user ID and email
    const userId = `user_${token.substring(0, 10)}`
    const email = `${userId}@gmail.com`
    
    return { userId, email }
  } catch (error) {
    return null
  }
}

function createApp() {
  const app = express()
  
  app.use(cors())
  app.use(express.json())

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // POST /api/auth - authenticate user with Google token
  app.post('/api/auth', async (req: Request, res: Response) => {
    try {
      const { token } = req.body
      
      if (!token) {
        return res.status(400).json({ error: 'Token is required' })
      }

      const userInfo = await decodeGoogleToken(token)
      if (!userInfo) {
        return res.status(401).json({ error: 'Invalid token' })
      }

      // Create or update user with email
      const user = await userService.createUser(userInfo.userId, userInfo.email)
      
      res.json({
        userId: user.userId,
        email: user.email,
        token: token // Return the same token for frontend storage
      })
    } catch (error) {
      console.error('Error authenticating user:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // Middleware to extract userId from Authorization header
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    // Skip auth middleware for auth endpoint
    if (req.path === '/auth') {
      return next()
    }
    
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

  // Admin middleware - check if user is admin
  const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId
      const user = await userService.getUserWithProfile(userId)
      
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' })
      }
      
      next()
    } catch (error) {
      console.error('Error checking admin status:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  // GET /api/me - returns user profile
  app.get('/api/me', async (req: Request, res: Response) => {
    try {
      const userId = req.userId
      const user = await userService.getUserWithProfile(userId)
      res.json(user)
    } catch (error) {
      console.error('Error fetching user:', error)
      if (error instanceof Error && error.message === 'User not found') {
        return res.status(404).json({ error: 'User not found' })
      }
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // POST /api/profile - creates user profile
  app.post('/api/profile', async (req: Request, res: Response) => {
    try {
      const userId = req.userId
      const profileData: CreateProfileRequest = req.body
      const { firstName, lastName, nickname, selfRating, primaryPosition, secondaryPosition } = profileData

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
      const isNicknameAvailable = await userService.isNicknameAvailable(nickname)
      if (!isNicknameAvailable) {
        return res.status(409).json({ 
          code: 'NICKNAME_TAKEN',
          error: 'This nickname is already taken' 
        })
      }

      // Create profile
      const profile = await userService.createProfile(userId, {
        firstName,
        lastName,
        nickname,
        selfRating,
        primaryPosition,
        secondaryPosition
      })

      res.status(201).json(profile)
    } catch (error) {
      console.error('Error creating profile:', error)
      
      // Handle unique constraint violation (nickname already exists)
      if (error instanceof Error && error.message.includes('duplicate key value violates unique constraint')) {
        return res.status(409).json({ 
          code: 'NICKNAME_TAKEN',
          error: 'This nickname is already taken' 
        })
      }
      
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // POST /api/admin/game - creates a new game (admin only)
  app.post('/api/admin/game', isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = req.userId
      const gameData: CreateGameRequest = req.body
      const { date, location, markdown } = gameData

      // Validation
      if (!date || !location || !markdown) {
        return res.status(400).json({ 
          error: 'Missing required fields: date, location, markdown' 
        })
      }

      // Validate date is in the future (optional check)
      const gameDate = new Date(date)
      if (isNaN(gameDate.getTime())) {
        return res.status(400).json({ 
          error: 'Invalid date format' 
        })
      }

      // Create game
      const game = await gameService.createGame(userId, {
        date,
        location,
        markdown
      })

      res.status(201).json(game)
    } catch (error) {
      console.error('Error creating game:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /api/game/open - get current open game
  app.get('/api/game/open', async (req: Request, res: Response) => {
    try {
      const openGame = await gameService.getOpenGame()
      
      if (!openGame) {
        return res.status(404).json({ error: 'No open game found' })
      }
      
      res.json(openGame)
    } catch (error) {
      console.error('Error fetching open game:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /api/game/:id/attendance - get game roster
  app.get('/api/game/:id/attendance', async (req: Request, res: Response) => {
    try {
      const gameId = req.params.id
      
      // Validate game ID format (UUID)
      if (!gameId || !gameId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({ error: 'Invalid game ID format' })
      }

      const roster = await attendanceService.getRoster(gameId)
      res.json(roster)
    } catch (error) {
      console.error('Error fetching game roster:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // POST /api/game/:id/attendance - register attendance
  app.post('/api/game/:id/attendance', async (req: Request, res: Response) => {
    try {
      const gameId = req.params.id
      const userId = req.userId
      const attendanceData: RegisterAttendanceRequest = req.body
      const { action } = attendanceData

      // Validate game ID format (UUID)
      if (!gameId || !gameId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({ error: 'Invalid game ID format' })
      }

      // Validation
      if (!action) {
        return res.status(400).json({ 
          error: 'Missing required field: action' 
        })
      }

      const validActions = ['CONFIRMED', 'WAITING', 'OUT', 'LATE_CONFIRMED']
      if (!validActions.includes(action)) {
        return res.status(400).json({ 
          error: 'action must be one of: CONFIRMED, WAITING, OUT, LATE_CONFIRMED' 
        })
      }

      // Register attendance
      const roster = await attendanceService.registerAttendance(userId, gameId, action)
      res.json(roster)
    } catch (error) {
      console.error('Error registering attendance:', error)
      
      // Handle specific errors
      if (error instanceof Error) {
        if (error.message === 'Game not found') {
          return res.status(404).json({ error: 'Game not found' })
        }
        if (error.message === 'Game is not open for attendance changes') {
          return res.status(403).json({ error: 'Game is not open for attendance changes' })
        }
      }
      
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  return app
}

export async function startServer(port: number = 3001) {
  try {
    // Run database migrations
    await runMigrations()
    
    const app = createApp()
    const server = app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`)
      console.log(`🔗 Health check: http://localhost:${port}/health`)
    })

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('📴 SIGTERM received, shutting down gracefully...')
      server.close(() => {
        closeDatabase().then(() => {
          console.log('👋 Server closed')
          process.exit(0)
        })
      })
    })

    process.on('SIGINT', async () => {
      console.log('📴 SIGINT received, shutting down gracefully...')
      server.close(() => {
        closeDatabase().then(() => {
          console.log('👋 Server closed')
          process.exit(0)
        })
      })
    })

    return server
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

export { createApp }

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      userId: string
    }
  }
} 