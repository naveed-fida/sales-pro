import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'drizzle-kit'

// This config runs in plain Node, outside Electron, so app.getPath('userData')
// is unavailable and the per-OS location has to be reconstructed. Keep in sync
// with getDatabasePath() in src/main/db/client.ts.
const APP_NAME = 'sales-pro'

function userDataDir(): string {
  switch (platform()) {
    case 'darwin':
      return join(homedir(), 'Library', 'Application Support', APP_NAME)
    case 'win32':
      return join(process.env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming'), APP_NAME)
    default:
      return join(process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config'), APP_NAME)
  }
}

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/main/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: `file:${join(userDataDir(), `${APP_NAME}.db`)}`,
  },
  strict: true,
  verbose: true,
})
