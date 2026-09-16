import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ReceiptApp } from '@/features/sales/receipt-app'
import '@/index.css'
import '@/receipt.css'

function saleIdFromUrl(): number | null {
  const raw = new URLSearchParams(window.location.search).get('saleId')
  if (!raw) return null
  const id = Number.parseInt(raw, 10)
  return Number.isInteger(id) && id > 0 ? id : null
}

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root is missing from receipt.html')
}

const saleId = saleIdFromUrl()
if (saleId === null) {
  window.api.receipt.ready({ ok: false, error: 'Missing sale.' })
}

createRoot(container).render(
  <StrictMode>
    <ReceiptApp saleId={saleId} />
  </StrictMode>,
)
