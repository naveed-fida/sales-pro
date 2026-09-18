import { join } from 'node:path'
import { BrowserWindow, ipcMain, type IpcMainEvent, type NativeImage } from 'electron'
import { is } from '@electron-toolkit/utils'
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder'
import { IPC } from '@shared/ipc'
import { receiptReadySchema } from '@shared/schemas/sales'
import { printRaw } from './raw-print'

/** 80mm printers print 576 dots across at 203 DPI (72mm printable). */
const RECEIPT_WIDTH_DOTS = 576
const RECEIPT_READY_MS = 15_000
const CSS_WIDTH_PX = (80 * 96) / 25.4

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

async function receiptCssSize(
  window: BrowserWindow,
): Promise<{ width: number; height: number }> {
  const size = (await window.webContents.executeJavaScript(
    `({
      width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, 1),
      height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 1),
    })`,
  )) as { width: unknown; height: unknown }
  const width = Number(size.width)
  const height = Number(size.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('Could not measure the receipt.')
  }
  return { width, height }
}

async function waitForPaint(window: BrowserWindow): Promise<void> {
  await window.webContents.executeJavaScript(
    'new Promise((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())) })',
  )
}

function roundToDots(value: number): number {
  return Math.max(8, Math.ceil(value / 8) * 8)
}

function bgraToRgba(bgra: Buffer, width: number, height: number): Uint8ClampedArray {
  const pixels = width * height
  const rgba = new Uint8ClampedArray(pixels * 4)
  for (let i = 0; i < pixels; i += 1) {
    const offset = i * 4
    rgba[offset] = bgra[offset + 2] ?? 0
    rgba[offset + 1] = bgra[offset + 1] ?? 0
    rgba[offset + 2] = bgra[offset] ?? 0
    rgba[offset + 3] = bgra[offset + 3] ?? 255
  }
  return rgba
}

function sliceRgba(
  data: Uint8ClampedArray,
  width: number,
  sourceHeight: number,
  top: number,
  bandHeight: number,
): Uint8ClampedArray {
  const slice = new Uint8ClampedArray(width * bandHeight * 4)
  slice.fill(255)
  const copyHeight = Math.min(bandHeight, Math.max(0, sourceHeight - top))
  slice.set(data.subarray(top * width * 4, (top + copyHeight) * width * 4))
  return slice
}

/** Chromium silent print wraps the slip in A4; send a 203 DPI raster as ESC/POS instead. */
function encodeReceipt(image: NativeImage): Uint8Array {
  const { width, height } = image.getSize()
  if (width < 8 || height < 8) {
    throw new Error('The receipt image was empty.')
  }

  const paddedHeight = roundToDots(height)
  const rgba = bgraToRgba(image.toBitmap(), width, height)
  const data =
    paddedHeight === height ? rgba : sliceRgba(rgba, width, height, 0, paddedHeight)

  return new ReceiptPrinterEncoder({
    language: 'esc-pos',
    columns: 48,
    imageMode: 'raster',
    feedBeforeCut: 4,
  })
    .initialize()
    .image(
      { data, width, height: paddedHeight },
      {
        width: RECEIPT_WIDTH_DOTS,
        height: paddedHeight,
        algorithm: 'threshold',
        mode: 'raster',
      },
    )
    .cut()
    .encode()
}

async function captureReceipt(window: BrowserWindow): Promise<NativeImage> {
  const size = await receiptCssSize(window)
  const zoom = RECEIPT_WIDTH_DOTS / (size.width || CSS_WIDTH_PX)
  await window.webContents.insertCSS(`
    html { zoom: ${zoom}; }
    html, body { overflow: hidden !important; }
  `)
  window.setContentSize(Math.ceil(size.width * zoom), Math.ceil(size.height * zoom))
  await waitForPaint(window)

  const captured = await window.webContents.capturePage()
  const capturedSize = captured.getSize()
  if (capturedSize.width < 8 || capturedSize.height < 8) {
    throw new Error('Could not capture the receipt.')
  }

  return captured.resize({ width: RECEIPT_WIDTH_DOTS, quality: 'best' })
}

export async function printReceipt(
  query: ReceiptQuery,
  printerName: string,
): Promise<void> {
  const window = new BrowserWindow({
    width: Math.round(CSS_WIDTH_PX),
    height: 640,
    show: false,
    frame: false,
    enableLargerThanScreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      offscreen: true,
      backgroundThrottling: false,
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

    const image = await captureReceipt(window)
    await printRaw(printerName, encodeReceipt(image))
  } finally {
    if (!window.isDestroyed()) window.close()
  }
}
