import type { ElectronAPI } from '@electron-toolkit/preload'
import type { IpcResult } from '@shared/ipc-result'
import type { AppSettings, Printer, SaveSettingsInput } from '@shared/schemas/settings'

export type Api = {
  platform: string
  settings: {
    get: () => Promise<IpcResult<AppSettings>>
    save: (input: SaveSettingsInput) => Promise<IpcResult<AppSettings>>
    listPrinters: () => Promise<IpcResult<Printer[]>>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
