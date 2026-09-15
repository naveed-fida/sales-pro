import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '@shared/ipc'
import type { SaveSettingsInput } from '@shared/schemas/settings'

// Everything the renderer can reach is enumerated here. Channels come from
// src/shared/ipc.ts, so a renamed channel is a type error rather than a silent
// no-op at runtime.
const api = {
  platform: process.platform,
  settings: {
    get: () => ipcRenderer.invoke(IPC.settings.get),
    save: (input: SaveSettingsInput) => ipcRenderer.invoke(IPC.settings.save, input),
    listPrinters: () => ipcRenderer.invoke(IPC.settings.listPrinters),
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose preload APIs over contextBridge', error)
  }
} else {
  // Only reachable if contextIsolation is turned off, which this app does not do.
  // @ts-expect-error augmenting window without contextBridge
  window.electron = electronAPI
  // @ts-expect-error augmenting window without contextBridge
  window.api = api
}
