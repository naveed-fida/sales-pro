import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { getDb, getDatabasePath } from './client'

/**
 * Generated migration SQL lives in drizzle/ at the repo root during
 * development. In a packaged build it is copied into the app's resources
 * directory by electron-builder's extraResources, which sits outside the asar
 * archive so the migrator can read it as ordinary files.
 */
function getMigrationsFolder(): string {
  return is.dev
    ? join(app.getAppPath(), 'drizzle')
    : join(process.resourcesPath, 'drizzle')
}

export function runMigrations(): void {
  const migrationsFolder = getMigrationsFolder()

  if (!existsSync(migrationsFolder)) {
    throw new Error(
      `Migrations folder missing at ${migrationsFolder}. Run "npm run db:generate" to create it.`,
    )
  }

  migrate(getDb(), { migrationsFolder })
  console.log(`Database ready at ${getDatabasePath()}`)
}
