import { format } from 'date-fns'
import { formatRs } from '@shared/money'
import { formatQuantity } from '@shared/quantity'
import type { AppSettings } from '@shared/schemas/settings'
import type { ReturnRecord } from '@shared/schemas/returns'
import { variantOptionLabel } from '@shared/variant-label'
import { UNIT_LABELS } from '@/features/products/unit-labels'
import { ReceiptFrame } from '@/features/sales/receipt-frame'

function ReceiptLines({
  items,
}: {
  items: ReturnRecord['items'] | ReturnRecord['exchangeItems']
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1">
      <span className="font-medium">Item</span>
      <span className="text-right font-medium">Qty</span>
      <span className="text-right font-medium">Amt</span>
      {items.map((item) => (
        <div key={item.id} className="contents">
          <span>{variantOptionLabel(item)}</span>
          <span className="text-right">
            {formatQuantity(item.quantityMilli, item.unit)}
            {item.unit === 'piece' ? '' : ` ${UNIT_LABELS[item.unit].toLowerCase()}`}
          </span>
          <span className="text-right">{formatRs(item.lineTotalRs)}</span>
        </div>
      ))}
    </div>
  )
}

export function ReturnReceiptDocument({
  record,
  settings,
}: {
  record: ReturnRecord
  settings: AppSettings
}): React.JSX.Element {
  const exchanging = record.exchangeItems.length > 0
  const dueRs = Math.max(0, record.exchangeTotalRs - record.totalRs)
  const refundRs = Math.max(0, record.totalRs - record.exchangeTotalRs)

  return (
    <ReceiptFrame settings={settings}>
      <p className="text-center font-semibold">{exchanging ? 'Exchange' : 'Return'}</p>
      <p>Bill {record.billNo}</p>
      <p>{format(new Date(record.createdAt), 'd MMM yyyy, h:mm a')}</p>
      {record.phone ? <p>Phone {record.phone}</p> : null}

      <div className="my-2 border-t border-dashed border-black" />
      {exchanging ? <p className="mb-1 font-medium">Returned</p> : null}
      <ReceiptLines items={record.items} />

      {exchanging ? (
        <>
          <div className="my-2 border-t border-dashed border-black" />
          <p className="mb-1 font-medium">Taken</p>
          <ReceiptLines items={record.exchangeItems} />
        </>
      ) : null}

      <div className="my-2 border-t border-dashed border-black" />

      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between">
          <span>Returned</span>
          <span>{formatRs(record.totalRs)}</span>
        </div>
        {exchanging ? (
          <div className="flex justify-between">
            <span>Taken</span>
            <span>{formatRs(record.exchangeTotalRs)}</span>
          </div>
        ) : null}
        {dueRs > 0 ? (
          <>
            <div className="flex justify-between font-semibold">
              <span>Due</span>
              <span>{formatRs(dueRs)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cash</span>
              <span>{formatRs(record.tenderedRs)}</span>
            </div>
            <div className="flex justify-between">
              <span>Change</span>
              <span>{formatRs(record.changeRs)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between font-semibold">
            <span>Refund</span>
            <span>{formatRs(refundRs)}</span>
          </div>
        )}
      </div>
    </ReceiptFrame>
  )
}
