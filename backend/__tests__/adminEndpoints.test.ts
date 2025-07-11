import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/server.js'
import { Express } from 'express'
import pool from '../src/config/database.js'

describe('Admin Endpoints', () => {
  let app: Express
  const testAdminId = 'user_test_admin'
  const testPlayerId = 'user_test_player'

  beforeEach(async () => {
    app = createApp()
    
    // Create test users
    const client = await pool.connect()
    try {
      await client.query(`
        INSERT INTO users (id, email, role) 
        VALUES ($1, $2, 'ADMIN')
        ON CONFLICT (id) DO UPDATE SET role = 'ADMIN'
      `, [testAdminId, 'admin@example.com'])
      
      await client.query(`
        INSERT INTO users (id, email, role) 
        VALUES ($1, $2, 'PLAYER')
        ON CONFLICT (id) DO UPDATE SET role = 'PLAYER'
      `, [testPlayerId, 'player@example.com'])
    } finally {
      client.release()
    }
  })

  afterEach(async () => {
    // Clean up test data
    const client = await pool.connect()
    try {
      await client.query('DELETE FROM games WHERE location LIKE $1', ['%test%'])
      await client.query('DELETE FROM users WHERE id IN ($1, $2)', [testAdminId, testPlayerId])
    } finally {
      client.release()
    }
  })

  describe('POST /api/admin/game', () => {
    it('should create a new game for admin user', async () => {
      const gameData = {
        date: new Date('2024-12-25T18:00:00Z').toISOString(),
        location: 'Test Stadium',
        markdown: '# Test Game\n\nJoin us for a test game!'
      }

      const response = await request(app)
        .post('/api/admin/game')
        .set('Authorization', `Bearer ${testAdminId}`)
        .send(gameData)
        .expect(201)

      expect(response.body).toBeDefined()
      expect(response.body.id).toBeDefined()
      expect(response.body.location).toBe(gameData.location)
      expect(response.body.markdown).toBe(gameData.markdown)
      expect(response.body.state).toBe('OPEN')
      expect(response.body.createdBy).toBe(testAdminId)
    })

    it('should return 403 for non-admin user', async () => {
      const gameData = {
        date: new Date('2024-12-25T18:00:00Z').toISOString(),
        location: 'Test Stadium',
        markdown: '# Test Game'
      }

      const response = await request(app)
        .post('/api/admin/game')
        .set('Authorization', `Bearer ${testPlayerId}`)
        .send(gameData)
        .expect(403)

      expect(response.body.error).toBe('Admin access required')
    })

    it('should return 401 for unauthenticated user', async () => {
      const gameData = {
        date: new Date('2024-12-25T18:00:00Z').toISOString(),
        location: 'Test Stadium',
        markdown: '# Test Game'
      }

      const response = await request(app)
        .post('/api/admin/game')
        .send(gameData)
        .expect(401)

      expect(response.body.error).toBe('Missing or invalid authorization header')
    })

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/admin/game')
        .set('Authorization', `Bearer ${testAdminId}`)
        .send({
          date: new Date('2024-12-25T18:00:00Z').toISOString()
          // Missing location and markdown
        })
        .expect(400)

      expect(response.body.error).toBe('Missing required fields: date, location, markdown')
    })

    it('should validate date format', async () => {
      const response = await request(app)
        .post('/api/admin/game')
        .set('Authorization', `Bearer ${testAdminId}`)
        .send({
          date: 'invalid-date',
          location: 'Test Stadium',
          markdown: '# Test Game'
        })
        .expect(400)

      expect(response.body.error).toBe('Invalid date format')
    })

    it('should auto-archive existing open games', async () => {
      // Create first game
      const firstGameData = {
        date: new Date('2024-12-20T18:00:00Z').toISOString(),
        location: 'Test Stadium 1',
        markdown: '# First Test Game'
      }

      await request(app)
        .post('/api/admin/game')
        .set('Authorization', `Bearer ${testAdminId}`)
        .send(firstGameData)
        .expect(201)

      // Create second game
      const secondGameData = {
        date: new Date('2024-12-25T18:00:00Z').toISOString(),
        location: 'Test Stadium 2',
        markdown: '# Second Test Game'
      }

      const secondResponse = await request(app)
        .post('/api/admin/game')
        .set('Authorization', `Bearer ${testAdminId}`)
        .send(secondGameData)
        .expect(201)

      // Verify only the second game is open
      const openGameResponse = await request(app)
        .get('/api/game/open')
        .set('Authorization', `Bearer ${testPlayerId}`)
        .expect(200)

      expect(openGameResponse.body.id).toBe(secondResponse.body.id)
      expect(openGameResponse.body.location).toBe('Test Stadium 2')
    })
  })

  describe('GET /api/game/open', () => {
    it('should return 404 when no open game exists', async () => {
      const response = await request(app)
        .get('/api/game/open')
        .set('Authorization', `Bearer ${testPlayerId}`)
        .expect(404)

      expect(response.body.error).toBe('No open game found')
    })

    it('should return open game when one exists', async () => {
      // Create a game first
      const gameData = {
        date: new Date('2024-12-25T18:00:00Z').toISOString(),
        location: 'Test Stadium',
        markdown: '# Test Game'
      }

      const createResponse = await request(app)
        .post('/api/admin/game')
        .set('Authorization', `Bearer ${testAdminId}`)
        .send(gameData)
        .expect(201)

      // Get the open game
      const response = await request(app)
        .get('/api/game/open')
        .set('Authorization', `Bearer ${testPlayerId}`)
        .expect(200)

      expect(response.body.id).toBe(createResponse.body.id)
      expect(response.body.location).toBe(gameData.location)
      expect(response.body.markdown).toBe(gameData.markdown)
      expect(response.body.state).toBe('OPEN')
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/game/open')
        .expect(401)

      expect(response.body.error).toBe('Missing or invalid authorization header')
    })

    it('should work for any authenticated user (not just admin)', async () => {
      // Create a game first
      const gameData = {
        date: new Date('2024-12-25T18:00:00Z').toISOString(),
        location: 'Test Stadium',
        markdown: '# Test Game'
      }

      await request(app)
        .post('/api/admin/game')
        .set('Authorization', `Bearer ${testAdminId}`)
        .send(gameData)
        .expect(201)

      // Regular player should be able to get the open game
      const response = await request(app)
        .get('/api/game/open')
        .set('Authorization', `Bearer ${testPlayerId}`)
        .expect(200)

      expect(response.body.location).toBe(gameData.location)
      expect(response.body.state).toBe('OPEN')
    })
  })
}) 