import { UserService } from '../services/userService.js'
import { GameService } from '../services/gameService.js'
import { AttendanceService } from '../services/attendanceService.js'
import { GuestService } from '../services/guestService.js'

const userService = new UserService()
const gameService = new GameService()
const attendanceService = new AttendanceService()
const guestService = new GuestService()

// Sample player data with diverse names, positions, and ratings
const samplePlayers = [
  { firstName: 'Marco', lastName: 'van Bergen', nickname: 'Marco_VB', position: 'GK', rating: 8 },
  { firstName: 'Javier', lastName: 'Rodriguez', nickname: 'Javi_R', position: 'DEF', rating: 7 },
  { firstName: 'Ahmed', lastName: 'El-Mansouri', nickname: 'Ahmed_EM', position: 'DEF', rating: 6 },
  { firstName: 'Lucas', lastName: 'Silva', nickname: 'Lucas_S', position: 'DEF', rating: 8 },
  { firstName: 'Mohammed', lastName: 'Hassan', nickname: 'Mo_H', position: 'DEF', rating: 7 },
  { firstName: 'David', lastName: 'Johnson', nickname: 'Dave_J', position: 'MID', rating: 9 },
  { firstName: 'Kai', lastName: 'Nakamura', nickname: 'Kai_N', position: 'MID', rating: 6 },
  { firstName: 'Alessandro', lastName: 'Rossi', nickname: 'Alex_R', position: 'MID', rating: 8 },
  { firstName: 'Thiago', lastName: 'Santos', nickname: 'Thiago_S', position: 'MID', rating: 7 },
  { firstName: 'Omar', lastName: 'Benali', nickname: 'Omar_B', position: 'MID', rating: 5 },
  { firstName: 'Rafael', lastName: 'Garcia', nickname: 'Rafa_G', position: 'ATT', rating: 9 },
  { firstName: 'Kwame', lastName: 'Asante', nickname: 'Kwame_A', position: 'ATT', rating: 8 },
  { firstName: 'Dimitri', lastName: 'Petrov', nickname: 'Dimi_P', position: 'ATT', rating: 7 },
  { firstName: 'Carlos', lastName: 'Mendez', nickname: 'Carlos_M', position: 'ATT', rating: 6 },
  { firstName: 'Yuki', lastName: 'Tanaka', nickname: 'Yuki_T', position: 'GK', rating: 7 },
  { firstName: 'Viktor', lastName: 'Johansson', nickname: 'Viktor_J', position: 'DEF', rating: 8 }
]

export async function seedPlayers() {
  try {
    console.log('🌱 Seeding development players...')
    
    let createdCount = 0
    let skippedCount = 0
    
    // First, create an admin user
    try {
      const adminUserId = 'dev_admin_1'
      const adminEmail = 'admin@example.com'
      
      await userService.createUser(adminUserId, adminEmail)
      
      // Set user as admin (we need to update the role directly)
      const pool = (await import('../config/database.js')).default
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['ADMIN', adminUserId])
      
      const isAdminNicknameAvailable = await userService.isNicknameAvailable('Admin')
      if (isAdminNicknameAvailable) {
        await userService.createProfile(adminUserId, {
          firstName: 'Admin',
          lastName: 'User',
          nickname: 'Admin',
          selfRating: 10,
          primaryPosition: 'MID',
          secondaryPosition: undefined
        })
        console.log('✅ Created admin user: Admin (admin@example.com)')
        createdCount++
      } else {
        console.log('⚠️  Admin user already exists')
        skippedCount++
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key value violates unique constraint')) {
        console.log('⚠️  Admin user already exists')
        skippedCount++
      } else {
        console.error('❌ Error creating admin user:', error)
      }
    }
    
    // Then create regular players
    for (let i = 0; i < samplePlayers.length; i++) {
      const player = samplePlayers[i]
      const userId = `dev_player_${i + 1}`
      const email = `${player.firstName.toLowerCase()}.${player.lastName.toLowerCase()}@example.com`
      
      try {
        // Create user
        await userService.createUser(userId, email)
        
        // Check if nickname is available
        const isNicknameAvailable = await userService.isNicknameAvailable(player.nickname)
        if (!isNicknameAvailable) {
          console.log(`⚠️  Skipping ${player.nickname} - nickname already taken`)
          skippedCount++
          continue
        }
        
        // Create profile
        await userService.createProfile(userId, {
          firstName: player.firstName,
          lastName: player.lastName,
          nickname: player.nickname,
          selfRating: player.rating,
          primaryPosition: player.position as 'GK' | 'DEF' | 'MID' | 'ATT',
          secondaryPosition: undefined
        })
        
        createdCount++
        console.log(`✅ Created player: ${player.nickname} (${player.position}, Rating: ${player.rating})`)
      } catch (error) {
        if (error instanceof Error && error.message.includes('duplicate key value violates unique constraint')) {
          console.log(`⚠️  Skipping ${player.nickname} - already exists`)
          skippedCount++
        } else {
          console.error(`❌ Error creating player ${player.nickname}:`, error)
        }
      }
    }
    
    console.log(`🎉 Player seeding completed! Created ${createdCount} players, skipped ${skippedCount} existing players`)
    
    // Create a game and register players
    await createGameAndRegisterPlayers()
    
  } catch (error) {
    console.error('❌ Error seeding players:', error)
    throw error
  }
}

async function createGameAndRegisterPlayers() {
  try {
    console.log('🏈 Setting up development game...')
    
    const adminUserId = 'dev_admin_1'
    
    // Check if there's already an open game
    let game = await gameService.getOpenGame()
    
    if (game) {
      console.log('⚠️  Open game already exists, will register players to it')
    } else {
      console.log('🏈 Creating new development game...')
      
      // Create a game for next Saturday at 10:00 AM Amsterdam time
      const nextSaturday = new Date()
      nextSaturday.setDate(nextSaturday.getDate() + (6 - nextSaturday.getDay()) % 7)
      if (nextSaturday.getDay() !== 6) {
        nextSaturday.setDate(nextSaturday.getDate() + 6)
      }
      nextSaturday.setHours(10, 0, 0, 0)
      
      const gameData = {
        date: nextSaturday.toISOString(),
        location: 'Sportpark De Toekomst, Amsterdam',
        markdown: `# Weekend Football Match 🏈

## Match Details
- **Date**: ${nextSaturday.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- **Time**: 10:00 AM (Amsterdam Time)
- **Location**: Sportpark De Toekomst, Amsterdam
- **Duration**: 2 hours

## What to Bring
- Football boots (no metal studs)
- Shin guards
- Water bottle
- Good vibes! 🎉

## Game Format
- 11 vs 11 (if we have enough players)
- Teams will be balanced based on positions and ratings
- Substitutions allowed

## Weather Policy
- Game continues in light rain
- Cancelled only in severe weather conditions
- Check here for updates on match day

Looking forward to a great game! ⚽`
      }
      
      game = await gameService.createGame(adminUserId, gameData)
      console.log(`✅ Created game for ${nextSaturday.toLocaleDateString()} at ${gameData.location}`)
    }
    
    // Register 14 players to the game
    console.log('👥 Registering players to the game...')
    const playersToRegister = samplePlayers.slice(0, 14) // Take first 14 players
    let registeredCount = 0
    
    for (let i = 0; i < playersToRegister.length; i++) {
      const player = playersToRegister[i]
      const userId = `dev_player_${i + 1}`
      
      try {
        await attendanceService.registerAttendance(userId, game.id, 'CONFIRMED')
        registeredCount++
        console.log(`✅ Registered ${player.nickname} to the game`)
      } catch (error) {
        console.error(`❌ Error registering ${player.nickname}:`, error)
      }
    }
    
    console.log(`👥 Registered ${registeredCount} players to the game`)
    
    // Add a guest player (invited by the first registered player)
    console.log('🎭 Adding guest player...')
    const inviterId = 'dev_player_1' // Marco van Bergen will invite the guest
    
    try {
      const guestData = {
        fullName: 'Alex Thompson',
        selfRating: 7,
        primaryPosition: 'MID' as const,
        secondaryPosition: 'ATT' as const
      }
      
      await guestService.createGuest(inviterId, game.id, guestData)
      console.log(`✅ Added guest player: ${guestData.fullName} (invited by Marco_VB)`)
    } catch (error) {
      console.error('❌ Error adding guest player:', error)
    }
    
    console.log('🎉 Game setup completed!')
    
  } catch (error) {
    console.error('❌ Error creating game and registering players:', error)
    throw error
  }
}

export async function checkIfSeedingNeeded(): Promise<boolean> {
  try {
    // Check if admin user exists
    const adminUserId = 'dev_admin_1'
    await userService.getUserWithProfile(adminUserId)
    
    // Admin exists, but check if there's already an open game with players
    const existingGame = await gameService.getOpenGame()
    if (existingGame) {
      // Check if game has registered players
      const roster = await attendanceService.getRoster(existingGame.id)
      const hasRegisteredPlayers = roster.confirmed.length > 0 || roster.waiting.length > 0
      
      if (hasRegisteredPlayers) {
        return false // Game with players exists, no seeding needed
      } else {
        return true // Game exists but no players, need to seed players
      }
    }
    
    return true // Admin exists but no game, need to seed the game
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return true // Admin doesn't exist, seeding needed
    }
    throw error
  }
} 