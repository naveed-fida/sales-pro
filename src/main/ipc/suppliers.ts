import { asc, eq } from 'drizzle-orm'
import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import { ipcFail, ipcOk, type IpcResult } from '@shared/ipc-result'
import {
  saveSupplierSchema,
  supplierIdSchema,
  type SaveSupplier,
  type Supplier,
} from '@shared/schemas/suppliers'
import { getDb } from '../db/client'
import { purchases, suppliers } from '../db/schema'

class SuppliersError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'SuppliersError'
  }
}

function isForeignKeyConstraint(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  return (error as { code: unknown }).code === 'SQLITE_CONSTRAINT_FOREIGNKEY'
}

function toSupplier(row: {
  id: number
  name: string
  phone: string | null
  address: string | null
  notes: string | null
}): Supplier {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
  }
}

function listSuppliers(): Supplier[] {
  return getDb()
    .select()
    .from(suppliers)
    .orderBy(asc(suppliers.name))
    .all()
    .map(toSupplier)
}

function loadSupplier(id: number): Supplier | undefined {
  const row = getDb().select().from(suppliers).where(eq(suppliers.id, id)).get()
  return row ? toSupplier(row) : undefined
}

function persistSupplier(values: SaveSupplier): Supplier {
  const payload = {
    name: values.name,
    phone: values.phone || null,
    address: values.address || null,
    notes: values.notes || null,
  }

  if (values.id) {
    const updated = getDb()
      .update(suppliers)
      .set(payload)
      .where(eq(suppliers.id, values.id))
      .returning()
      .get()
    if (!updated) throw new SuppliersError('Supplier not found.')
    return toSupplier(updated)
  }

  const inserted = getDb().insert(suppliers).values(payload).returning().get()
  return toSupplier(inserted)
}

function deleteSupplier(id: number): void {
  getDb().transaction((tx) => {
    const row = tx.select().from(suppliers).where(eq(suppliers.id, id)).get()
    if (!row) throw new SuppliersError('Supplier not found.')

    const used = tx
      .select({ id: purchases.id })
      .from(purchases)
      .where(eq(purchases.supplierId, id))
      .get()
    if (used) {
      throw new SuppliersError('This supplier has purchases and cannot be deleted.')
    }

    tx.delete(suppliers).where(eq(suppliers.id, id)).run()
  })
}

export function registerSuppliersHandlers(): void {
  ipcMain.handle(IPC.suppliers.list, (): IpcResult<Supplier[]> => {
    try {
      return ipcOk(listSuppliers())
    } catch (error) {
      console.error('suppliers:list failed', error)
      return ipcFail('Could not load suppliers.')
    }
  })

  ipcMain.handle(IPC.suppliers.get, (_event, payload: unknown): IpcResult<Supplier> => {
    const parsed = supplierIdSchema.safeParse(payload)
    if (!parsed.success) return ipcFail('Invalid supplier.')

    try {
      const supplier = loadSupplier(parsed.data.id)
      if (!supplier) return ipcFail('Supplier not found.')
      return ipcOk(supplier)
    } catch (error) {
      console.error('suppliers:get failed', error)
      return ipcFail('Could not load the supplier.')
    }
  })

  ipcMain.handle(IPC.suppliers.save, (_event, payload: unknown): IpcResult<Supplier> => {
    const parsed = saveSupplierSchema.safeParse(payload)
    if (!parsed.success) {
      const [issue] = parsed.error.issues
      return ipcFail(
        issue?.message ?? 'Invalid supplier.',
        issue?.path.map(String).join('.'),
      )
    }

    try {
      return ipcOk(persistSupplier(parsed.data))
    } catch (error) {
      if (error instanceof SuppliersError) {
        return ipcFail(error.message, error.field)
      }
      console.error('suppliers:save failed', error)
      return ipcFail('Could not save the supplier.')
    }
  })

  ipcMain.handle(IPC.suppliers.delete, (_event, payload: unknown): IpcResult<null> => {
    const parsed = supplierIdSchema.safeParse(payload)
    if (!parsed.success) return ipcFail('Invalid supplier.')

    try {
      deleteSupplier(parsed.data.id)
      return ipcOk(null)
    } catch (error) {
      if (error instanceof SuppliersError) {
        return ipcFail(error.message, error.field)
      }
      if (isForeignKeyConstraint(error)) {
        return ipcFail('This supplier has purchases and cannot be deleted.')
      }
      console.error('suppliers:delete failed', error)
      return ipcFail('Could not delete the supplier.')
    }
  })
}
