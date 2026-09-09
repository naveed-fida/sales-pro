import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Feature APIs get added here in the IPC step. Everything the renderer can
// reach must be listed explicitly - there is no ambient Node access.
const api = {}

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
