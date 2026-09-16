import { sql } from 'drizzle-orm'
import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import { ipcFail, ipcOk, type IpcResult } from '@shared/ipc-result'
import { isProductImageFileName } from '@shared/product-image'
import { fromMilli, toMilli } from '@shared/quantity'
import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  saveSettingsSchema,
  saveShopLogoSchema,
  type AppSettings,
  type Printer,
} from '@shared/schemas/settings'
import { getDb } from '../db/client'
import { appSettings } from '../db/schema'
import {
  unlinkProductImageIfOrphaned,
  writeProductImageFile,
} from '../files/product-images'

function readStored(): Map<string, string> {
  const rows = getDb().select().from(appSettings).all()
  return new Map(rows.map((row) => [row.key, row.value]))
}

function parseReorderPieces(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_SETTINGS.defaultReorderPieces
  const milli = Number.parseInt(raw, 10)
  if (!Number.isFinite(milli) || milli < 0) return DEFAULT_SETTINGS.defaultReorderPieces
  return Math.round(fromMilli(milli))
}

function parseShopLogo(raw: string | undefined): string {
  if (raw && isProductImageFileName(raw)) return raw
  return DEFAULT_SETTINGS.shopLogo
}

export function loadSettings(): AppSettings {
  const stored = readStored()

  return {
    shopName: stored.get(SETTING_KEYS.shopName) ?? DEFAULT_SETTINGS.shopName,
    shopAddress: stored.get(SETTING_KEYS.shopAddress) ?? DEFAULT_SETTINGS.shopAddress,
    shopPhone: stored.get(SETTING_KEYS.shopPhone) ?? DEFAULT_SETTINGS.shopPhone,
    shopLogo: parseShopLogo(stored.get(SETTING_KEYS.shopLogo)),
    receiptFooter:
      stored.get(SETTING_KEYS.receiptFooter) ?? DEFAULT_SETTINGS.receiptFooter,
    printerName: stored.get(SETTING_KEYS.printerName) ?? DEFAULT_SETTINGS.printerName,
    defaultReorderPieces: parseReorderPieces(
      stored.get(SETTING_KEYS.defaultReorderLevelMilli),
    ),
  }
}

function persistSettings(values: Omit<AppSettings, 'shopLogo'>): void {
  const rows = [
    { key: SETTING_KEYS.shopName, value: values.shopName },
    { key: SETTING_KEYS.shopAddress, value: values.shopAddress },
    { key: SETTING_KEYS.shopPhone, value: values.shopPhone },
    { key: SETTING_KEYS.receiptFooter, value: values.receiptFooter },
    { key: SETTING_KEYS.printerName, value: values.printerName },
    {
      key: SETTING_KEYS.defaultReorderLevelMilli,
      value: String(toMilli(values.defaultReorderPieces)),
    },
  ]

  getDb().transaction((tx) => {
    for (const row of rows) {
      tx.insert(appSettings)
        .values(row)
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: sql`excluded.value` },
        })
        .run()
    }
  })
}

function persistShopLogo(fileName: string): void {
  getDb()
    .insert(appSettings)
    .values({ key: SETTING_KEYS.shopLogo, value: fileName })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: sql`excluded.value` },
    })
    .run()
}

function saveShopLogo(bytes: Uint8Array): AppSettings {
  const previous = loadSettings().shopLogo
  const fileName = writeProductImageFile(bytes)
  persistShopLogo(fileName)
  if (previous && previous !== fileName) {
    unlinkProductImageIfOrphaned(previous)
  }
  return loadSettings()
}

function clearShopLogo(): AppSettings {
  const previous = loadSettings().shopLogo
  persistShopLogo('')
  if (previous) unlinkProductImageIfOrphaned(previous)
  return loadSettings()
}

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.settings.get, (): IpcResult<AppSettings> => {
    try {
      return ipcOk(loadSettings())
    } catch (error) {
      console.error('settings:get failed', error)
      return ipcFail('Could not load settings.')
    }
  })

  ipcMain.handle(
    IPC.settings.save,
    (_event, payload: unknown): IpcResult<AppSettings> => {
      const parsed = saveSettingsSchema.safeParse(payload)

      if (!parsed.success) {
        const [issue] = parsed.error.issues
        return ipcFail(issue?.message ?? 'Invalid settings.', issue?.path[0]?.toString())
      }

      try {
        persistSettings(parsed.data)
        return ipcOk(loadSettings())
      } catch (error) {
        console.error('settings:save failed', error)
        return ipcFail('Could not save settings.')
      }
    },
  )

  ipcMain.handle(
    IPC.settings.saveLogo,
    (_event, payload: unknown): IpcResult<AppSettings> => {
      const parsed = saveShopLogoSchema.safeParse(payload)
      if (!parsed.success) {
        const [issue] = parsed.error.issues
        return ipcFail(issue?.message ?? 'Invalid logo.', issue?.path[0]?.toString())
      }

      try {
        return ipcOk(saveShopLogo(parsed.data.bytes))
      } catch (error) {
        console.error('settings:saveLogo failed', error)
        return ipcFail(
          error instanceof Error ? error.message : 'Could not save the logo.',
        )
      }
    },
  )

  ipcMain.handle(IPC.settings.clearLogo, (): IpcResult<AppSettings> => {
    try {
      return ipcOk(clearShopLogo())
    } catch (error) {
      console.error('settings:clearLogo failed', error)
      return ipcFail('Could not remove the logo.')
    }
  })

  ipcMain.handle(IPC.settings.listPrinters, async (): Promise<IpcResult<Printer[]>> => {
    try {
      const [window] = BrowserWindow.getAllWindows()
      if (!window) return ipcFail('Could not list printers.')

      const printers = await window.webContents.getPrintersAsync()
      return ipcOk(
        printers.map((printer) => ({
          name: printer.name,
          displayName: printer.displayName || printer.name,
        })),
      )
    } catch (error) {
      console.error('settings:listPrinters failed', error)
      return ipcFail('Could not list printers.')
    }
  })
}
