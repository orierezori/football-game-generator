import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/server.js'
import pool from '../src/config/database.js'
import { runMigrations } from '../src/database/migrations.js'

describe('Admin User Management Endpoints', () => {
  let app: any
  let client: any
  let testAdminId: string
  let testPlayerId: string
  let adminToken: string
  let playerToken: string

  beforeEach(async () => {
    // Run migrations to ensure database is in correct state
    await runMigrations()
    
    app = createApp()
    client = await pool.connect()
    
    // Create test admin and player with unique IDs to avoid conflicts
    testAdminId = 'admin_user_mgmt_test'
    testPlayerId = 'player_user_mgmt_test'
    adminToken = testAdminId
    playerToken = testPlayerId

    // Create admin user (without profile, like existing admin tests)
    await client.query(`
      INSERT INTO users (id, email, role) 
      VALUES ($1, 'admin-user-mgmt@test.com', 'ADMIN')
      ON CONFLICT (id) DO UPDATE SET role = 'ADMIN'
    `, [testAdminId])

    // Create regular player
    await client.query(`
      INSERT INTO users (id, email, role) 
      VALUES ($1, 'player-user-mgmt@test.com', 'PLAYER')
      ON CONFLICT (id) DO UPDATE SET role = 'PLAYER'
    `, [testPlayerId])

    // Create player profile
    await client.query(`
      INSERT INTO profiles (user_id, first_name, last_name, nickname, rating, primary_position, secondary_position) 
      VALUES ($1, 'Test', 'Player', 'testplayermgmt', 5, 'DEF', 'MID')
      ON CONFLICT (user_id) DO UPDATE SET nickname = 'testplayermgmt'
    `, [testPlayerId])
  })

  afterEach(async () => {
    // Clean up test data
    await client.query('DELETE FROM profiles WHERE user_id IN ($1, $2)', [testAdminId, testPlayerId])
    await client.query('DELETE FROM users WHERE id IN ($1, $2)', [testAdminId, testPlayerId])
    
    client.release()
  })

  describe('GET /api/admin/users', () => {
    it('should return all users for admin', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThanOrEqual(2) // At least admin and test player
      
      // Check structure of returned users
      const user = response.body.find((u: any) => u.userId === testPlayerId)
      expect(user).toBeDefined()
      expect(user.profile).toBeDefined()
      expect(user.profile.nickname).toBe('testplayermgmt')
      expect(user.profile.selfRating).toBe(5)
      expect(user.profile.primaryPosition).toBe('DEF')
      expect(user.profile.secondaryPosition).toBe('MID')
    })

    it('should filter users by search term', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=testplayermgmt')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBe(1)
      expect(response.body[0].profile.nickname).toBe('testplayermgmt')
    })

    it('should search by full name', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=Test Player')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBe(1)
      expect(response.body[0].profile.firstName).toBe('Test')
      expect(response.body[0].profile.lastName).toBe('Player')
    })

    it('should return empty array for non-matching search', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBe(0)
    })

    it('should reject non-admin users', async () => {
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(403)
    })

    it('should reject unauthenticated requests', async () => {
      await request(app)
        .get('/api/admin/users')
        .expect(401)
    })
  })

  describe('PUT /api/admin/users/:userId/rating', () => {
    it('should update user rating successfully', async () => {
      const newRating = 7
      const response = await request(app)
        .put(`/api/admin/users/${testPlayerId}/rating`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rating: newRating })
        .expect(200)

      expect(response.body.selfRating).toBe(newRating)
      expect(response.body.source).toBe('ADMIN')
      expect(response.body.userId).toBe(testPlayerId)

      // Verify in database
      const dbResult = await client.query('SELECT rating, source FROM profiles WHERE user_id = $1', [testPlayerId])
      expect(dbResult.rows[0].rating).toBe(newRating)
      expect(dbResult.rows[0].source).toBe('ADMIN')
    })

    it('should reject invalid rating values', async () => {
      await request(app)
        .put(`/api/admin/users/${testPlayerId}/rating`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rating: 11 })
        .expect(400)

      await request(app)
        .put(`/api/admin/users/${testPlayerId}/rating`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rating: 0 })
        .expect(400)

      await request(app)
        .put(`/api/admin/users/${testPlayerId}/rating`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rating: 'invalid' })
        .expect(400)
    })

    it('should reject non-admin users', async () => {
      await request(app)
        .put(`/api/admin/users/${testPlayerId}/rating`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ rating: 6 })
        .expect(403)
    })

    it('should return 404 for non-existent user', async () => {
      await request(app)
        .put('/api/admin/users/nonexistent/rating')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rating: 5 })
        .expect(404)
    })
  })

  describe('PUT /api/admin/users/:userId/positions', () => {
    it('should update user positions successfully', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${testPlayerId}/positions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          primaryPosition: 'ATT', 
          secondaryPosition: 'MID' 
        })
        .expect(200)

      expect(response.body.primaryPosition).toBe('ATT')
      expect(response.body.secondaryPosition).toBe('MID')
      expect(response.body.userId).toBe(testPlayerId)

      // Verify in database
      const dbResult = await client.query('SELECT primary_position, secondary_position FROM profiles WHERE user_id = $1', [testPlayerId])
      expect(dbResult.rows[0].primary_position).toBe('ATT')
      expect(dbResult.rows[0].secondary_position).toBe('MID')
    })

    it('should update with only primary position', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${testPlayerId}/positions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          primaryPosition: 'GK'
        })
        .expect(200)

      expect(response.body.primaryPosition).toBe('GK')
      expect(response.body.secondaryPosition).toBeNull()
    })

    it('should reject invalid positions', async () => {
      await request(app)
        .put(`/api/admin/users/${testPlayerId}/positions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ primaryPosition: 'INVALID' })
        .expect(400)

      await request(app)
        .put(`/api/admin/users/${testPlayerId}/positions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          primaryPosition: 'DEF',
          secondaryPosition: 'INVALID' 
        })
        .expect(400)
    })

    it('should require primary position', async () => {
      await request(app)
        .put(`/api/admin/users/${testPlayerId}/positions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ secondaryPosition: 'MID' })
        .expect(400)
    })

    it('should reject non-admin users', async () => {
      await request(app)
        .put(`/api/admin/users/${testPlayerId}/positions`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ primaryPosition: 'ATT' })
        .expect(403)
    })

    it('should return 404 for non-existent user', async () => {
      await request(app)
        .put('/api/admin/users/nonexistent/positions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ primaryPosition: 'DEF' })
        .expect(404)
    })
  })
}) 