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
import type { ClockStatus } from '@shared/schemas/clock'
import type { Expense, SaveExpenseInput } from '@shared/schemas/expenses'
import type { CustomerMatch, SearchCustomersInput } from '@shared/schemas/customers'
import type {
  PurchaseCatalogVariant,
  PurchaseListItem,
  PurchaseRecord,
  ReceivePurchaseInput,
} from '@shared/schemas/purchases'
import type { ReportRangeInput, ReportSummary } from '@shared/schemas/reports'
import type {
  CompletedReturn,
  CompleteReturnInput,
  LookupReturnInput,
  ReturnBill,
  ReturnListItem,
  ReturnRecord,
} from '@shared/schemas/returns'
import type {
  CompletedSale,
  CompleteSaleInput,
  HeldSale,
  ListSalesInput,
  PosCatalogVariant,
  ReceiptReady,
  SaleListPage,
  SaleRecord,
  SaveHoldInput,
} from '@shared/schemas/sales'
import type {
  AppSettings,
  Printer,
  SaveSettingsInput,
  SaveShopLogoInput,
} from '@shared/schemas/settings'
import type { SaveSupplierInput, Supplier } from '@shared/schemas/suppliers'

export type Api = {
  platform: string
  settings: {
    get: () => Promise<IpcResult<AppSettings>>
    save: (input: SaveSettingsInput) => Promise<IpcResult<AppSettings>>
    saveLogo: (input: SaveShopLogoInput) => Promise<IpcResult<AppSettings>>
    clearLogo: () => Promise<IpcResult<AppSettings>>
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
  customers: {
    search: (input: SearchCustomersInput) => Promise<IpcResult<CustomerMatch[]>>
  }
  sales: {
    catalog: () => Promise<IpcResult<PosCatalogVariant[]>>
    complete: (input: CompleteSaleInput) => Promise<IpcResult<CompletedSale>>
    listHolds: () => Promise<IpcResult<HeldSale[]>>
    saveHold: (input: SaveHoldInput) => Promise<IpcResult<HeldSale>>
    deleteHold: (id: number) => Promise<IpcResult<null>>
    list: (input: ListSalesInput) => Promise<IpcResult<SaleListPage>>
    get: (id: number) => Promise<IpcResult<SaleRecord>>
    print: (id: number) => Promise<IpcResult<null>>
  }
  receipt: {
    ready: (result: ReceiptReady) => void
  }
  returns: {
    lookup: (input: LookupReturnInput) => Promise<IpcResult<ReturnBill>>
    complete: (input: CompleteReturnInput) => Promise<IpcResult<CompletedReturn>>
    list: () => Promise<IpcResult<ReturnListItem[]>>
    get: (id: number) => Promise<IpcResult<ReturnRecord>>
    print: (id: number) => Promise<IpcResult<null>>
  }
  expenses: {
    list: () => Promise<IpcResult<Expense[]>>
    save: (input: SaveExpenseInput) => Promise<IpcResult<Expense>>
    delete: (id: number) => Promise<IpcResult<null>>
  }
  reports: {
    summary: (input: ReportRangeInput) => Promise<IpcResult<ReportSummary>>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
