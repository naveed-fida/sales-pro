import { join } from 'node:path'
import { app, dialog, shell, BrowserWindow } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { closeDb } from './db/client'
import { runMigrations } from './db/migrate'
import { loadEnvFile } from './db/paths'
import { registerIpcHandlers } from './ipc'

// Development gets its own userData root, and this has to happen before
// anything reads a path from it. Chromium keeps the single-instance lock and
// the renderer's storage there, so sharing it with a packaged build means
// whichever launches second quits on sight.
if (is.dev) {
  app.setPath('userData', join(app.getPath('appData'), 'sales-pro-dev'))
}

// In dev getAppPath() is the repo root, so this picks up the checkout's .env.
// Packaged builds ship none and fall through to the production defaults.
loadEnvFile(app.getAppPath())

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    // Custom title bar on both platforms: traffic lights on macOS, overlay
    // caption buttons on Windows. The renderer draws logo, name, and drag region.
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 16 } : undefined,
    titleBarOverlay:
      process.platform === 'win32'
        ? { color: '#fafafa', symbolColor: '#0a0a0a', height: 48 }
        : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Keep the renderer untrusted: no Node, no direct filesystem. Everything
      // crosses contextBridge. sandbox stays off so the preload can use
      // @electron-toolkit/preload.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // External links open in the user's browser, never in an app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// A second launch should focus the existing window rather than start a rival
// instance, which would race on the SQLite file.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.salespro.app')

    // Schema must be current before any window can issue a query. Failing here
    // is unrecoverable, so surface it and exit rather than opening a window
    // that will throw on its first read.
    try {
      runMigrations()
    } catch (error) {
      dialog.showErrorBox(
        'Database error',
        `Sales Pro could not prepare its database.\n\n${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      app.exit(1)
      return
    }

    registerIpcHandlers()

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // Close the connection cleanly so WAL is checkpointed into the main db file.
  app.on('will-quit', () => {
    closeDb()
  })
}
