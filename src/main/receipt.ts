import { join } from 'node:path'
import { BrowserWindow, ipcMain, type IpcMainEvent } from 'electron'
import { is } from '@electron-toolkit/utils'
import { IPC } from '@shared/ipc'
import { receiptReadySchema } from '@shared/schemas/sales'

const RECEIPT_WIDTH_MICRONS = 80 * 1000
const MICRONS_PER_CSS_PX = 25400 / 96
const RECEIPT_READY_MS = 15_000

export type ReceiptQuery = { saleId: number } | { returnId: number }

function queryEntries(query: ReceiptQuery): Record<string, string> {
  return 'saleId' in query
    ? { saleId: String(query.saleId) }
    : { returnId: String(query.returnId) }
}

function receiptUrl(
  query: ReceiptQuery,
): { type: 'url'; value: string } | { type: 'file'; value: string } {
  const search = new URLSearchParams(queryEntries(query)).toString()
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const base = process.env['ELECTRON_RENDERER_URL'].replace(/\/$/, '')
    return { type: 'url', value: `${base}/receipt.html?${search}` }
  }

  return { type: 'file', value: join(__dirname, '../renderer/receipt.html') }
}

function waitForReceipt(window: BrowserWindow): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('The receipt did not finish loading.'))
    }, RECEIPT_READY_MS)

    const onReady = (event: IpcMainEvent, payload: unknown): void => {
      if (event.sender !== window.webContents) return
      cleanup()
      const parsed = receiptReadySchema.safeParse(payload)
      if (!parsed.success || !parsed.data.ok) {
        reject(
          new Error(
            parsed.success && !parsed.data.ok
              ? parsed.data.error
              : 'Could not render the receipt.',
          ),
        )
        return
      }
      resolve()
    }

    const onClosed = (): void => {
      cleanup()
      reject(new Error('Receipt window closed.'))
    }

    function cleanup(): void {
      clearTimeout(timer)
      ipcMain.removeListener(IPC.receipt.ready, onReady)
      window.removeListener('closed', onClosed)
    }

    ipcMain.on(IPC.receipt.ready, onReady)
    window.on('closed', onClosed)
  })
}

function printWindow(
  window: BrowserWindow,
  printerName: string,
  heightMicrons: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    window.webContents.print(
      {
        silent: true,
        ...(printerName ? { deviceName: printerName } : {}),
        margins: { marginType: 'none' },
        pageSize: { width: RECEIPT_WIDTH_MICRONS, height: heightMicrons },
        printBackground: false,
      },
      (success, failureReason) => {
        if (success) {
          resolve()
          return
        }
        reject(
          new Error(
            failureReason && failureReason !== 'cancelled'
              ? failureReason
              : 'Could not print the receipt. Check the printer in Settings.',
          ),
        )
      },
    )
  })
}

export async function printReceipt(
  query: ReceiptQuery,
  printerName: string,
): Promise<void> {
  const window = new BrowserWindow({
    width: 302,
    height: 640,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  try {
    const target = receiptUrl(query)
    const ready = waitForReceipt(window)
    if (target.type === 'url') {
      await window.loadURL(target.value)
    } else {
      await window.loadFile(target.value, { query: queryEntries(query) })
    }
    await ready

    const printers = await window.webContents.getPrintersAsync()
    if (printers.length === 0) {
      throw new Error('No printer found. Pick one in Settings.')
    }
    if (printerName && !printers.some((printer) => printer.name === printerName)) {
      throw new Error('That printer is not available. Pick another in Settings.')
    }

    const heightPx = await window.webContents.executeJavaScript(
      'Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 1)',
    )
    const heightMicrons = Math.max(
      RECEIPT_WIDTH_MICRONS,
      Math.ceil(Number(heightPx) * MICRONS_PER_CSS_PX),
    )
    await printWindow(window, printerName, heightMicrons)
  } finally {
    if (!window.isDestroyed()) window.close()
  }
}
