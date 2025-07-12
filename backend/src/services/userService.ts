import pool from '../config/database.js'
import { Profile, User } from '../types/index.js'

export class UserService {
  
  async createUser(userId: string, email: string): Promise<User> {
    const client = await pool.connect()
    try {
      const query = `
        INSERT INTO users (id, email) 
        VALUES ($1, $2) 
        ON CONFLICT (id) DO UPDATE SET 
          email = EXCLUDED.email,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `
      const result = await client.query(query, [userId, email])
      const row = result.rows[0]
      
      return {
        userId,
        email,
        role: row.role as 'PLAYER' | 'ADMIN',
        profile: null
      }
    } finally {
      client.release()
    }
  }

  async getUserWithProfile(userId: string): Promise<User> {
    const client = await pool.connect()
    try {
      const query = `
        SELECT 
          u.id as user_id,
          u.email,
          u.role,
          p.user_id,
          p.first_name,
          p.last_name,
          p.nickname,
          p.rating,
          p.primary_position,
          p.secondary_position,
          p.source,
          p.created_at
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.id = $1
      `
      
      const result = await client.query(query, [userId])
      
      if (result.rows.length === 0) {
        throw new Error('User not found')
      }
      
      const row = result.rows[0]
      
      const user: User = {
        userId: row.user_id,
        email: row.email,
        role: row.role as 'PLAYER' | 'ADMIN',
        profile: null
      }
      
      if (row.first_name) {
        user.profile = {
          userId: row.user_id,
          firstName: row.first_name,
          lastName: row.last_name,
          nickname: row.nickname,
          selfRating: row.rating,
          primaryPosition: row.primary_position,
          secondaryPosition: row.secondary_position,
          source: row.source,
          createdAt: row.created_at.toISOString()
        }
      }
      
      return user
    } finally {
      client.release()
    }
  }

  async createProfile(userId: string, profileData: Omit<Profile, 'userId' | 'source' | 'createdAt'>): Promise<Profile> {
    const client = await pool.connect()
    try {
      const query = `
        INSERT INTO profiles (
          user_id, first_name, last_name, nickname, 
          rating, primary_position, secondary_position, source
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `
      
      const values = [
        userId,
        profileData.firstName,
        profileData.lastName,
        profileData.nickname,
        profileData.selfRating,
        profileData.primaryPosition,
        profileData.secondaryPosition,
        'SELF'
      ]
      
      const result = await client.query(query, values)
      
      if (result.rows.length === 0) {
        throw new Error('Failed to create profile')
      }
      
      const row = result.rows[0]
      
      return {
        userId: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        nickname: row.nickname,
        selfRating: row.rating,
        primaryPosition: row.primary_position,
        secondaryPosition: row.secondary_position,
        source: row.source,
        createdAt: row.created_at.toISOString()
      }
    } finally {
      client.release()
    }
  }

  async isNicknameAvailable(nickname: string): Promise<boolean> {
    const client = await pool.connect()
    try {
      const query = 'SELECT id FROM profiles WHERE nickname = $1'
      const result = await client.query(query, [nickname])
      return result.rows.length === 0
    } finally {
      client.release()
    }
  }

  // Admin functions for user management
  async getAllUsers(search?: string): Promise<User[]> {
    const client = await pool.connect()
    try {
      let query = `
        SELECT 
          u.id as user_id,
          u.email,
          u.role,
          p.user_id,
          p.first_name,
          p.last_name,
          p.nickname,
          p.rating,
          p.primary_position,
          p.secondary_position,
          p.source,
          p.created_at
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE p.nickname IS NOT NULL
      `
      
      const params: any[] = []
      
      if (search && search.trim()) {
        query += ` AND (
          LOWER(p.nickname) LIKE LOWER($1) OR 
          LOWER(CONCAT(p.first_name, ' ', p.last_name)) LIKE LOWER($1)
        )`
        params.push(`%${search.trim()}%`)
      }
      
      query += ` ORDER BY p.nickname ASC`
      
      const result = await client.query(query, params)
      
      return result.rows.map(row => ({
        userId: row.user_id,
        email: row.email,
        role: row.role as 'PLAYER' | 'ADMIN',
        profile: {
          userId: row.user_id,
          firstName: row.first_name,
          lastName: row.last_name,
          nickname: row.nickname,
          selfRating: row.rating,
          primaryPosition: row.primary_position,
          secondaryPosition: row.secondary_position,
          source: row.source,
          createdAt: row.created_at.toISOString()
        }
      }))
    } finally {
      client.release()
    }
  }

  async updateUserRating(userId: string, rating: number, adminUserId: string): Promise<Profile> {
    const client = await pool.connect()
    try {
      // Validate rating range
      if (rating < 1 || rating > 10) {
        throw new Error('Rating must be between 1 and 10')
      }

      const query = `
        UPDATE profiles 
        SET rating = $1, source = 'ADMIN', updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
        RETURNING *
      `
      
      const result = await client.query(query, [rating, userId])
      
      if (result.rows.length === 0) {
        throw new Error('User profile not found')
      }
      
      const row = result.rows[0]
      
      return {
        userId: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        nickname: row.nickname,
        selfRating: row.rating,
        primaryPosition: row.primary_position,
        secondaryPosition: row.secondary_position,
        source: row.source,
        createdAt: row.created_at.toISOString()
      }
    } finally {
      client.release()
    }
  }

  async updateUserPositions(userId: string, primaryPosition: string, secondaryPosition?: string, adminUserId?: string): Promise<Profile> {
    const client = await pool.connect()
    try {
      // Validate positions
      const validPositions = ['GK', 'DEF', 'MID', 'ATT']
      if (!validPositions.includes(primaryPosition)) {
        throw new Error('Invalid primary position')
      }
      if (secondaryPosition && !validPositions.includes(secondaryPosition)) {
        throw new Error('Invalid secondary position')
      }

      const query = `
        UPDATE profiles 
        SET primary_position = $1, secondary_position = $2, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $3
        RETURNING *
      `
      
      const result = await client.query(query, [primaryPosition, secondaryPosition, userId])
      
      if (result.rows.length === 0) {
        throw new Error('User profile not found')
      }
      
      const row = result.rows[0]
      
      return {
        userId: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        nickname: row.nickname,
        selfRating: row.rating,
        primaryPosition: row.primary_position,
        secondaryPosition: row.secondary_position,
        source: row.source,
        createdAt: row.created_at.toISOString()
      }
    } finally {
      client.release()
    }
  }

  // Simple admin check without requiring profile
  async isUserAdmin(userId: string): Promise<boolean> {
    const client = await pool.connect()
    try {
      const query = 'SELECT role FROM users WHERE id = $1'
      const result = await client.query(query, [userId])
      
      if (result.rows.length === 0) {
        return false
      }
      
      return result.rows[0].role === 'ADMIN'
    } finally {
      client.release()
    }
  }
} 