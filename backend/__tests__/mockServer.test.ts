import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../mockServer'
import { Express } from 'express'

describe('Mock Server', () => {
  let app: Express

  beforeEach(() => {
    app = createApp()
  })

  describe('Authentication', () => {
    it('should return 401 for requests without Authorization header', async () => {
      const response = await request(app)
        .get('/api/me')
        .expect(401)
      
      expect(response.body.error).toBe('Missing or invalid authorization header')
    })

    it('should return 401 for requests with invalid Authorization header', async () => {
      const response = await request(app)
        .get('/api/me')
        .set('Authorization', 'InvalidToken')
        .expect(401)
      
      expect(response.body.error).toBe('Missing or invalid authorization header')
    })
  })

  describe('GET /api/me', () => {
    it('should return user with null profile for new user', async () => {
      const response = await request(app)
        .get('/api/me')
        .set('Authorization', 'Bearer user_123')
        .expect(200)
      
      expect(response.body).toEqual({
        userId: 'user_123',
        profile: null
      })
    })

    it('should return user with profile after profile creation', async () => {
      const profileData = {
        firstName: 'John',
        lastName: 'Doe',
        nickname: 'johndoe',
        selfRating: 7,
        primaryPosition: 'MID',
        secondaryPosition: 'ATT'
      }

      // Create profile first
      await request(app)
        .post('/api/profile')
        .set('Authorization', 'Bearer user_123')
        .send(profileData)
        .expect(201)

      // Then fetch user
      const response = await request(app)
        .get('/api/me')
        .set('Authorization', 'Bearer user_123')
        .expect(200)
      
      expect(response.body.userId).toBe('user_123')
      expect(response.body.profile).toMatchObject(profileData)
    })
  })

  describe('POST /api/profile', () => {
    it('should create profile with valid data', async () => {
      const profileData = {
        firstName: 'Jane',
        lastName: 'Smith',
        nickname: 'janesmith',
        selfRating: 8,
        primaryPosition: 'DEF',
        secondaryPosition: 'MID'
      }

      const response = await request(app)
        .post('/api/profile')
        .set('Authorization', 'Bearer user_456')
        .send(profileData)
        .expect(201)
      
      expect(response.body).toMatchObject({
        ...profileData,
        userId: 'user_456',
        source: 'SELF'
      })
      expect(response.body.createdAt).toBeDefined()
    })

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/profile')
        .set('Authorization', 'Bearer user_123')
        .send({
          firstName: 'John',
          lastName: 'Doe'
          // Missing required fields
        })
        .expect(400)
      
      expect(response.body.error).toContain('Missing required fields')
    })

    it('should validate selfRating range', async () => {
      const response = await request(app)
        .post('/api/profile')
        .set('Authorization', 'Bearer user_123')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          nickname: 'johndoe',
          selfRating: 11, // Invalid
          primaryPosition: 'MID'
        })
        .expect(400)
      
      expect(response.body.error).toContain('selfRating must be a number between 1 and 10')
    })

    it('should validate position enums', async () => {
      const response = await request(app)
        .post('/api/profile')
        .set('Authorization', 'Bearer user_123')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          nickname: 'johndoe',
          selfRating: 7,
          primaryPosition: 'INVALID' // Invalid position
        })
        .expect(400)
      
      expect(response.body.error).toContain('primaryPosition must be one of: GK, DEF, MID, ATT')
    })

    it('should enforce nickname uniqueness', async () => {
      const profileData = {
        firstName: 'John',
        lastName: 'Doe',
        nickname: 'uniquename',
        selfRating: 7,
        primaryPosition: 'MID'
      }

      // Create first profile
      await request(app)
        .post('/api/profile')
        .set('Authorization', 'Bearer user_123')
        .send(profileData)
        .expect(201)

      // Try to create another profile with same nickname
      const response = await request(app)
        .post('/api/profile')
        .set('Authorization', 'Bearer user_456')
        .send(profileData)
        .expect(409)
      
      expect(response.body.code).toBe('NICKNAME_TAKEN')
    })

    it('should handle optional secondaryPosition', async () => {
      const profileData = {
        firstName: 'John',
        lastName: 'Doe',
        nickname: 'johndoe2',
        selfRating: 7,
        primaryPosition: 'GK'
        // No secondaryPosition
      }

      const response = await request(app)
        .post('/api/profile')
        .set('Authorization', 'Bearer user_789')
        .send(profileData)
        .expect(201)
      
      expect(response.body.secondaryPosition).toBeUndefined()
    })
  })
}) 