import { ipcMain } from 'electron'
import { z } from 'zod'
import { asc } from 'drizzle-orm'
import {
  IPC,
  createCustomerSchema,
  ipcFail,
  ipcOk,
  type Customer,
  type IpcResult,
} from '@shared/ipc-contract'
import { getDb } from '../db/client'
import { customers } from '../db/schema'

/** SQLite surfaces a unique-index violation with this code. */
const SQLITE_UNIQUE = 'SQLITE_CONSTRAINT_UNIQUE'

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === SQLITE_UNIQUE
  )
}

export function registerCustomerHandlers(): void {
  ipcMain.handle(IPC.customers.list, (): IpcResult<Customer[]> => {
    try {
      const rows = getDb().select().from(customers).orderBy(asc(customers.name)).all()
      return ipcOk(rows)
    } catch (error) {
      console.error('customers:list failed', error)
      return ipcFail('Could not load customers.')
    }
  })

  ipcMain.handle(IPC.customers.create, (_event, payload: unknown): IpcResult<Customer> => {
    // The renderer is untrusted input, so parse before anything else.
    const parsed = createCustomerSchema.safeParse(payload)

    if (!parsed.success) {
      const [issue] = parsed.error.issues
      return ipcFail(issue?.message ?? 'Invalid customer.', issue?.path[0]?.toString())
    }

    try {
      // .get() rather than destructuring: better-sqlite3's synchronous driver
      // needs an explicit terminal method to run the statement.
      const row = getDb().insert(customers).values(parsed.data).returning().get()

      if (!row) return ipcFail('Customer was not created.')

      return ipcOk(row)
    } catch (error) {
      if (isUniqueViolation(error)) {
        return ipcFail('A customer with that email already exists.', 'email')
      }

      console.error('customers:create failed', error)
      return ipcFail('Could not create customer.')
    }
  })
}

// Guards against the schemas and the handler signatures drifting apart.
export type CustomerApi = {
  list: () => Promise<IpcResult<Customer[]>>
  create: (input: z.input<typeof createCustomerSchema>) => Promise<IpcResult<Customer>>
}
