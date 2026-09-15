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
