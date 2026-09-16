import { ipcMain } from 'electron'
import { CLOCK_WATERMARK_INTERVAL_MS } from '@shared/clock'
import { IPC } from '@shared/ipc'
import { ipcFail, ipcOk, type IpcResult } from '@shared/ipc-result'
import type { ClockStatus } from '@shared/schemas/clock'
import { evaluateClock } from '../clock'

let timer: ReturnType<typeof setInterval> | null = null

export function registerClockHandlers(): void {
  ipcMain.handle(IPC.clock.get, async (): Promise<IpcResult<ClockStatus>> => {
    try {
      return ipcOk(await evaluateClock())
    } catch (error) {
      console.error('clock:get failed', error)
      return ipcFail('Could not check the date and time.')
    }
  })
}

export function startClockWatch(): void {
  if (timer) return
  timer = setInterval(() => {
    void evaluateClock().catch((error) => {
      console.error('clock watch failed', error)
    })
  }, CLOCK_WATERMARK_INTERVAL_MS)
}
