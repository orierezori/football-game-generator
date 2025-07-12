import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GuestService } from '../src/services/guestService.js'
import { AttendanceService } from '../src/services/attendanceService.js'
import { GameService } from '../src/services/gameService.js'
import { CreateGameRequest, CreateGuestPlayerRequest } from '../src/types/index.js'
import pool from '../src/config/database.js'

describe('GuestService', () => {
  let guestService: GuestService
  let attendanceService: AttendanceService
  let gameService: GameService
  const testAdminId = 'user_test_admin'
  const testInviterId = 'user_test_inviter'
  const testPlayerId = 'user_test_player'
  let testGameId: string

  beforeEach(async () => {
    guestService = new GuestService()
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
      `, [testInviterId, 'test_inviter@example.com'])
      
      await client.query(`
        INSERT INTO users (id, email, role) 
        VALUES ($1, $2, 'PLAYER')
        ON CONFLICT (id) DO UPDATE SET role = 'PLAYER'
      `, [testPlayerId, 'test_player@example.com'])
      
      // Create test profiles
      await client.query(`
        INSERT INTO profiles (user_id, first_name, last_name, nickname, rating, primary_position) 
        VALUES ($1, 'Test', 'Inviter', 'testinviter', 5, 'MID')
        ON CONFLICT (user_id) DO UPDATE SET nickname = 'testinviter'
      `, [testInviterId])
      
      await client.query(`
        INSERT INTO profiles (user_id, first_name, last_name, nickname, rating, primary_position) 
        VALUES ($1, 'Test', 'Player', 'testplayer', 6, 'DEF')
        ON CONFLICT (user_id) DO UPDATE SET nickname = 'testplayer'
      `, [testPlayerId])
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

    // Register inviter for the game
    await attendanceService.registerAttendance(testInviterId, testGameId, 'CONFIRMED')
  })

  afterEach(async () => {
    // Clean up test data - order matters for foreign key constraints
    const client = await pool.connect()
    try {
      await client.query('DELETE FROM guest_players WHERE game_id = $1', [testGameId])
      await client.query('DELETE FROM attendances WHERE game_id = $1', [testGameId])
      await client.query('DELETE FROM games WHERE location LIKE $1', ['%test%'])
      await client.query('DELETE FROM profiles WHERE user_id IN ($1, $2)', [testInviterId, testPlayerId])
      await client.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [testAdminId, testInviterId, testPlayerId])
    } finally {
      client.release()
    }
  })

  describe('createGuest', () => {
    it('should create a guest player successfully', async () => {
      const guestData: CreateGuestPlayerRequest = {
        fullName: 'John Doe',
        selfRating: 7,
        primaryPosition: 'ATT',
        secondaryPosition: 'MID'
      }

      const roster = await guestService.createGuest(testInviterId, testGameId, guestData)
      
      expect(roster.guests.confirmed).toHaveLength(1)
      expect(roster.guests.confirmed[0].fullName).toBe('John Doe')
      expect(roster.guests.confirmed[0].selfRating).toBe(7)
      expect(roster.guests.confirmed[0].primaryPosition).toBe('ATT')
      expect(roster.guests.confirmed[0].secondaryPosition).toBe('MID')
      expect(roster.guests.confirmed[0].status).toBe('CONFIRMED')
      expect(roster.guests.confirmed[0].inviterId).toBe(testInviterId)
    })

    it('should create guest as WAITING when at player cap', async () => {
      // Fill up to cap with dummy players
      const client = await pool.connect()
      try {
        for (let i = 0; i < 23; i++) {
          const dummyUserId = `dummy_user_${i}`
          await client.query(`
            INSERT INTO users (id, email, role) 
            VALUES ($1, $2, 'PLAYER')
            ON CONFLICT (id) DO NOTHING
          `, [dummyUserId, `dummy${i}@example.com`])
          
          await client.query(`
            INSERT INTO profiles (user_id, first_name, last_name, nickname, rating, primary_position) 
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

      const guestData: CreateGuestPlayerRequest = {
        fullName: 'Jane Doe',
        selfRating: 8,
        primaryPosition: 'DEF'
      }

      const roster = await guestService.createGuest(testInviterId, testGameId, guestData)
      
      expect(roster.guests.waiting).toHaveLength(1)
      expect(roster.guests.waiting[0].fullName).toBe('Jane Doe')
      expect(roster.guests.waiting[0].status).toBe('WAITING')
      expect(roster.confirmed).toHaveLength(24) // 1 inviter + 23 dummies
    })

    it('should throw error for non-existent game', async () => {
      const fakeGameId = '550e8400-e29b-41d4-a716-446655440000'
      const guestData: CreateGuestPlayerRequest = {
        fullName: 'John Doe',
        selfRating: 7,
        primaryPosition: 'ATT'
      }

      await expect(
        guestService.createGuest(testInviterId, fakeGameId, guestData)
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

      const guestData: CreateGuestPlayerRequest = {
        fullName: 'John Doe',
        selfRating: 7,
        primaryPosition: 'ATT'
      }

      await expect(
        guestService.createGuest(testInviterId, testGameId, guestData)
      ).rejects.toThrow('Game is not open for guest registration')
    })

    it('should throw error for unregistered inviter', async () => {
      const guestData: CreateGuestPlayerRequest = {
        fullName: 'John Doe',
        selfRating: 7,
        primaryPosition: 'ATT'
      }

      await expect(
        guestService.createGuest(testPlayerId, testGameId, guestData)
      ).rejects.toThrow('Only registered players can invite guests')
    })

    it('should throw error for OUT inviter', async () => {
      // Mark inviter as OUT
      await attendanceService.registerAttendance(testInviterId, testGameId, 'OUT')

      const guestData: CreateGuestPlayerRequest = {
        fullName: 'John Doe',
        selfRating: 7,
        primaryPosition: 'ATT'
      }

      await expect(
        guestService.createGuest(testInviterId, testGameId, guestData)
      ).rejects.toThrow('Only registered players can invite guests')
    })
  })

  describe('deleteGuest', () => {
    let testGuestId: string

    beforeEach(async () => {
      const guestData: CreateGuestPlayerRequest = {
        fullName: 'John Doe',
        selfRating: 7,
        primaryPosition: 'ATT'
      }

      const roster = await guestService.createGuest(testInviterId, testGameId, guestData)
      testGuestId = roster.guests.confirmed[0].id
    })

    it('should delete guest successfully', async () => {
      const roster = await guestService.deleteGuest(testGuestId)
      
      expect(roster.guests.confirmed).toHaveLength(0)
      expect(roster.guests.waiting).toHaveLength(0)
    })

    it('should throw error for non-existent guest', async () => {
      const fakeGuestId = '550e8400-e29b-41d4-a716-446655440000'

      await expect(
        guestService.deleteGuest(fakeGuestId)
      ).rejects.toThrow('Guest not found')
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
        guestService.deleteGuest(testGuestId)
      ).rejects.toThrow('Cannot delete guest from closed game without team rebalancing')
    })
  })

  describe('updateGuest', () => {
    let testGuestId: string

    beforeEach(async () => {
      const guestData: CreateGuestPlayerRequest = {
        fullName: 'John Doe',
        selfRating: 7,
        primaryPosition: 'ATT'
      }

      const roster = await guestService.createGuest(testInviterId, testGameId, guestData)
      testGuestId = roster.guests.confirmed[0].id
    })

    it('should update guest successfully', async () => {
      const updateData: CreateGuestPlayerRequest = {
        fullName: 'Jane Smith',
        selfRating: 9,
        primaryPosition: 'GK',
        secondaryPosition: 'DEF'
      }

      const updatedGuest = await guestService.updateGuest(testGuestId, updateData)
      
      expect(updatedGuest.fullName).toBe('Jane Smith')
      expect(updatedGuest.selfRating).toBe(9)
      expect(updatedGuest.primaryPosition).toBe('GK')
      expect(updatedGuest.secondaryPosition).toBe('DEF')
    })

    it('should throw error for non-existent guest', async () => {
      const fakeGuestId = '550e8400-e29b-41d4-a716-446655440000'
      const updateData: CreateGuestPlayerRequest = {
        fullName: 'Jane Smith',
        selfRating: 9,
        primaryPosition: 'GK'
      }

      await expect(
        guestService.updateGuest(fakeGuestId, updateData)
      ).rejects.toThrow('Guest not found')
    })
  })

  describe('getGuestsByInviter', () => {
    it('should return guests for inviter', async () => {
      const guestData1: CreateGuestPlayerRequest = {
        fullName: 'John Doe',
        selfRating: 7,
        primaryPosition: 'ATT'
      }

      const guestData2: CreateGuestPlayerRequest = {
        fullName: 'Jane Smith',
        selfRating: 8,
        primaryPosition: 'DEF'
      }

      await guestService.createGuest(testInviterId, testGameId, guestData1)
      await guestService.createGuest(testInviterId, testGameId, guestData2)

      const guests = await guestService.getGuestsByInviter(testGameId, testInviterId)
      
      expect(guests).toHaveLength(2)
      expect(guests[0].fullName).toBe('John Doe')
      expect(guests[1].fullName).toBe('Jane Smith')
    })

    it('should return empty array for inviter with no guests', async () => {
      const guests = await guestService.getGuestsByInviter(testGameId, testInviterId)
      expect(guests).toHaveLength(0)
    })
  })

  describe('getRosterWithGuests', () => {
    it('should return roster with guests included', async () => {
      const guestData: CreateGuestPlayerRequest = {
        fullName: 'John Doe',
        selfRating: 7,
        primaryPosition: 'ATT'
      }

      await guestService.createGuest(testInviterId, testGameId, guestData)
      
      const roster = await guestService.getRosterWithGuests(testGameId)
      
      expect(roster.confirmed).toHaveLength(1) // inviter
      expect(roster.guests.confirmed).toHaveLength(1) // guest
      expect(roster.guests.confirmed[0].fullName).toBe('John Doe')
      expect(roster.guests.confirmed[0].inviter.nickname).toBe('testinviter')
    })

    it('should order guests by inviter then creation time', async () => {
      // Register another player
      await attendanceService.registerAttendance(testPlayerId, testGameId, 'CONFIRMED')

      // Create guests for both inviters
      const guestData1: CreateGuestPlayerRequest = {
        fullName: 'John Doe',
        selfRating: 7,
        primaryPosition: 'ATT'
      }

      const guestData2: CreateGuestPlayerRequest = {
        fullName: 'Jane Smith',
        selfRating: 8,
        primaryPosition: 'DEF'
      }

      await guestService.createGuest(testInviterId, testGameId, guestData1)
      await guestService.createGuest(testPlayerId, testGameId, guestData2)

      const roster = await guestService.getRosterWithGuests(testGameId)
      
      expect(roster.guests.confirmed).toHaveLength(2)
      // Guests should be ordered by inviter_id, then by created_at
      expect(roster.guests.confirmed[0].inviterId).toBe(testInviterId)
      expect(roster.guests.confirmed[1].inviterId).toBe(testPlayerId)
    })
  })
}) 