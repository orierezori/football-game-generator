import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AttendanceService } from '../src/services/attendanceService.js'
import { GameService } from '../src/services/gameService.js'
import { CreateGameRequest, AttendanceStatus } from '../src/types/index.js'
import pool from '../src/config/database.js'

describe('AttendanceService', () => {
  let attendanceService: AttendanceService
  let gameService: GameService
  const testAdminId = 'user_test_admin'
  const testUserId1 = 'user_test_player1'
  const testUserId2 = 'user_test_player2'
  let testGameId: string

  beforeEach(async () => {
    attendanceService = new AttendanceService()
    gameService = new GameService()
    
    // Create test users
    const client = await pool.connect()
    try {
      await client.query(`
        INSERT INTO users (id, email, role) 
        VALUES ($1, $2, 'ADMIN')
        ON CONFLICT (id) DO UPDATE SET role = 'ADMIN'
      `, [testAdminId, 'test_admin@example.com'])
      
      await client.query(`
        INSERT INTO users (id, email, role) 
        VALUES ($1, $2, 'PLAYER')
        ON CONFLICT (id) DO UPDATE SET role = 'PLAYER'
      `, [testUserId1, 'test_player1@example.com'])
      
      await client.query(`
        INSERT INTO users (id, email, role) 
        VALUES ($1, $2, 'PLAYER')
        ON CONFLICT (id) DO UPDATE SET role = 'PLAYER'
      `, [testUserId2, 'test_player2@example.com'])
      
      // Create test profiles
      await client.query(`
        INSERT INTO profiles (user_id, first_name, last_name, nickname, self_rating, primary_position) 
        VALUES ($1, 'Test', 'Player1', 'testplayer1', 5, 'MID')
        ON CONFLICT (user_id) DO UPDATE SET nickname = 'testplayer1'
      `, [testUserId1])
      
      await client.query(`
        INSERT INTO profiles (user_id, first_name, last_name, nickname, self_rating, primary_position) 
        VALUES ($1, 'Test', 'Player2', 'testplayer2', 6, 'DEF')
        ON CONFLICT (user_id) DO UPDATE SET nickname = 'testplayer2'
      `, [testUserId2])
    } finally {
      client.release()
    }
    
    // Create test game
    const gameData: CreateGameRequest = {
      date: new Date('2024-12-25T18:00:00Z').toISOString(),
      location: 'Test Stadium',
      markdown: '# Test Game\n\nJoin us for a test game!'
    }
    
    const game = await gameService.createGame(testAdminId, gameData)
    testGameId = game.id
  })

  afterEach(async () => {
    // Clean up test data - order matters for foreign key constraints
    const client = await pool.connect()
    try {
      await client.query('DELETE FROM attendances WHERE game_id = $1', [testGameId])
      await client.query('DELETE FROM attendances WHERE player_id LIKE $1', ['dummy_user_%'])
      await client.query('DELETE FROM games WHERE location LIKE $1', ['%test%'])
      await client.query('DELETE FROM profiles WHERE user_id IN ($1, $2)', [testUserId1, testUserId2])
      await client.query('DELETE FROM profiles WHERE user_id LIKE $1', ['dummy_user_%'])
      await client.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [testAdminId, testUserId1, testUserId2])
      await client.query('DELETE FROM users WHERE id LIKE $1', ['dummy_user_%'])
    } finally {
      client.release()
    }
  })

  describe('registerAttendance', () => {
    it('should register new player as CONFIRMED when under cap', async () => {
      const result = await attendanceService.registerAttendance(testUserId1, testGameId, 'CONFIRMED')
      
      expect(result.confirmed).toHaveLength(1)
      expect(result.confirmed[0].playerId).toBe(testUserId1)
      expect(result.confirmed[0].status).toBe('CONFIRMED')
      expect(result.confirmed[0].player.nickname).toBe('testplayer1')
      expect(result.waiting).toHaveLength(0)
    })

    it('should register new player as WAITING when at cap', async () => {
      // Fill up to cap with dummy players
      const client = await pool.connect()
      try {
        for (let i = 0; i < 24; i++) {
          const dummyUserId = `dummy_user_${i}`
          await client.query(`
            INSERT INTO users (id, email, role) 
            VALUES ($1, $2, 'PLAYER')
            ON CONFLICT (id) DO NOTHING
          `, [dummyUserId, `dummy${i}@example.com`])
          
          await client.query(`
            INSERT INTO profiles (user_id, first_name, last_name, nickname, self_rating, primary_position) 
            VALUES ($1, 'Dummy', 'Player', $2, 5, 'MID')
            ON CONFLICT (user_id) DO NOTHING
          `, [dummyUserId, `dummy${i}`])
          
          await client.query(`
            INSERT INTO attendances (game_id, player_id, status) 
            VALUES ($1, $2, 'CONFIRMED')
            ON CONFLICT (game_id, player_id) DO NOTHING
          `, [testGameId, dummyUserId])
        }
      } finally {
        client.release()
      }
      
      const result = await attendanceService.registerAttendance(testUserId1, testGameId, 'CONFIRMED')
      
      expect(result.confirmed).toHaveLength(24)
      expect(result.waiting).toHaveLength(1)
      expect(result.waiting[0].playerId).toBe(testUserId1)
      expect(result.waiting[0].status).toBe('WAITING')
    })

    it('should allow player to change from CONFIRMED to WAITING', async () => {
      // First register as CONFIRMED
      await attendanceService.registerAttendance(testUserId1, testGameId, 'CONFIRMED')
      
      // Then change to WAITING
      const result = await attendanceService.registerAttendance(testUserId1, testGameId, 'WAITING')
      
      expect(result.confirmed).toHaveLength(0)
      expect(result.waiting).toHaveLength(1)
      expect(result.waiting[0].playerId).toBe(testUserId1)
      expect(result.waiting[0].status).toBe('WAITING')
    })

    it('should allow player to change from WAITING to CONFIRMED', async () => {
      // First register as WAITING
      await attendanceService.registerAttendance(testUserId1, testGameId, 'WAITING')
      
      // Then change to CONFIRMED
      const result = await attendanceService.registerAttendance(testUserId1, testGameId, 'CONFIRMED')
      
      expect(result.confirmed).toHaveLength(1)
      expect(result.confirmed[0].playerId).toBe(testUserId1)
      expect(result.confirmed[0].status).toBe('CONFIRMED')
      expect(result.waiting).toHaveLength(0)
    })

    it('should mark player as OUT and exclude from roster', async () => {
      // First register as CONFIRMED
      await attendanceService.registerAttendance(testUserId1, testGameId, 'CONFIRMED')
      
      // Then change to OUT
      const result = await attendanceService.registerAttendance(testUserId1, testGameId, 'OUT')
      
      expect(result.confirmed).toHaveLength(0)
      expect(result.waiting).toHaveLength(0)
    })

    it('should handle LATE_CONFIRMED status', async () => {
      const result = await attendanceService.registerAttendance(testUserId1, testGameId, 'LATE_CONFIRMED')
      
      expect(result.confirmed).toHaveLength(1)
      expect(result.confirmed[0].playerId).toBe(testUserId1)
      expect(result.confirmed[0].status).toBe('LATE_CONFIRMED')
      expect(result.waiting).toHaveLength(0)
    })

    it('should not duplicate attendance for same action', async () => {
      // Register as CONFIRMED twice
      await attendanceService.registerAttendance(testUserId1, testGameId, 'CONFIRMED')
      const result = await attendanceService.registerAttendance(testUserId1, testGameId, 'CONFIRMED')
      
      expect(result.confirmed).toHaveLength(1)
      expect(result.confirmed[0].playerId).toBe(testUserId1)
    })

    it('should throw error for non-existent game', async () => {
      const fakeGameId = '550e8400-e29b-41d4-a716-446655440000'
      
      await expect(
        attendanceService.registerAttendance(testUserId1, fakeGameId, 'CONFIRMED')
      ).rejects.toThrow('Game not found')
    })

    it('should throw error for closed game', async () => {
      // Close the game
      const client = await pool.connect()
      try {
        await client.query(`
          UPDATE games SET state = 'CLOSED' WHERE id = $1
        `, [testGameId])
      } finally {
        client.release()
      }
      
      await expect(
        attendanceService.registerAttendance(testUserId1, testGameId, 'CONFIRMED')
      ).rejects.toThrow('Game is not open for attendance changes')
    })

    it('should rollback transaction on error', async () => {
      // Use non-existent user (should fail foreign key constraint)
      const nonExistentUserId = 'nonexistent_user'
      
      await expect(
        attendanceService.registerAttendance(nonExistentUserId, testGameId, 'CONFIRMED')
      ).rejects.toThrow()
      
      // Verify no attendance was created
      const roster = await attendanceService.getRoster(testGameId)
      expect(roster.confirmed).toHaveLength(0)
      expect(roster.waiting).toHaveLength(0)
    })
  })

  describe('getRoster', () => {
    it('should return empty roster when no attendances exist', async () => {
      const result = await attendanceService.getRoster(testGameId)
      
      expect(result.confirmed).toHaveLength(0)
      expect(result.waiting).toHaveLength(0)
    })

    it('should return roster with confirmed and waiting players', async () => {
      // Add players to different status
      await attendanceService.registerAttendance(testUserId1, testGameId, 'CONFIRMED')
      await attendanceService.registerAttendance(testUserId2, testGameId, 'WAITING')
      
      const result = await attendanceService.getRoster(testGameId)
      
      expect(result.confirmed).toHaveLength(1)
      expect(result.confirmed[0].playerId).toBe(testUserId1)
      expect(result.confirmed[0].player.nickname).toBe('testplayer1')
      
      expect(result.waiting).toHaveLength(1)
      expect(result.waiting[0].playerId).toBe(testUserId2)
      expect(result.waiting[0].player.nickname).toBe('testplayer2')
    })

    it('should not include OUT players in roster', async () => {
      // Add players
      await attendanceService.registerAttendance(testUserId1, testGameId, 'CONFIRMED')
      await attendanceService.registerAttendance(testUserId2, testGameId, 'OUT')
      
      const result = await attendanceService.getRoster(testGameId)
      
      expect(result.confirmed).toHaveLength(1)
      expect(result.confirmed[0].playerId).toBe(testUserId1)
      expect(result.waiting).toHaveLength(0)
    })

    it('should include LATE_CONFIRMED in confirmed list', async () => {
      await attendanceService.registerAttendance(testUserId1, testGameId, 'LATE_CONFIRMED')
      
      const result = await attendanceService.getRoster(testGameId)
      
      expect(result.confirmed).toHaveLength(1)
      expect(result.confirmed[0].playerId).toBe(testUserId1)
      expect(result.confirmed[0].status).toBe('LATE_CONFIRMED')
    })

    it('should order players by registration time', async () => {
      // Register players in specific order
      await attendanceService.registerAttendance(testUserId2, testGameId, 'CONFIRMED')
      await attendanceService.registerAttendance(testUserId1, testGameId, 'CONFIRMED')
      
      const result = await attendanceService.getRoster(testGameId)
      
      expect(result.confirmed).toHaveLength(2)
      expect(result.confirmed[0].playerId).toBe(testUserId2) // First registered
      expect(result.confirmed[1].playerId).toBe(testUserId1) // Second registered
    })
  })
}) 