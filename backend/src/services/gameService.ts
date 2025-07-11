import pool from '../config/database.js'
import { Game, CreateGameRequest } from '../types/index.js'

export class GameService {
  
  async createGame(adminId: string, gameData: CreateGameRequest): Promise<Game> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // First, archive all existing OPEN games
      await client.query(`
        UPDATE games 
        SET state = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP 
        WHERE state = 'OPEN'
      `)
      
      // Then insert the new game
      const insertQuery = `
        INSERT INTO games (date, location, markdown, created_by) 
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `
      
      const values = [
        gameData.date,
        gameData.location,
        gameData.markdown,
        adminId
      ]
      
      const result = await client.query(insertQuery, values)
      
      if (result.rows.length === 0) {
        throw new Error('Failed to create game')
      }
      
      await client.query('COMMIT')
      
      const row = result.rows[0]
      
      return {
        id: row.id,
        date: row.date.toISOString(),
        location: row.location,
        markdown: row.markdown,
        state: row.state,
        createdBy: row.created_by,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async getOpenGame(): Promise<Game | null> {
    const client = await pool.connect()
    try {
      const query = `
        SELECT * FROM games 
        WHERE state = 'OPEN' 
        ORDER BY created_at DESC 
        LIMIT 1
      `
      
      const result = await client.query(query)
      
      if (result.rows.length === 0) {
        return null
      }
      
      const row = result.rows[0]
      
      return {
        id: row.id,
        date: row.date.toISOString(),
        location: row.location,
        markdown: row.markdown,
        state: row.state,
        createdBy: row.created_by,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      }
    } finally {
      client.release()
    }
  }
} 