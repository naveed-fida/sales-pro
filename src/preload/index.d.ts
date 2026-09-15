import type { ElectronAPI } from '@electron-toolkit/preload'

// The renderer-facing surface. Payload and return types are derived from the
// zod schemas in src/shared, so the contract cannot drift between the two
// sides. Feature methods are added as each slice lands.
export type Api = {
  platform: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
