import type { ElectronAPI } from '@electron-toolkit/preload'

// The renderer-facing surface. Feature APIs are added here alongside the
// contextBridge exposure in index.ts, with payload types derived from the
// zod schemas in src/shared so there is one source of truth.
export interface Api {}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
