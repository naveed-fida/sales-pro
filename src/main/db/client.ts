import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import {
  devDatabasePath,
  ensureDatabaseDir,
  envDatabasePath,
  prodDatabasePath,
} from './paths'
import * as schema from './schema'

let connection: Database.Database | null = null
let database: ReturnType<typeof drizzle<typeof schema>> | null = null

/**
 * SALES_PRO_DB_PATH wins if set, then development lands inside the checkout
 * and packaged builds land in userData. In dev `getAppPath()` is the repo
 * root; once packaged it is inside the asar, which is why the production
 * branch never touches it.
 */
export function getDatabasePath(): string {
  const root = app.getAppPath()
  const override = envDatabasePath(root)
  if (override) return override

  return is.dev ? devDatabasePath(root) : prodDatabasePath(app.getPath('userData'))
}

/** Opens the SQLite connection, or returns the existing one. */
export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (database) return database

  const databasePath = getDatabasePath()
  ensureDatabaseDir(databasePath)
  connection = new Database(databasePath)

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
