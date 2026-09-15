import type { ElectronAPI } from '@electron-toolkit/preload'
import type { IpcResult } from '@shared/ipc-result'
import type {
  Category,
  CreateCategoryInput,
  ProductListItem,
  ProductRecord,
  SaveProductImageInput,
  SaveProductInput,
} from '@shared/schemas/catalog'
import type { AppSettings, Printer, SaveSettingsInput } from '@shared/schemas/settings'

export type Api = {
  platform: string
  settings: {
    get: () => Promise<IpcResult<AppSettings>>
    save: (input: SaveSettingsInput) => Promise<IpcResult<AppSettings>>
    listPrinters: () => Promise<IpcResult<Printer[]>>
  }
  categories: {
    list: () => Promise<IpcResult<Category[]>>
    create: (input: CreateCategoryInput) => Promise<IpcResult<Category>>
  }
  products: {
    list: () => Promise<IpcResult<ProductListItem[]>>
    get: (id: number) => Promise<IpcResult<ProductRecord>>
    save: (input: SaveProductInput) => Promise<IpcResult<ProductRecord>>
    delete: (id: number) => Promise<IpcResult<null>>
    saveImage: (input: SaveProductImageInput) => Promise<IpcResult<ProductRecord>>
    clearImage: (id: number) => Promise<IpcResult<ProductRecord>>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
