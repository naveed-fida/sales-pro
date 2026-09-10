import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC, type CreateCustomerInput } from '@shared/ipc-contract'

// Everything the renderer can reach is enumerated here. Channels come from the
// shared contract, so a renamed channel is a type error rather than a silent
// no-op at runtime.
const api = {
  customers: {
    list: () => ipcRenderer.invoke(IPC.customers.list),
    create: (input: CreateCustomerInput) =>
      ipcRenderer.invoke(IPC.customers.create, input),
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
