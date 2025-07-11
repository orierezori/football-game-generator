import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/server.js'
import { GameService } from '../src/services/gameService.js'
import { CreateGameRequest } from '../src/types/index.js'
import pool from '../src/config/database.js'

describe('Attendance Endpoints', () => {
  let app: any
  let gameService: GameService
  const testAdminId = 'user_test_admin'
  const testPlayerId = 'user_test_player'
  const testPlayerId2 = 'user_test_player2'
  let testGameId: string

  beforeEach(async () => {
    app = createApp()
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
      `, [testPlayerId, 'test_player@example.com'])
      
      await client.query(`
        INSERT INTO users (id, email, role) 
        VALUES ($1, $2, 'PLAYER')
        ON CONFLICT (id) DO UPDATE SET role = 'PLAYER'
      `, [testPlayerId2, 'test_player2@example.com'])
      
      // Create test profiles
      await client.query(`
        INSERT INTO profiles (user_id, first_name, last_name, nickname, self_rating, primary_position) 
        VALUES ($1, 'Test', 'Player', 'testplayer', 5, 'MID')
        ON CONFLICT (user_id) DO UPDATE SET nickname = 'testplayer'
      `, [testPlayerId])
      
      await client.query(`
        INSERT INTO profiles (user_id, first_name, last_name, nickname, self_rating, primary_position) 
        VALUES ($1, 'Test', 'Player2', 'testplayer2', 6, 'DEF')
        ON CONFLICT (user_id) DO UPDATE SET nickname = 'testplayer2'
      `, [testPlayerId2])
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
    // Clean up test data
    const client = await pool.connect()
    try {
      await client.query('DELETE FROM attendances WHERE game_id = $1', [testGameId])
      await client.query('DELETE FROM games WHERE location LIKE $1', ['%test%'])
      await client.query('DELETE FROM profiles WHERE user_id IN ($1, $2)', [testPlayerId, testPlayerId2])
      await client.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [testAdminId, testPlayerId, testPlayerId2])
    } finally {
      client.release()
    }
  })

  describe('GET /api/game/:id/attendance', () => {
    it('should return empty roster when no attendances exist', async () => {
      const response = await request(app)
        .get(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .expect(200)

      expect(response.body.confirmed).toEqual([])
      expect(response.body.waiting).toEqual([])
    })

    it('should return roster with confirmed and waiting players', async () => {
      // Add attendances directly to database
      const client = await pool.connect()
      try {
        await client.query(`
          INSERT INTO attendances (game_id, player_id, status) 
          VALUES ($1, $2, 'CONFIRMED')
        `, [testGameId, testPlayerId])
        
        await client.query(`
          INSERT INTO attendances (game_id, player_id, status) 
          VALUES ($1, $2, 'WAITING')
        `, [testGameId, testPlayerId2])
      } finally {
        client.release()
      }

      const response = await request(app)
        .get(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .expect(200)

      expect(response.body.confirmed).toHaveLength(1)
      expect(response.body.confirmed[0].playerId).toBe(testPlayerId)
      expect(response.body.confirmed[0].status).toBe('CONFIRMED')
      expect(response.body.confirmed[0].player.nickname).toBe('testplayer')
      
      expect(response.body.waiting).toHaveLength(1)
      expect(response.body.waiting[0].playerId).toBe(testPlayerId2)
      expect(response.body.waiting[0].status).toBe('WAITING')
      expect(response.body.waiting[0].player.nickname).toBe('testplayer2')
    })

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/game/${testGameId}/attendance`)
        .expect(401)
    })

    it('should validate game ID format', async () => {
      await request(app)
        .get('/api/game/invalid-id/attendance')
        .set('Authorization', `Bearer ${testPlayerId}`)
        .expect(400)
        .then(response => {
          expect(response.body.error).toBe('Invalid game ID format')
        })
    })
  })

  describe('POST /api/game/:id/attendance', () => {
    it('should register new player as CONFIRMED', async () => {
      const response = await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'CONFIRMED' })
        .expect(200)

      expect(response.body.confirmed).toHaveLength(1)
      expect(response.body.confirmed[0].playerId).toBe(testPlayerId)
      expect(response.body.confirmed[0].status).toBe('CONFIRMED')
      expect(response.body.confirmed[0].player.nickname).toBe('testplayer')
      expect(response.body.waiting).toHaveLength(0)
    })

    it('should register new player as WAITING', async () => {
      const response = await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'WAITING' })
        .expect(200)

      expect(response.body.confirmed).toHaveLength(0)
      expect(response.body.waiting).toHaveLength(1)
      expect(response.body.waiting[0].playerId).toBe(testPlayerId)
      expect(response.body.waiting[0].status).toBe('WAITING')
    })

    it('should allow player to change status from CONFIRMED to WAITING', async () => {
      // First register as CONFIRMED
      await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'CONFIRMED' })
        .expect(200)

      // Then change to WAITING
      const response = await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'WAITING' })
        .expect(200)

      expect(response.body.confirmed).toHaveLength(0)
      expect(response.body.waiting).toHaveLength(1)
      expect(response.body.waiting[0].playerId).toBe(testPlayerId)
      expect(response.body.waiting[0].status).toBe('WAITING')
    })

    it('should allow player to change status from WAITING to CONFIRMED', async () => {
      // First register as WAITING
      await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'WAITING' })
        .expect(200)

      // Then change to CONFIRMED
      const response = await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'CONFIRMED' })
        .expect(200)

      expect(response.body.confirmed).toHaveLength(1)
      expect(response.body.confirmed[0].playerId).toBe(testPlayerId)
      expect(response.body.confirmed[0].status).toBe('CONFIRMED')
      expect(response.body.waiting).toHaveLength(0)
    })

    it('should mark player as OUT (excluded from roster)', async () => {
      // First register as CONFIRMED
      await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'CONFIRMED' })
        .expect(200)

      // Then change to OUT
      const response = await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'OUT' })
        .expect(200)

      expect(response.body.confirmed).toHaveLength(0)
      expect(response.body.waiting).toHaveLength(0)
    })

    it('should handle LATE_CONFIRMED status', async () => {
      const response = await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'LATE_CONFIRMED' })
        .expect(200)

      expect(response.body.confirmed).toHaveLength(1)
      expect(response.body.confirmed[0].playerId).toBe(testPlayerId)
      expect(response.body.confirmed[0].status).toBe('LATE_CONFIRMED')
      expect(response.body.waiting).toHaveLength(0)
    })

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .send({ action: 'CONFIRMED' })
        .expect(401)
    })

    it('should validate game ID format', async () => {
      await request(app)
        .post('/api/game/invalid-id/attendance')
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'CONFIRMED' })
        .expect(400)
        .then(response => {
          expect(response.body.error).toBe('Invalid game ID format')
        })
    })

    it('should validate required fields', async () => {
      await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({})
        .expect(400)
        .then(response => {
          expect(response.body.error).toBe('Missing required field: action')
        })
    })

    it('should validate action values', async () => {
      await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'INVALID_ACTION' })
        .expect(400)
        .then(response => {
          expect(response.body.error).toBe('action must be one of: CONFIRMED, WAITING, OUT, LATE_CONFIRMED')
        })
    })

    it('should return 404 for non-existent game', async () => {
      const fakeGameId = '550e8400-e29b-41d4-a716-446655440000'
      
      await request(app)
        .post(`/api/game/${fakeGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'CONFIRMED' })
        .expect(404)
        .then(response => {
          expect(response.body.error).toBe('Game not found')
        })
    })

    it('should return 403 for closed game', async () => {
      // Close the game
      const client = await pool.connect()
      try {
        await client.query(`
          UPDATE games SET state = 'CLOSED' WHERE id = $1
        `, [testGameId])
      } finally {
        client.release()
      }

      await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'CONFIRMED' })
        .expect(403)
        .then(response => {
          expect(response.body.error).toBe('Game is not open for attendance changes')
        })
    })

    it('should not create duplicate attendance for same action', async () => {
      // Register as CONFIRMED twice
      await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'CONFIRMED' })
        .expect(200)

      const response = await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'CONFIRMED' })
        .expect(200)

      expect(response.body.confirmed).toHaveLength(1)
      expect(response.body.confirmed[0].playerId).toBe(testPlayerId)
    })

    it('should work for multiple players', async () => {
      // Register first player
      await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send({ action: 'CONFIRMED' })
        .expect(200)

      // Register second player
      const response = await request(app)
        .post(`/api/game/${testGameId}/attendance`)
        .set('Authorization', `Bearer ${testPlayerId2}`)
        .send({ action: 'WAITING' })
        .expect(200)

      expect(response.body.confirmed).toHaveLength(1)
      expect(response.body.confirmed[0].playerId).toBe(testPlayerId)
      expect(response.body.waiting).toHaveLength(1)
      expect(response.body.waiting[0].playerId).toBe(testPlayerId2)
    })
  })
}) 