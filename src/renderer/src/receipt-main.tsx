import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ReceiptApp, type ReceiptTarget } from '@/features/sales/receipt-app'
import '@/index.css'
import '@/receipt.css'

function idFromParam(raw: string | null): number | null {
  if (!raw) return null
  const id = Number.parseInt(raw, 10)
  return Number.isInteger(id) && id > 0 ? id : null
}

function targetFromUrl(): ReceiptTarget | null {
  const params = new URLSearchParams(window.location.search)
  const saleId = idFromParam(params.get('saleId'))
  if (saleId !== null) return { kind: 'sale', id: saleId }
  const returnId = idFromParam(params.get('returnId'))
  if (returnId !== null) return { kind: 'return', id: returnId }
  return null
}

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root is missing from receipt.html')
}

const target = targetFromUrl()
if (target === null) {
  window.api.receipt.ready({ ok: false, error: 'Missing receipt.' })
}

createRoot(container).render(
  <StrictMode>
    <ReceiptApp target={target} />
  </StrictMode>,
)
