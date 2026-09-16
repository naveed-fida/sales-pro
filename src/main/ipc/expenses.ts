import { desc, eq } from 'drizzle-orm'
import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import { ipcFail, ipcOk, type IpcResult } from '@shared/ipc-result'
import {
  expenseIdSchema,
  saveExpenseSchema,
  type Expense,
  type SaveExpense,
} from '@shared/schemas/expenses'
import { getDb } from '../db/client'
import { expenses } from '../db/schema'

class ExpensesError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'ExpensesError'
  }
}

function toExpense(row: {
  id: number
  category: string
  amountRs: number
  incurredAt: Date
  note: string | null
}): Expense {
  return {
    id: row.id,
    category: row.category,
    amountRs: row.amountRs,
    incurredAt: row.incurredAt,
    note: row.note,
  }
}

function listExpenses(): Expense[] {
  return getDb()
    .select()
    .from(expenses)
    .orderBy(desc(expenses.incurredAt), desc(expenses.id))
    .all()
    .map(toExpense)
}

function persistExpense(values: SaveExpense): Expense {
  const payload = {
    category: values.category,
    amountRs: values.amountRs,
    incurredAt: values.incurredAt,
    note: values.note || null,
  }

  if (values.id) {
    const updated = getDb()
      .update(expenses)
      .set(payload)
      .where(eq(expenses.id, values.id))
      .returning()
      .get()
    if (!updated) throw new ExpensesError('Expense not found.')
    return toExpense(updated)
  }

  const inserted = getDb().insert(expenses).values(payload).returning().get()
  return toExpense(inserted)
}

function deleteExpense(id: number): void {
  const deleted = getDb().delete(expenses).where(eq(expenses.id, id)).returning().get()
  if (!deleted) throw new ExpensesError('Expense not found.')
}

export function registerExpensesHandlers(): void {
  ipcMain.handle(IPC.expenses.list, (): IpcResult<Expense[]> => {
    try {
      return ipcOk(listExpenses())
    } catch (error) {
      console.error('expenses:list failed', error)
      return ipcFail('Could not load expenses.')
    }
  })

  ipcMain.handle(IPC.expenses.save, (_event, payload: unknown): IpcResult<Expense> => {
    const parsed = saveExpenseSchema.safeParse(payload)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return ipcFail(
        issue?.message ?? 'Invalid expense.',
        issue?.path.map(String).join('.'),
      )
    }

    try {
      return ipcOk(persistExpense(parsed.data))
    } catch (error) {
      if (error instanceof ExpensesError) return ipcFail(error.message, error.field)
      console.error('expenses:save failed', error)
      return ipcFail('Could not save the expense.')
    }
  })

  ipcMain.handle(IPC.expenses.delete, (_event, payload: unknown): IpcResult<null> => {
    const parsed = expenseIdSchema.safeParse(payload)
    if (!parsed.success) return ipcFail('Invalid expense.')

    try {
      deleteExpense(parsed.data.id)
      return ipcOk(null)
    } catch (error) {
      if (error instanceof ExpensesError) return ipcFail(error.message, error.field)
      console.error('expenses:delete failed', error)
      return ipcFail('Could not delete the expense.')
    }
  })
}
