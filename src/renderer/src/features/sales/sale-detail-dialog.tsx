import { useState } from 'react'
import { format } from 'date-fns'
import { Printer } from 'lucide-react'
import { toast } from 'sonner'
import { formatRs } from '@shared/money'
import { formatQuantity } from '@shared/quantity'
import { variantOptionLabel } from '@shared/variant-label'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UNIT_LABELS } from '@/features/products/unit-labels'
import { SALE_STATUS_LABELS } from './status-labels'
import { useSaleQuery } from './use-sales'

export function SaleDetailDialog({
  saleId,
  onOpenChange,
}: {
  saleId: number | null
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const saleQuery = useSaleQuery(saleId)
  const [printing, setPrinting] = useState(false)

  async function reprint(): Promise<void> {
    if (saleId === null) return
    setPrinting(true)
    const result = await window.api.sales.print(saleId)
    setPrinting(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success('Receipt sent to the printer')
  }

  return (
    <Dialog open={saleId !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>
            {saleQuery.data ? `Bill ${saleQuery.data.billNo}` : 'Sale'}
          </DialogTitle>
          <DialogDescription>
            {saleQuery.data
              ? `${format(new Date(saleQuery.data.createdAt), 'd MMM yyyy, h:mm a')} · ${SALE_STATUS_LABELS[saleQuery.data.status]}`
              : 'Completed bill.'}
          </DialogDescription>
        </DialogHeader>
        {saleQuery.isPending ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : saleQuery.isError || !saleQuery.data ? (
          <p className="text-sm text-destructive">
            {saleQuery.error instanceof Error
              ? saleQuery.error.message
              : 'Could not load the sale.'}
          </p>
        ) : (
          <div className="flex min-h-0 flex-col gap-4">
            <div className="min-h-0 flex-1 overflow-auto rounded-xl ring-1 ring-foreground/10">
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saleQuery.data.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p>{variantOptionLabel(item)}</p>
                        <p className="text-xs text-muted-foreground">{item.barcode}</p>
                      </TableCell>
                      <TableCell>
                        {formatQuantity(item.quantityMilli, item.unit)}{' '}
                        {UNIT_LABELS[item.unit].toLowerCase()}
                      </TableCell>
                      <TableCell>{formatRs(item.unitPriceRs)}</TableCell>
                      <TableCell>
                        {item.lineDiscountRs > 0 ? formatRs(item.lineDiscountRs) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatRs(item.lineTotalRs)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
            <div className="flex flex-col items-end gap-1 text-sm">
              {saleQuery.data.customerName ? (
                <p className="text-muted-foreground">{saleQuery.data.customerName}</p>
              ) : null}
              {saleQuery.data.phone ? (
                <p className="text-muted-foreground">Phone {saleQuery.data.phone}</p>
              ) : null}
              {saleQuery.data.discountRs > 0 ? (
                <p className="text-muted-foreground">
                  Bill discount {formatRs(saleQuery.data.discountRs)}
                </p>
              ) : null}
              <p className="font-medium">Total {formatRs(saleQuery.data.totalRs)}</p>
              <p className="text-muted-foreground">
                Cash {formatRs(saleQuery.data.tenderedRs)} · change{' '}
                {formatRs(saleQuery.data.changeRs)}
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={printing}
                onClick={() => void reprint()}
              >
                <Printer />
                {printing ? 'Printing…' : 'Print'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
