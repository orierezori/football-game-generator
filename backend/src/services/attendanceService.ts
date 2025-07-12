import pool from '../config/database.js'
import { Attendance, AttendanceStatus, GameRoster } from '../types/index.js'
import { GuestService } from './guestService.js'

export class AttendanceService {
  private readonly MAX_CONFIRMED_PLAYERS = 24
  private readonly MAX_TOTAL_PLAYERS = 24 // Combined limit for players + guests
  private readonly guestService = new GuestService()

  async registerAttendance(userId: string, gameId: string, action: AttendanceStatus): Promise<GameRoster & { requiresGuestRemovalDialog?: boolean }> {
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
      let requiresGuestRemovalDialog = false
      
      if (action === 'CONFIRMED') {
        await this.handleConfirmedRequest(client, gameId, userId, existingStatus)
      } else if (action === 'WAITING') {
        await this.handleWaitingRequest(client, gameId, userId, existingStatus)
      } else if (action === 'OUT') {
        requiresGuestRemovalDialog = await this.handleOutRequest(client, gameId, userId, existingStatus)
      } else if (action === 'LATE_CONFIRMED') {
        await this.handleLateConfirmedRequest(client, gameId, userId, existingStatus)
      }
      
      await client.query('COMMIT')
      
      // Return updated roster with guest removal dialog flag
      const roster = await this.getRoster(gameId)
      return requiresGuestRemovalDialog ? { ...roster, requiresGuestRemovalDialog } : roster
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
      return false
    }
    
    // Check if user has guests
    const guestCount = await client.query(
      `SELECT COUNT(*) as count FROM guest_players WHERE game_id = $1 AND inviter_id = $2`,
      [gameId, userId]
    )
    
    const hasGuests = parseInt(guestCount.rows[0].count) > 0
    
    await this.upsertAttendance(client, gameId, userId, 'OUT')
    
    // Return whether this user has guests (requires removal dialog)
    return hasGuests
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
    // Delegate to GuestService for complete roster with guests
    return await this.guestService.getRosterWithGuests(gameId)
  }
} 