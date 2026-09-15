import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { ensureDatabaseDir } from './paths.ts'
import * as schema from './schema.ts'

export type SqliteConnection = Database.Database
export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>

/**
 * Opens SQLite the same way the main process does, without importing Electron.
 * Seed scripts and drizzle-kit live in plain Node, so they cannot call getDb().
 */
export function openDatabase(databasePath: string): {
  sqlite: SqliteConnection
  db: AppDatabase
} {
  ensureDatabaseDir(databasePath)
  const sqlite = new Database(databasePath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('busy_timeout = 5000')
  sqlite.pragma('foreign_keys = ON')
  return { sqlite, db: drizzle(sqlite, { schema }) }
}
