import { useCallback, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useDebounceValue } from 'usehooks-ts'
import {
  listSalesSchema,
  SALES_PAGE_SIZE,
  saleListStatusFilter,
  type SaleListStatusFilter,
} from '@shared/schemas/sales'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { SaleDetailDialog } from './sale-detail-dialog'
import { SalesTable } from './sales-table'
import { SALE_STATUS_LABELS } from './status-labels'
import { useSalesQuery } from './use-sales'

const STATUS_FILTER_LABELS: Record<SaleListStatusFilter, string> = {
  all: 'All statuses',
  ...SALE_STATUS_LABELS,
}

export function SalesPage(): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [status, setStatus] = useState<SaleListStatusFilter>('all')
  const [debouncedSearch] = useDebounceValue(search, 300)
  const salesQuery = useSalesQuery({
    search: debouncedSearch,
    page,
    from: fromDate,
    to: toDate,
    status,
  })
  const [openId, setOpenId] = useState<number | null>(null)
  const onOpen = useCallback((id: number) => setOpenId(id), [])
  const pageData = salesQuery.data
  const items = pageData?.items ?? []
  const total = pageData?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / SALES_PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * SALES_PAGE_SIZE + 1
  const rangeEnd = Math.min(page * SALES_PAGE_SIZE, total)
  const filtersClear =
    debouncedSearch === '' && fromDate === '' && toDate === '' && status === 'all'
  const emptyShop = total === 0 && filtersClear && !salesQuery.isPending

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
        <p className="text-sm text-muted-foreground">
          Completed bills. Open a row to reprint the receipt.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="Search bill number, name or phone"
        />
        <Select
          value={status}
          onValueChange={(value) => {
            const parsed = listSalesSchema.shape.status.safeParse(value)
            if (!parsed.success) return
            setStatus(parsed.data)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {saleListStatusFilter.map((value) => (
              <SelectItem key={value} value={value}>
                {STATUS_FILTER_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-40"
          type="date"
          value={fromDate}
          onChange={(event) => {
            setFromDate(event.target.value)
            setPage(1)
          }}
          aria-label="From date"
        />
        <Input
          className="w-40"
          type="date"
          value={toDate}
          onChange={(event) => {
            setToDate(event.target.value)
            setPage(1)
          }}
          aria-label="To date"
        />
      </div>

      {salesQuery.isPending && !pageData ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : salesQuery.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-destructive">
            {salesQuery.error instanceof Error
              ? salesQuery.error.message
              : 'Could not load sales.'}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void salesQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : emptyShop ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              No sales yet. Complete a bill on the POS to see it here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden py-0">
          <CardContent className="min-h-0 flex-1 overflow-auto px-0">
            <SalesTable data={items} onOpen={onOpen} />
          </CardContent>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {total === 0
                ? 'No matching sales'
                : `${rangeStart}–${rangeEnd} of ${total}`}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          </div>
        </Card>
      )}

      <SaleDetailDialog
        saleId={openId}
        onOpenChange={(open) => {
          if (!open) setOpenId(null)
        }}
      />
    </div>
  )
}
