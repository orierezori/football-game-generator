import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pool from '../config/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runRatingMigration() {
  try {
    console.log('🚀 Running rating column rename migration...')
    
    const migrationPath = path.join(__dirname, 'migration-rating-rename.sql')
    const migrationSql = fs.readFileSync(migrationPath, 'utf8')
    
    await pool.query(migrationSql)
    
    console.log('✅ Rating migration completed successfully')
    
    // Test the migration by querying the new column
    const testQuery = 'SELECT user_id, rating FROM profiles LIMIT 3'
    const result = await pool.query(testQuery)
    console.log('📊 Sample data after migration:')
    console.table(result.rows)
    
  } catch (error) {
    console.error('❌ Rating migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

// Run migration when script is executed directly
if (process.argv[1] && process.argv[1].includes('run-rating-migration.ts')) {
  runRatingMigration()
    .catch((error) => {
      console.error('Migration failed:', error)
      process.exit(1)
    })
} 