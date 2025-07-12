import pool from '../config/database.js'
import { GuestPlayer, CreateGuestPlayerRequest, GameRoster } from '../types/index.js'

export class GuestService {
  private readonly MAX_TOTAL_PLAYERS = 24 // Combined limit for players + guests

  async createGuest(inviterId: string, gameId: string, guestData: CreateGuestPlayerRequest): Promise<GameRoster> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // Check if game exists and is OPEN
      const gameCheck = await client.query(
        `SELECT id, state FROM games WHERE id = $1`,
        [gameId]
      )
      
      if (gameCheck.rows.length === 0) {
        throw new Error('Game not found')
      }
      
      if (gameCheck.rows[0].state !== 'OPEN') {
        throw new Error('Game is not open for guest registration')
      }
      
      // Check if inviter is registered for this game
      const inviterCheck = await client.query(
        `SELECT status FROM attendances WHERE game_id = $1 AND player_id = $2`,
        [gameId, inviterId]
      )
      
      if (inviterCheck.rows.length === 0 || inviterCheck.rows[0].status === 'OUT') {
        throw new Error('Only registered players can invite guests')
      }
      
      // Count current confirmed players and guests
      const confirmedCount = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM attendances WHERE game_id = $1 AND status IN ('CONFIRMED', 'LATE_CONFIRMED')) +
          (SELECT COUNT(*) FROM guest_players WHERE game_id = $1 AND status = 'CONFIRMED') as total_confirmed
      `, [gameId])
      
      const currentConfirmed = parseInt(confirmedCount.rows[0].total_confirmed)
      const guestStatus = currentConfirmed >= this.MAX_TOTAL_PLAYERS ? 'WAITING' : 'CONFIRMED'
      
      // Create guest player
      const insertQuery = `
        INSERT INTO guest_players (game_id, inviter_id, full_name, rating, primary_position, secondary_position, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `
      
      const values = [
        gameId,
        inviterId,
        guestData.fullName,
        guestData.selfRating,
        guestData.primaryPosition,
        guestData.secondaryPosition || null,
        guestStatus
      ]
      
      const result = await client.query(insertQuery, values)
      
      if (result.rows.length === 0) {
        throw new Error('Failed to create guest player')
      }
      
      await client.query('COMMIT')
      
      // Return updated roster with guests
      return await this.getRosterWithGuests(gameId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async deleteGuest(guestId: string): Promise<GameRoster> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // Get guest info and check if game is closed
      const guestQuery = `
        SELECT gp.*, g.state as game_state
        FROM guest_players gp
        JOIN games g ON gp.game_id = g.id
        WHERE gp.id = $1
      `
      
      const guestResult = await client.query(guestQuery, [guestId])
      
      if (guestResult.rows.length === 0) {
        throw new Error('Guest not found')
      }
      
      const guest = guestResult.rows[0]
      
      // Check if game is closed - block deletion without rebalance
      if (guest.game_state === 'CLOSED') {
        throw new Error('Cannot delete guest from closed game without team rebalancing')
      }
      
      // Delete the guest
      await client.query(`DELETE FROM guest_players WHERE id = $1`, [guestId])
      
      await client.query('COMMIT')
      
      // Return updated roster
      return await this.getRosterWithGuests(guest.game_id)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async updateGuest(guestId: string, guestData: CreateGuestPlayerRequest): Promise<GuestPlayer> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // Check if guest exists
      const existingGuest = await client.query(
        `SELECT id FROM guest_players WHERE id = $1`,
        [guestId]
      )
      
      if (existingGuest.rows.length === 0) {
        throw new Error('Guest not found')
      }
      
      // Update guest
      const updateQuery = `
        UPDATE guest_players
        SET full_name = $2, rating = $3, primary_position = $4, secondary_position = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `
      
      const values = [
        guestId,
        guestData.fullName,
        guestData.selfRating,
        guestData.primaryPosition,
        guestData.secondaryPosition || null
      ]
      
      const result = await client.query(updateQuery, values)
      
      await client.query('COMMIT')
      
      const row = result.rows[0]
      return {
        id: row.id,
        gameId: row.game_id,
        inviterId: row.inviter_id,
        fullName: row.full_name,
        selfRating: row.rating,
        primaryPosition: row.primary_position,
        secondaryPosition: row.secondary_position,
        status: row.status,
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

  async getGuestsByInviter(gameId: string, inviterId: string): Promise<GuestPlayer[]> {
    const client = await pool.connect()
    try {
      const query = `
        SELECT * FROM guest_players
        WHERE game_id = $1 AND inviter_id = $2
        ORDER BY created_at ASC
      `
      
      const result = await client.query(query, [gameId, inviterId])
      
      return result.rows.map(row => ({
        id: row.id,
        gameId: row.game_id,
        inviterId: row.inviter_id,
        fullName: row.full_name,
        selfRating: row.rating,
        primaryPosition: row.primary_position,
        secondaryPosition: row.secondary_position,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      }))
    } finally {
      client.release()
    }
  }

  async getRosterWithGuests(gameId: string): Promise<GameRoster> {
    const client = await pool.connect()
    try {
      // Get players
      const playersQuery = `
        SELECT 
          a.id, a.game_id, a.player_id, a.status, 
          a.created_at, a.updated_at,
          p.first_name, p.last_name, p.nickname, p.rating,
          p.primary_position, p.secondary_position, p.source
        FROM attendances a
        JOIN profiles p ON a.player_id = p.user_id
        WHERE a.game_id = $1 AND a.status IN ('CONFIRMED', 'WAITING', 'LATE_CONFIRMED')
        ORDER BY a.created_at ASC
      `
      
      const playersResult = await client.query(playersQuery, [gameId])
      
      // Get guests with inviter info
      const guestsQuery = `
        SELECT 
          gp.id, gp.game_id, gp.inviter_id, gp.full_name, gp.rating,
          gp.primary_position, gp.secondary_position, gp.status,
          gp.created_at, gp.updated_at,
          p.first_name as inviter_first_name, p.last_name as inviter_last_name, 
          p.nickname as inviter_nickname, p.rating as inviter_rating,
          p.primary_position as inviter_primary_position, p.secondary_position as inviter_secondary_position,
          p.source as inviter_source
        FROM guest_players gp
        JOIN profiles p ON gp.inviter_id = p.user_id
        WHERE gp.game_id = $1
        ORDER BY gp.inviter_id, gp.created_at ASC
      `
      
      const guestsResult = await client.query(guestsQuery, [gameId])
      
      // Map players
      const confirmedPlayers = playersResult.rows
        .filter(row => row.status === 'CONFIRMED' || row.status === 'LATE_CONFIRMED')
        .map(row => ({
          id: row.id,
          gameId: row.game_id,
          playerId: row.player_id,
          status: row.status,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
          player: {
            userId: row.player_id,
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
      
      const waitingPlayers = playersResult.rows
        .filter(row => row.status === 'WAITING')
        .map(row => ({
          id: row.id,
          gameId: row.game_id,
          playerId: row.player_id,
          status: row.status,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
          player: {
            userId: row.player_id,
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
      
      // Map guests
      const confirmedGuests = guestsResult.rows
        .filter(row => row.status === 'CONFIRMED')
        .map(row => ({
          id: row.id,
          gameId: row.game_id,
          inviterId: row.inviter_id,
          fullName: row.full_name,
          selfRating: row.rating,
          primaryPosition: row.primary_position,
          secondaryPosition: row.secondary_position,
          status: row.status,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
          inviter: {
            userId: row.inviter_id,
            firstName: row.inviter_first_name,
            lastName: row.inviter_last_name,
            nickname: row.inviter_nickname,
            selfRating: row.inviter_rating,
            primaryPosition: row.inviter_primary_position,
            secondaryPosition: row.inviter_secondary_position,
            source: row.inviter_source,
            createdAt: row.created_at.toISOString()
          }
        }))
      
      const waitingGuests = guestsResult.rows
        .filter(row => row.status === 'WAITING')
        .map(row => ({
          id: row.id,
          gameId: row.game_id,
          inviterId: row.inviter_id,
          fullName: row.full_name,
          selfRating: row.rating,
          primaryPosition: row.primary_position,
          secondaryPosition: row.secondary_position,
          status: row.status,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
          inviter: {
            userId: row.inviter_id,
            firstName: row.inviter_first_name,
            lastName: row.inviter_last_name,
            nickname: row.inviter_nickname,
            selfRating: row.inviter_rating,
            primaryPosition: row.inviter_primary_position,
            secondaryPosition: row.inviter_secondary_position,
            source: row.inviter_source,
            createdAt: row.created_at.toISOString()
          }
        }))
      
      return {
        confirmed: confirmedPlayers,
        waiting: waitingPlayers,
        guests: {
          confirmed: confirmedGuests,
          waiting: waitingGuests
        }
      }
    } finally {
      client.release()
    }
  }
} 