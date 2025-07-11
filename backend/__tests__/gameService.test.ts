import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GameService } from '../src/services/gameService.js'
import { CreateGameRequest } from '../src/types/index.js'
import pool from '../src/config/database.js'

describe('GameService', () => {
  let gameService: GameService
  const testAdminId = 'user_test_admin'

  beforeEach(async () => {
    gameService = new GameService()
    
    // Create test admin user
    const client = await pool.connect()
    try {
      await client.query(`
        INSERT INTO users (id, email, role) 
        VALUES ($1, $2, 'ADMIN')
        ON CONFLICT (id) DO UPDATE SET role = 'ADMIN'
      `, [testAdminId, 'test_admin@example.com'])
    } finally {
      client.release()
    }
  })

  afterEach(async () => {
    // Clean up test data
    const client = await pool.connect()
    try {
      await client.query('DELETE FROM games WHERE location LIKE $1', ['%test%'])
      await client.query('DELETE FROM users WHERE id = $1', [testAdminId])
    } finally {
      client.release()
    }
  })

  describe('createGame', () => {
    it('should create a new game successfully', async () => {
      const gameData: CreateGameRequest = {
        date: new Date('2024-12-25T18:00:00Z').toISOString(),
        location: 'Test Stadium',
        markdown: '# Test Game\n\nJoin us for a test game!'
      }

      const result = await gameService.createGame(testAdminId, gameData)

      expect(result).toBeDefined()
      expect(result.id).toBeDefined()
      expect(result.date).toBeDefined()
      expect(new Date(result.date).getFullYear()).toBe(2024)
      expect(new Date(result.date).getMonth()).toBe(11) // December is month 11
      expect(result.location).toBe(gameData.location)
      expect(result.markdown).toBe(gameData.markdown)
      expect(result.state).toBe('OPEN')
      expect(result.createdBy).toBe(testAdminId)
      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
    })

    it('should auto-archive existing OPEN games when creating new game', async () => {
      // First create a game
      const firstGameData: CreateGameRequest = {
        date: new Date('2024-12-20T18:00:00Z').toISOString(),
        location: 'Test Stadium 1',
        markdown: '# First Test Game'
      }

      const firstGame = await gameService.createGame(testAdminId, firstGameData)
      expect(firstGame.state).toBe('OPEN')

      // Create a second game (should archive the first)
      const secondGameData: CreateGameRequest = {
        date: new Date('2024-12-25T18:00:00Z').toISOString(),
        location: 'Test Stadium 2',
        markdown: '# Second Test Game'
      }

      const secondGame = await gameService.createGame(testAdminId, secondGameData)
      expect(secondGame.state).toBe('OPEN')

      // Verify first game is archived
      const client = await pool.connect()
      try {
        const result = await client.query(
          'SELECT state FROM games WHERE id = $1',
          [firstGame.id]
        )
        expect(result.rows[0].state).toBe('ARCHIVED')
      } finally {
        client.release()
      }
    })

    it('should rollback transaction on error', async () => {
      const gameData: CreateGameRequest = {
        date: new Date('2024-12-25T18:00:00Z').toISOString(),
        location: 'Test Stadium',
        markdown: '# Test Game'
      }

      // Use invalid adminId to trigger foreign key constraint error
      const invalidAdminId = 'nonexistent_user'
      
      await expect(
        gameService.createGame(invalidAdminId, gameData)
      ).rejects.toThrow()

      // Verify no games were created
      const openGame = await gameService.getOpenGame()
      expect(openGame).toBeNull()
    })
  })

  describe('getOpenGame', () => {
    it('should return null when no open game exists', async () => {
      const result = await gameService.getOpenGame()
      expect(result).toBeNull()
    })

    it('should return the open game when one exists', async () => {
      const gameData: CreateGameRequest = {
        date: new Date('2024-12-25T18:00:00Z').toISOString(),
        location: 'Test Stadium',
        markdown: '# Test Game'
      }

      const createdGame = await gameService.createGame(testAdminId, gameData)
      const openGame = await gameService.getOpenGame()

      expect(openGame).toBeDefined()
      expect(openGame?.id).toBe(createdGame.id)
      expect(openGame?.state).toBe('OPEN')
    })

    it('should return most recent open game when multiple exist', async () => {
      // This test ensures our auto-archive logic works
      const firstGameData: CreateGameRequest = {
        date: new Date('2024-12-20T18:00:00Z').toISOString(),
        location: 'Test Stadium 1',
        markdown: '# First Test Game'
      }

      const secondGameData: CreateGameRequest = {
        date: new Date('2024-12-25T18:00:00Z').toISOString(),
        location: 'Test Stadium 2',
        markdown: '# Second Test Game'
      }

      await gameService.createGame(testAdminId, firstGameData)
      const secondGame = await gameService.createGame(testAdminId, secondGameData)

      const openGame = await gameService.getOpenGame()
      expect(openGame?.id).toBe(secondGame.id)
      expect(openGame?.location).toBe('Test Stadium 2')
    })
  })
}) 