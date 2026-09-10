import { existsSync, mkdirSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'

export const DB_FILE_NAME = 'sales-pro.db'
export const DB_PATH_ENV = 'SALES_PRO_DB_PATH'

/** Repo-relative home for the development database. Git-ignored. */
const DEV_DB_DIR = '.data'

/**
 * Reads `.env` from `root` when one exists. Node 24 parses .env natively, so
 * this needs no dotenv dependency. Packaged builds ship no .env, which is
 * deliberate: they fall through to the production default below.
 */
export function loadEnvFile(root: string): void {
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) return
  process.loadEnvFile(envPath)
}

/** An explicit override, resolved against `root` when given as a relative path. */
export function envDatabasePath(root: string): string | null {
  const value = process.env[DB_PATH_ENV]?.trim()
  if (!value) return null
  return isAbsolute(value) ? value : resolve(root, value)
}

/**
 * Development keeps the database inside the checkout, so throwaway rows are
 * easy to inspect and delete without touching whatever the packaged build has
 * accumulated in userData.
 */
export function devDatabasePath(root: string): string {
  return join(root, DEV_DB_DIR, DB_FILE_NAME)
}

/** Production uses the OS userData directory, which survives app updates. */
export function prodDatabasePath(userDataDir: string): string {
  return join(userDataDir, DB_FILE_NAME)
}

/** better-sqlite3 creates the database file but not its parent directory. */
export function ensureDatabaseDir(databasePath: string): void {
  mkdirSync(dirname(databasePath), { recursive: true })
}
