import type { ElectronAPI } from '@electron-toolkit/preload'
import type { CreateCustomerInput, Customer, IpcResult } from '@shared/ipc-contract'

// The renderer-facing surface. Payload and return types are derived from the
// zod schemas in src/shared, so the contract cannot drift between the two
// sides: change a schema and both the handler and the caller stop compiling.
export interface Api {
  customers: {
    list: () => Promise<IpcResult<Customer[]>>
    create: (input: CreateCustomerInput) => Promise<IpcResult<Customer>>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
