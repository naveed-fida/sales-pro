import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/schemas/settings'
import type { ReturnRecord } from '@shared/schemas/returns'
import type { SaleRecord } from '@shared/schemas/sales'
import { ReturnReceiptDocument } from '@/features/returns/return-receipt-document'
import { ReceiptDocument } from './receipt-document'

export type ReceiptTarget = { kind: 'sale'; id: number } | { kind: 'return'; id: number }

function signalReady(ok: true): void
function signalReady(ok: false, error: string): void
function signalReady(ok: boolean, error?: string): void {
  window.api.receipt.ready(
    ok ? { ok: true } : { ok: false, error: error ?? 'Could not render the receipt.' },
  )
}

export function ReceiptApp({
  target,
}: {
  target: ReceiptTarget | null
}): React.JSX.Element {
  if (target === null) {
    return <p className="p-[3mm] text-[11px] text-black">Missing receipt.</p>
  }

  if (target.kind === 'return') {
    return <ReturnReceiptLoader returnId={target.id} />
  }

  return <SaleReceiptLoader saleId={target.id} />
}

function SaleReceiptLoader({ saleId }: { saleId: number }): React.JSX.Element {
  const [sale, setSale] = useState<SaleRecord | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      const [saleResult, settingsResult] = await Promise.all([
        window.api.sales.get(saleId),
        window.api.settings.get(),
      ])
      if (cancelled) return
      if (!saleResult.ok) {
        setError(saleResult.error.message)
        signalReady(false, saleResult.error.message)
        return
      }
      if (!settingsResult.ok) {
        setError(settingsResult.error.message)
        signalReady(false, settingsResult.error.message)
        return
      }
      setSale(saleResult.data)
      setSettings(settingsResult.data)
    }

    void load().catch((caught: unknown) => {
      if (cancelled) return
      const message =
        caught instanceof Error ? caught.message : 'Could not load the receipt.'
      setError(message)
      signalReady(false, message)
    })

    return () => {
      cancelled = true
    }
  }, [saleId])

  useSignalReady(Boolean(sale && settings))

  if (error) {
    return <p className="p-[3mm] text-[11px] text-black">{error}</p>
  }

  if (!sale || !settings) {
    return <p className="p-[3mm] text-[11px] text-black">Loading…</p>
  }

  return <ReceiptDocument sale={sale} settings={settings} />
}

function ReturnReceiptLoader({ returnId }: { returnId: number }): React.JSX.Element {
  const [record, setRecord] = useState<ReturnRecord | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      const [returnResult, settingsResult] = await Promise.all([
        window.api.returns.get(returnId),
        window.api.settings.get(),
      ])
      if (cancelled) return
      if (!returnResult.ok) {
        setError(returnResult.error.message)
        signalReady(false, returnResult.error.message)
        return
      }
      if (!settingsResult.ok) {
        setError(settingsResult.error.message)
        signalReady(false, settingsResult.error.message)
        return
      }
      setRecord(returnResult.data)
      setSettings(settingsResult.data)
    }

    void load().catch((caught: unknown) => {
      if (cancelled) return
      const message =
        caught instanceof Error ? caught.message : 'Could not load the receipt.'
      setError(message)
      signalReady(false, message)
    })

    return () => {
      cancelled = true
    }
  }, [returnId])

  useSignalReady(Boolean(record && settings))

  if (error) {
    return <p className="p-[3mm] text-[11px] text-black">{error}</p>
  }

  if (!record || !settings) {
    return <p className="p-[3mm] text-[11px] text-black">Loading…</p>
  }

  return <ReturnReceiptDocument record={record} settings={settings} />
}

function waitForImages(): Promise<void> {
  return Promise.all(
    Array.from(document.images, (image) => {
      if (image.complete) return Promise.resolve()
      return new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
      })
    }),
  ).then(() => undefined)
}

function useSignalReady(ready: boolean): void {
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    void document.fonts.ready
      .then(() => waitForImages())
      .then(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!cancelled) signalReady(true)
          })
        })
      })
    return () => {
      cancelled = true
    }
  }, [ready])
}
