import { asc, eq, like, or } from 'drizzle-orm'
import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import { ipcFail, ipcOk, type IpcResult } from '@shared/ipc-result'
import { searchCustomersSchema, type CustomerMatch } from '@shared/schemas/customers'
import { getDb } from '../db/client'
import type { AppDatabase } from '../db/sqlite'
import { customers } from '../db/schema'

type ShopTx = Parameters<Parameters<AppDatabase['transaction']>[0]>[0]

function likePattern(search: string): string {
  return `%${search.replaceAll('%', '').replaceAll('_', '')}%`
}

function searchCustomers(query: string): CustomerMatch[] {
  const term = query.trim()
  if (!term) return []

  const pattern = likePattern(term)
  return getDb()
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
    })
    .from(customers)
    .where(or(like(customers.phone, pattern), like(customers.name, pattern)))
    .orderBy(asc(customers.name), asc(customers.phone))
    .limit(8)
    .all()
}

export function upsertCustomer(db: ShopTx, phone: string, name: string): number {
  const existing = db.select().from(customers).where(eq(customers.phone, phone)).get()
  if (existing) {
    if (name && name !== existing.name) {
      db.update(customers)
        .set({ name, updatedAt: new Date() })
        .where(eq(customers.id, existing.id))
        .run()
    }
    return existing.id
  }

  return db
    .insert(customers)
    .values({ phone, name })
    .returning({ id: customers.id })
    .get().id
}

export function registerCustomerHandlers(): void {
  ipcMain.handle(
    IPC.customers.search,
    (_event, payload: unknown): IpcResult<CustomerMatch[]> => {
      const parsed = searchCustomersSchema.safeParse(payload)
      if (!parsed.success) {
        const [issue] = parsed.error.issues
        return ipcFail(issue?.message ?? 'Invalid search.', issue?.path[0]?.toString())
      }

      try {
        return ipcOk(searchCustomers(parsed.data.query))
      } catch (error) {
        console.error('customers:search failed', error)
        return ipcFail('Could not search customers.')
      }
    },
  )
}
