import { join } from 'node:path'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { customers } from './schema'

const schema = { customers }

let connection: Database.Database | null = null
let database: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDatabasePath(): string {
  return join(app.getPath('userData'), 'sales-pro.db')
}

/**
 * Opens the SQLite connection, or returns the existing one. The file lives in
 * the OS userData directory so it survives app updates and reinstalls.
 */
export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (database) return database

  connection = new Database(getDatabasePath())

  // WAL lets readers run alongside a writer, which matters because Drizzle
  // Studio opens the same file while the app is running.
  connection.pragma('journal_mode = WAL')
  // Wait rather than throwing SQLITE_BUSY the instant another connection holds
  // the write lock.
  connection.pragma('busy_timeout = 5000')
  connection.pragma('foreign_keys = ON')

  database = drizzle(connection, { schema })
  return database
}

export function closeDb(): void {
  connection?.close()
  connection = null
  database = null
}
