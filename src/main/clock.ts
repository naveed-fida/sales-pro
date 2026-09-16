import { eq, sql } from 'drizzle-orm'
import { BrowserWindow } from 'electron'
import {
  CLOCK_ROLLBACK_SLACK_MS,
  CLOCK_SKEW_LIMIT_MS,
  CLOCK_TRUST_TIMEOUT_MS,
} from '@shared/clock'
import { IPC } from '@shared/ipc'
import type { ClockStatus } from '@shared/schemas/clock'
import { getDb } from './db/client'
import { appSettings } from './db/schema'

const WATERMARK_KEY = 'clockWatermark'

const TRUST_URLS = ['https://www.cloudflare.com', 'https://www.google.com'] as const

let lastStatus: ClockStatus | null = null

function readWatermarkMs(): number | null {
  const row = getDb()
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, WATERMARK_KEY))
    .get()
  if (!row) return null
  const seconds = Number.parseInt(row.value, 10)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return seconds * 1000
}

function writeWatermarkMs(ms: number): void {
  const value = String(Math.floor(ms / 1000))
  getDb()
    .insert(appSettings)
    .values({ key: WATERMARK_KEY, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: sql`excluded.value` },
    })
    .run()
}

async function fetchTrustedMs(): Promise<number | null> {
  for (const url of TRUST_URLS) {
    for (const method of ['HEAD', 'GET'] as const) {
      try {
        const response = await fetch(url, {
          method,
          redirect: 'follow',
          signal: AbortSignal.timeout(CLOCK_TRUST_TIMEOUT_MS),
        })
        const header = response.headers.get('date')
        if (!header) continue
        const parsed = Date.parse(header)
        if (Number.isFinite(parsed)) return parsed
      } catch {
        continue
      }
    }
  }

  return null
}

function broadcast(status: ClockStatus): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IPC.clock.changed, status)
  }
}

export async function evaluateClock(): Promise<ClockStatus> {
  const localMs = Date.now()
  const watermarkMs = readWatermarkMs()

  if (watermarkMs !== null && localMs + CLOCK_ROLLBACK_SLACK_MS < watermarkMs) {
    const status: ClockStatus = {
      ok: false,
      reason: 'rollback',
      localMs,
      watermarkMs,
    }
    lastStatus = status
    broadcast(status)
    return status
  }

  const trustedMs = await fetchTrustedMs()
  if (trustedMs !== null && Math.abs(localMs - trustedMs) > CLOCK_SKEW_LIMIT_MS) {
    const status: ClockStatus = {
      ok: false,
      reason: 'skew',
      localMs,
      trustedMs,
    }
    lastStatus = status
    broadcast(status)
    return status
  }

  writeWatermarkMs(localMs)
  const status: ClockStatus = {
    ok: true,
    source: trustedMs === null ? 'offline' : 'network',
    localMs,
  }
  lastStatus = status
  broadcast(status)
  return status
}

export function persistWatermarkOnQuit(): void {
  if (lastStatus !== null && !lastStatus.ok) return
  const localMs = Date.now()
  const watermarkMs = readWatermarkMs()
  if (watermarkMs !== null && localMs + CLOCK_ROLLBACK_SLACK_MS < watermarkMs) return
  try {
    writeWatermarkMs(localMs)
  } catch (error) {
    console.error('clock watermark on quit failed', error)
  }
}
