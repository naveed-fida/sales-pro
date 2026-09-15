import { format } from 'date-fns'
import { formatRs } from '@shared/money'
import { formatQuantity } from '@shared/quantity'
import { variantOptionLabel } from '@shared/variant-label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { usePurchaseQuery } from './use-purchases'

export function PurchaseDetailDialog({
  purchaseId,
  onOpenChange,
}: {
  purchaseId: number | null
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const purchaseQuery = usePurchaseQuery(purchaseId)

  return (
    <Dialog open={purchaseId !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>Purchase</DialogTitle>
          <DialogDescription>
            {purchaseQuery.data
              ? `${purchaseQuery.data.supplierName} · ${format(new Date(purchaseQuery.data.purchasedAt), 'd MMM yyyy')}`
              : 'Received stock and cost.'}
          </DialogDescription>
        </DialogHeader>
        {purchaseQuery.isPending ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : purchaseQuery.isError || !purchaseQuery.data ? (
          <p className="text-sm text-destructive">
            {purchaseQuery.error instanceof Error
              ? purchaseQuery.error.message
              : 'Could not load the purchase.'}
          </p>
        ) : (
          <div className="flex min-h-0 flex-col gap-4">
            <div className="min-h-0 flex-1 overflow-auto rounded-xl ring-1 ring-foreground/10">
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseQuery.data.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p>{variantOptionLabel(item)}</p>
                        <p className="text-xs text-muted-foreground">{item.barcode}</p>
                      </TableCell>
                      <TableCell>
                        {formatQuantity(item.quantityMilli, item.unit)}{' '}
                        {UNIT_LABELS[item.unit].toLowerCase()}
                      </TableCell>
                      <TableCell>{formatRs(item.unitCostRs)}</TableCell>
                      <TableCell>
                        {item.discountRs > 0 ? formatRs(item.discountRs) : '—'}
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
              {purchaseQuery.data.discountRs > 0 ? (
                <p className="text-muted-foreground">
                  Bill discount {formatRs(purchaseQuery.data.discountRs)}
                </p>
              ) : null}
              <p className="font-medium">Total {formatRs(purchaseQuery.data.totalRs)}</p>
              {purchaseQuery.data.note ? (
                <p className="text-muted-foreground">{purchaseQuery.data.note}</p>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
