import { defineConfig } from 'drizzle-kit'
import {
  devDatabasePath,
  ensureDatabaseDir,
  envDatabasePath,
  loadEnvFile,
} from './src/main/db/paths'

// drizzle-kit runs in plain Node, outside Electron, so the repo root stands in
// for app.getAppPath(). Sharing the resolver with the main process means the
// two cannot drift, which the previous hand-rolled per-OS userData lookup
// could.
const root = process.cwd()
loadEnvFile(root)

// Defaults to the development database, which is what db:studio should open
// while developing. To inspect a packaged build's real data instead, point
// SALES_PRO_DB_PATH at its userData file; see .env.example.
const databasePath = envDatabasePath(root) ?? devDatabasePath(root)
ensureDatabaseDir(databasePath)

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/main/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: `file:${databasePath}`,
  },
  strict: true,
  verbose: true,
})
