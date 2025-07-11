import pool from '../config/database.js'
import { Attendance, AttendanceStatus, GameRoster } from '../types/index.js'

export class AttendanceService {
  private readonly MAX_CONFIRMED_PLAYERS = 24

  async registerAttendance(userId: string, gameId: string, action: AttendanceStatus): Promise<GameRoster> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // First, check if game exists and is OPEN
      const gameCheck = await client.query(
        `SELECT id, state FROM games WHERE id = $1`,
        [gameId]
      )
      
      if (gameCheck.rows.length === 0) {
        throw new Error('Game not found')
      }
      
      if (gameCheck.rows[0].state !== 'OPEN') {
        throw new Error('Game is not open for attendance changes')
      }
      
      // Check current attendance status
      const currentStatus = await client.query(
        `SELECT status FROM attendances WHERE game_id = $1 AND player_id = $2`,
        [gameId, userId]
      )
      
      const existingStatus = currentStatus.rows[0]?.status
      
      // Handle different attendance actions
      if (action === 'CONFIRMED') {
        await this.handleConfirmedRequest(client, gameId, userId, existingStatus)
      } else if (action === 'WAITING') {
        await this.handleWaitingRequest(client, gameId, userId, existingStatus)
      } else if (action === 'OUT') {
        await this.handleOutRequest(client, gameId, userId, existingStatus)
      } else if (action === 'LATE_CONFIRMED') {
        await this.handleLateConfirmedRequest(client, gameId, userId, existingStatus)
      }
      
      await client.query('COMMIT')
      
      // Return updated roster
      return await this.getRoster(gameId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  private async handleConfirmedRequest(client: any, gameId: string, userId: string, existingStatus?: AttendanceStatus) {
    // Count current confirmed players
    const confirmedCount = await client.query(
      `SELECT COUNT(*) as count FROM attendances WHERE game_id = $1 AND status = 'CONFIRMED'`,
      [gameId]
    )
    
    const currentConfirmed = parseInt(confirmedCount.rows[0].count)
    
    if (existingStatus === 'CONFIRMED') {
      // Already confirmed, no change needed
      return
    }
    
    // Check if we can add to confirmed
    if (existingStatus) {
      // Player is changing from another status
      await this.upsertAttendance(client, gameId, userId, 'CONFIRMED')
    } else {
      // New player registration
      if (currentConfirmed >= this.MAX_CONFIRMED_PLAYERS) {
        // Add to waiting list instead
        await this.upsertAttendance(client, gameId, userId, 'WAITING')
      } else {
        await this.upsertAttendance(client, gameId, userId, 'CONFIRMED')
      }
    }
  }

  private async handleWaitingRequest(client: any, gameId: string, userId: string, existingStatus?: AttendanceStatus) {
    if (existingStatus === 'WAITING') {
      // Already waiting, no change needed
      return
    }
    
    await this.upsertAttendance(client, gameId, userId, 'WAITING')
  }

  private async handleOutRequest(client: any, gameId: string, userId: string, existingStatus?: AttendanceStatus) {
    if (existingStatus === 'OUT') {
      // Already out, no change needed
      return
    }
    
    await this.upsertAttendance(client, gameId, userId, 'OUT')
  }

  private async handleLateConfirmedRequest(client: any, gameId: string, userId: string, existingStatus?: AttendanceStatus) {
    if (existingStatus === 'LATE_CONFIRMED') {
      // Already late confirmed, no change needed
      return
    }
    
    await this.upsertAttendance(client, gameId, userId, 'LATE_CONFIRMED')
  }

  private async upsertAttendance(client: any, gameId: string, userId: string, status: AttendanceStatus) {
    const query = `
      INSERT INTO attendances (game_id, player_id, status)
      VALUES ($1, $2, $3)
      ON CONFLICT (game_id, player_id)
      DO UPDATE SET status = $3, updated_at = CURRENT_TIMESTAMP
    `
    
    await client.query(query, [gameId, userId, status])
  }

  async getRoster(gameId: string): Promise<GameRoster> {
    const client = await pool.connect()
    try {
      const query = `
        SELECT 
          a.id, a.game_id, a.player_id, a.status, 
          a.created_at, a.updated_at,
          p.first_name, p.last_name, p.nickname, p.self_rating,
          p.primary_position, p.secondary_position, p.source
        FROM attendances a
        JOIN profiles p ON a.player_id = p.user_id
        WHERE a.game_id = $1 AND a.status IN ('CONFIRMED', 'WAITING', 'LATE_CONFIRMED')
        ORDER BY a.created_at ASC
      `
      
      const result = await client.query(query, [gameId])
      
      const confirmed = result.rows
        .filter(row => row.status === 'CONFIRMED' || row.status === 'LATE_CONFIRMED')
        .map(row => ({
          id: row.id,
          gameId: row.game_id,
          playerId: row.player_id,
          status: row.status as AttendanceStatus,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
          player: {
            userId: row.player_id,
            firstName: row.first_name,
            lastName: row.last_name,
            nickname: row.nickname,
            selfRating: row.self_rating,
            primaryPosition: row.primary_position,
            secondaryPosition: row.secondary_position,
            source: row.source,
            createdAt: row.created_at.toISOString()
          }
        }))
      
      const waiting = result.rows
        .filter(row => row.status === 'WAITING')
        .map(row => ({
          id: row.id,
          gameId: row.game_id,
          playerId: row.player_id,
          status: row.status as AttendanceStatus,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
          player: {
            userId: row.player_id,
            firstName: row.first_name,
            lastName: row.last_name,
            nickname: row.nickname,
            selfRating: row.self_rating,
            primaryPosition: row.primary_position,
            secondaryPosition: row.secondary_position,
            source: row.source,
            createdAt: row.created_at.toISOString()
          }
        }))
      
      return { confirmed, waiting }
    } finally {
      client.release()
    }
  }
} 