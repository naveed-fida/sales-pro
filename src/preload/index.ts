import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '@shared/ipc'
import type {
  CreateCategoryInput,
  SaveProductImageInput,
  SaveProductInput,
} from '@shared/schemas/catalog'
import type { ReceivePurchaseInput } from '@shared/schemas/purchases'
import type { ClockStatus } from '@shared/schemas/clock'
import type { CompleteSaleInput, SaveHoldInput } from '@shared/schemas/sales'
import type { SaveSettingsInput } from '@shared/schemas/settings'
import type { SaveSupplierInput } from '@shared/schemas/suppliers'

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
  clock: {
    get: () => ipcRenderer.invoke(IPC.clock.get),
    onStatus: (listener: (status: ClockStatus) => void) => {
      const handler = (_event: unknown, status: ClockStatus): void => {
        listener(status)
      }
      ipcRenderer.on(IPC.clock.changed, handler)
      return () => {
        ipcRenderer.removeListener(IPC.clock.changed, handler)
      }
    },
  },
  categories: {
    list: () => ipcRenderer.invoke(IPC.categories.list),
    create: (input: CreateCategoryInput) =>
      ipcRenderer.invoke(IPC.categories.create, input),
  },
  products: {
    list: () => ipcRenderer.invoke(IPC.products.list),
    listVariants: () => ipcRenderer.invoke(IPC.products.listVariants),
    get: (id: number) => ipcRenderer.invoke(IPC.products.get, { id }),
    save: (input: SaveProductInput) => ipcRenderer.invoke(IPC.products.save, input),
    delete: (id: number) => ipcRenderer.invoke(IPC.products.delete, { id }),
    saveImage: (input: SaveProductImageInput) =>
      ipcRenderer.invoke(IPC.products.saveImage, input),
    clearImage: (id: number) => ipcRenderer.invoke(IPC.products.clearImage, { id }),
  },
  suppliers: {
    list: () => ipcRenderer.invoke(IPC.suppliers.list),
    get: (id: number) => ipcRenderer.invoke(IPC.suppliers.get, { id }),
    save: (input: SaveSupplierInput) => ipcRenderer.invoke(IPC.suppliers.save, input),
    delete: (id: number) => ipcRenderer.invoke(IPC.suppliers.delete, { id }),
  },
  purchases: {
    list: () => ipcRenderer.invoke(IPC.purchases.list),
    get: (id: number) => ipcRenderer.invoke(IPC.purchases.get, { id }),
    receive: (input: ReceivePurchaseInput) =>
      ipcRenderer.invoke(IPC.purchases.receive, input),
    catalog: () => ipcRenderer.invoke(IPC.purchases.catalog),
  },
  sales: {
    catalog: () => ipcRenderer.invoke(IPC.sales.catalog),
    complete: (input: CompleteSaleInput) => ipcRenderer.invoke(IPC.sales.complete, input),
    listHolds: () => ipcRenderer.invoke(IPC.sales.listHolds),
    saveHold: (input: SaveHoldInput) => ipcRenderer.invoke(IPC.sales.saveHold, input),
    deleteHold: (id: number) => ipcRenderer.invoke(IPC.sales.deleteHold, { id }),
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
