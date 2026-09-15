import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { devDatabasePath, envDatabasePath, prodDatabasePath } from './paths'
import { openDatabase, type AppDatabase, type SqliteConnection } from './sqlite'

let connection: SqliteConnection | null = null
let database: AppDatabase | null = null

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
export function getDb(): AppDatabase {
  if (database) return database

  const opened = openDatabase(getDatabasePath())
  connection = opened.sqlite
  database = opened.db
  return database
}

/** The underlying better-sqlite3 handle. Prefer getDb() for queries. */
export function getSqlite(): SqliteConnection {
  getDb()
  if (!connection) {
    throw new Error('Database connection is not open.')
  }
  return connection
}

export function closeDb(): void {
  connection?.close()
  connection = null
  database = null
}
