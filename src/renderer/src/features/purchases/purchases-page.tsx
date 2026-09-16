import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
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
import { PurchaseDetailDialog } from './purchase-detail-dialog'
import { PurchasesTable } from './purchases-table'
import { SuppliersDialog } from './suppliers-dialog'
import { usePurchasesQuery } from './use-purchases'
import { useSuppliersQuery } from './use-suppliers'

const ALL = 'all'

export function PurchasesPage(): React.JSX.Element {
  const navigate = useNavigate()
  const purchasesQuery = usePurchasesQuery()
  const suppliersQuery = useSuppliersQuery()
  const [search, setSearch] = useState('')
  const [supplierId, setSupplierId] = useState<number | 'all'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [suppliersOpen, setSuppliersOpen] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const onOpen = useCallback((id: number) => setOpenId(id), [])
  const purchases = purchasesQuery.data ?? []
  const suppliers = suppliersQuery.data ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Purchases</h1>
          <p className="text-sm text-muted-foreground">
            Receive stock from suppliers. Cost is a weighted average on each variant.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setSuppliersOpen(true)}>
            Suppliers
          </Button>
          <Button type="button" onClick={() => navigate('/purchases/new')}>
            <Plus />
            New purchase
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search supplier or note"
        />
        <Select
          value={supplierId === 'all' ? ALL : String(supplierId)}
          onValueChange={(value) =>
            setSupplierId(value === ALL ? 'all' : Number.parseInt(value, 10))
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All suppliers</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={String(supplier.id)}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-40"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          aria-label="From date"
        />
        <Input
          className="w-40"
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          aria-label="To date"
        />
      </div>

      {purchasesQuery.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : purchasesQuery.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-destructive">
            {purchasesQuery.error instanceof Error
              ? purchasesQuery.error.message
              : 'Could not load purchases.'}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void purchasesQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : purchases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <p className="text-sm text-muted-foreground">
              No purchases yet. Add a supplier, then receive a bill to put stock on the
              shelf.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSuppliersOpen(true)}
              >
                Suppliers
              </Button>
              <Button type="button" onClick={() => navigate('/purchases/new')}>
                <Plus />
                New purchase
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden py-0">
          <CardContent className="min-h-0 flex-1 overflow-auto px-0">
            <PurchasesTable
              data={purchases}
              search={search}
              supplierId={supplierId}
              from={from}
              to={to}
              onOpen={onOpen}
            />
          </CardContent>
        </Card>
      )}

      <SuppliersDialog open={suppliersOpen} onOpenChange={setSuppliersOpen} />
      <PurchaseDetailDialog
        purchaseId={openId}
        onOpenChange={(open) => {
          if (!open) setOpenId(null)
        }}
      />
    </div>
  )
}
