import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Cursor and VS Code are themselves Electron apps, and their integrated
// terminals leak ELECTRON_RUN_AS_NODE=1 into child processes. Inheriting it
// makes our Electron boot as plain Node, so require('electron') resolves to
// the npm shim (a path string) and app/BrowserWindow come back undefined.
// Stripping it here keeps `npm run dev` working from any terminal.
delete process.env.ELECTRON_RUN_AS_NODE

const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('Usage: node scripts/electron-vite.mjs <dev|preview|build> [...args]')
  process.exit(1)
}

// electron-vite does not expose its bin through package.json "exports", so
// resolve it by path. Running it with this Node binary avoids a shell, and with
// it the cross-platform .cmd shim and DEP0190 argument-escaping warning.
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const cli = join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js')

if (!existsSync(cli)) {
  console.error(`Could not find electron-vite CLI at ${cli}. Run npm install.`)
  process.exit(1)
}

const child = spawn(process.execPath, [cli, ...args], { stdio: 'inherit' })

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error('Failed to start electron-vite:', error)
  process.exit(1)
})
