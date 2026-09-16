import type { ElectronAPI } from '@electron-toolkit/preload'
import type { IpcResult } from '@shared/ipc-result'
import type {
  Category,
  CreateCategoryInput,
  ProductListItem,
  ProductRecord,
  LabelVariant,
  SaveProductImageInput,
  SaveProductInput,
} from '@shared/schemas/catalog'
import type {
  PurchaseCatalogVariant,
  PurchaseListItem,
  PurchaseRecord,
  ReceivePurchaseInput,
} from '@shared/schemas/purchases'
import type { ClockStatus } from '@shared/schemas/clock'
import type { AppSettings, Printer, SaveSettingsInput } from '@shared/schemas/settings'
import type { SaveSupplierInput, Supplier } from '@shared/schemas/suppliers'

export type Api = {
  platform: string
  settings: {
    get: () => Promise<IpcResult<AppSettings>>
    save: (input: SaveSettingsInput) => Promise<IpcResult<AppSettings>>
    listPrinters: () => Promise<IpcResult<Printer[]>>
  }
  clock: {
    get: () => Promise<IpcResult<ClockStatus>>
    onStatus: (listener: (status: ClockStatus) => void) => () => void
  }
  categories: {
    list: () => Promise<IpcResult<Category[]>>
    create: (input: CreateCategoryInput) => Promise<IpcResult<Category>>
  }
  products: {
    list: () => Promise<IpcResult<ProductListItem[]>>
    listVariants: () => Promise<IpcResult<LabelVariant[]>>
    get: (id: number) => Promise<IpcResult<ProductRecord>>
    save: (input: SaveProductInput) => Promise<IpcResult<ProductRecord>>
    delete: (id: number) => Promise<IpcResult<null>>
    saveImage: (input: SaveProductImageInput) => Promise<IpcResult<ProductRecord>>
    clearImage: (id: number) => Promise<IpcResult<ProductRecord>>
  }
  suppliers: {
    list: () => Promise<IpcResult<Supplier[]>>
    get: (id: number) => Promise<IpcResult<Supplier>>
    save: (input: SaveSupplierInput) => Promise<IpcResult<Supplier>>
    delete: (id: number) => Promise<IpcResult<null>>
  }
  purchases: {
    list: () => Promise<IpcResult<PurchaseListItem[]>>
    get: (id: number) => Promise<IpcResult<PurchaseRecord>>
    receive: (input: ReceivePurchaseInput) => Promise<IpcResult<PurchaseRecord>>
    catalog: () => Promise<IpcResult<PurchaseCatalogVariant[]>>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
