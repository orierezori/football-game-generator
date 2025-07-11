import { Pool, PoolConfig } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const config: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'football_game_generator',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}

// Alternative: use DATABASE_URL if provided
if (process.env.DATABASE_URL) {
  config.connectionString = process.env.DATABASE_URL
}

const pool = new Pool(config)

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database')
})

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err)
})

export default pool 