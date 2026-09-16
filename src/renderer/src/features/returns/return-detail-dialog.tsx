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
import { useReturnQuery } from './use-returns'

export function ReturnDetailDialog({
  returnId,
  onOpenChange,
}: {
  returnId: number | null
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const returnQuery = useReturnQuery(returnId)
  const [printing, setPrinting] = useState(false)

  async function reprint(): Promise<void> {
    if (returnId === null) return
    setPrinting(true)
    const result = await window.api.returns.print(returnId)
    setPrinting(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success('Receipt sent to the printer')
  }

  return (
    <Dialog open={returnId !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>
            {returnQuery.data
              ? `${returnQuery.data.exchangeItems.length > 0 ? 'Exchange' : 'Return'} on bill ${returnQuery.data.billNo}`
              : 'Return'}
          </DialogTitle>
          <DialogDescription>
            {returnQuery.data
              ? format(new Date(returnQuery.data.createdAt), 'd MMM yyyy, h:mm a')
              : 'Items put back on the shelf.'}
          </DialogDescription>
        </DialogHeader>
        {returnQuery.isPending ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : returnQuery.isError || !returnQuery.data ? (
          <p className="text-sm text-destructive">
            {returnQuery.error instanceof Error
              ? returnQuery.error.message
              : 'Could not load the return.'}
          </p>
        ) : (
          <div className="flex min-h-0 flex-col gap-4">
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="flex flex-col gap-4">
                <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Returned</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead className="text-right">Refund</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnQuery.data.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p>{variantOptionLabel(item)}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.barcode}
                            </p>
                          </TableCell>
                          <TableCell>
                            {formatQuantity(item.quantityMilli, item.unit)}{' '}
                            {UNIT_LABELS[item.unit].toLowerCase()}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatRs(item.lineTotalRs)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </table>
                </div>
                {returnQuery.data.exchangeItems.length > 0 ? (
                  <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Taken</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returnQuery.data.exchangeItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <p>{variantOptionLabel(item)}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.barcode}
                              </p>
                            </TableCell>
                            <TableCell>
                              {formatQuantity(item.quantityMilli, item.unit)}{' '}
                              {UNIT_LABELS[item.unit].toLowerCase()}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatRs(item.lineTotalRs)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </table>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 text-sm">
              {returnQuery.data.phone ? (
                <p className="text-muted-foreground">Phone {returnQuery.data.phone}</p>
              ) : null}
              <p>Returned {formatRs(returnQuery.data.totalRs)}</p>
              {returnQuery.data.exchangeTotalRs > 0 ? (
                <p>Taken {formatRs(returnQuery.data.exchangeTotalRs)}</p>
              ) : null}
              {returnQuery.data.exchangeTotalRs > returnQuery.data.totalRs ? (
                <>
                  <p className="font-medium">
                    Due{' '}
                    {formatRs(
                      returnQuery.data.exchangeTotalRs - returnQuery.data.totalRs,
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    Cash {formatRs(returnQuery.data.tenderedRs)} · change{' '}
                    {formatRs(returnQuery.data.changeRs)}
                  </p>
                </>
              ) : (
                <p className="font-medium">
                  Refund{' '}
                  {formatRs(returnQuery.data.totalRs - returnQuery.data.exchangeTotalRs)}
                </p>
              )}
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
