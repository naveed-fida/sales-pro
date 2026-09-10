import { z } from 'zod'

/**
 * Single source of truth for the main/renderer boundary. Channel names are
 * constants so no call site can typo a string literal, and every payload has a
 * schema that the main process parses before touching the database.
 */
export const IPC = {
  customers: {
    list: 'customers:list',
    create: 'customers:create',
  },
} as const

export const customerSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  email: z.string(),
  // Drizzle returns a Date for timestamp columns, and Electron's structured
  // clone preserves it across IPC, so no serialisation dance is needed.
  createdAt: z.date(),
})

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Enter a valid email address'))
    .describe('Stored lowercase so uniqueness is case-insensitive'),
})

export const listCustomersSchema = z.void()

export type Customer = z.infer<typeof customerSchema>
export type CreateCustomerInput = z.input<typeof createCustomerSchema>

/**
 * Handlers resolve rather than reject. An ipcMain.handle rejection reaches the
 * renderer as an opaque "Error invoking remote method ..." string, which is
 * useless for showing a field-level message on a form. An explicit envelope
 * keeps failures structured and typed.
 */
export type IpcFailure = {
  message: string
  /** Names the offending input so a form can attach the message to it. */
  field?: string
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcFailure }

export function ipcOk<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

export function ipcFail<T = never>(message: string, field?: string): IpcResult<T> {
  return { ok: false, error: field ? { message, field } : { message } }
}
