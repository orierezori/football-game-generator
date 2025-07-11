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
          p.self_rating,
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
          selfRating: row.self_rating,
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
          self_rating, primary_position, secondary_position, source
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
        selfRating: row.self_rating,
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
} 