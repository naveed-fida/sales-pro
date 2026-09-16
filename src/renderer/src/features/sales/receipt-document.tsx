import { format } from 'date-fns'
import { formatRs } from '@shared/money'
import { formatQuantity } from '@shared/quantity'
import type { AppSettings } from '@shared/schemas/settings'
import type { SaleRecord } from '@shared/schemas/sales'
import { variantOptionLabel } from '@shared/variant-label'
import { UNIT_LABELS } from '@/features/products/unit-labels'
import { ReceiptFrame } from './receipt-frame'

export function ReceiptDocument({
  sale,
  settings,
}: {
  sale: SaleRecord
  settings: AppSettings
}): React.JSX.Element {
  const subtotal = sale.totalRs + sale.discountRs

  return (
    <ReceiptFrame settings={settings}>
      <p>Bill {sale.billNo}</p>
      <p>{format(new Date(sale.createdAt), 'd MMM yyyy, h:mm a')}</p>
      {sale.customerName ? <p>{sale.customerName}</p> : null}
      {sale.phone ? <p>Phone {sale.phone}</p> : null}

      <div className="my-2 border-t border-dashed border-black" />

      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1">
        <span className="font-medium">Item</span>
        <span className="text-right font-medium">Qty</span>
        <span className="text-right font-medium">Amt</span>
        {sale.items.map((item) => (
          <div key={item.id} className="contents">
            <span>
              {variantOptionLabel(item)}
              {item.lineDiscountRs > 0 ? (
                <span className="block text-[10px]">
                  less {formatRs(item.lineDiscountRs)}
                </span>
              ) : null}
            </span>
            <span className="text-right">
              {formatQuantity(item.quantityMilli, item.unit)}
              {item.unit === 'piece' ? '' : ` ${UNIT_LABELS[item.unit].toLowerCase()}`}
            </span>
            <span className="text-right">{formatRs(item.lineTotalRs)}</span>
          </div>
        ))}
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatRs(subtotal)}</span>
        </div>
        {sale.discountRs > 0 ? (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>{formatRs(sale.discountRs)}</span>
          </div>
        ) : null}
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatRs(sale.totalRs)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cash</span>
          <span>{formatRs(sale.tenderedRs)}</span>
        </div>
        <div className="flex justify-between">
          <span>Change</span>
          <span>{formatRs(sale.changeRs)}</span>
        </div>
      </div>
    </ReceiptFrame>
  )
}
