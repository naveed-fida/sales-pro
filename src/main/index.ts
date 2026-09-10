import { join } from 'node:path'
import { app, dialog, shell, BrowserWindow } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { closeDb } from './db/client'
import { runMigrations } from './db/migrate'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
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
