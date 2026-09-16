import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/schemas/settings'
import type { SaleRecord } from '@shared/schemas/sales'
import { ReceiptDocument } from './receipt-document'

function signalReady(ok: true): void
function signalReady(ok: false, error: string): void
function signalReady(ok: boolean, error?: string): void {
  window.api.receipt.ready(
    ok ? { ok: true } : { ok: false, error: error ?? 'Could not render the receipt.' },
  )
}

export function ReceiptApp({ saleId }: { saleId: number | null }): React.JSX.Element {
  if (saleId === null) {
    return <p className="p-[3mm] text-[11px] text-black">Missing sale.</p>
  }

  return <ReceiptLoader saleId={saleId} />
}

function ReceiptLoader({ saleId }: { saleId: number }): React.JSX.Element {
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

  useEffect(() => {
    if (!sale || !settings) return
    let cancelled = false
    void document.fonts.ready.then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) signalReady(true)
        })
      })
    })
    return () => {
      cancelled = true
    }
  }, [sale, settings])

  if (error) {
    return <p className="p-[3mm] text-[11px] text-black">{error}</p>
  }

  if (!sale || !settings) {
    return <p className="p-[3mm] text-[11px] text-black">Loading…</p>
  }

  return <ReceiptDocument sale={sale} settings={settings} />
}
