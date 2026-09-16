import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { ReturnListItem } from '@shared/schemas/returns'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ReturnDetailDialog } from './return-detail-dialog'
import { ReturnsTable } from './returns-table'
import { useReturnsQuery } from './use-returns'

const EMPTY_RETURNS: ReturnListItem[] = []

export function ReturnsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const returnsQuery = useReturnsQuery()
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const onOpen = useCallback((id: number) => setOpenId(id), [])
  const returns = returnsQuery.data ?? EMPTY_RETURNS

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Returns</h1>
          <p className="text-sm text-muted-foreground">
            Refund or exchange sold items and put stock back on the shelf. Open a row to
            reprint the slip.
          </p>
        </div>
        <Button type="button" onClick={() => navigate('/returns/new')}>
          <Plus />
          New return
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search bill number or phone"
        />
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

      {returnsQuery.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : returnsQuery.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-destructive">
            {returnsQuery.error instanceof Error
              ? returnsQuery.error.message
              : 'Could not load returns.'}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void returnsQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : returns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <p className="text-sm text-muted-foreground">
              No returns yet. Load a completed bill to refund or exchange items.
            </p>
            <Button type="button" onClick={() => navigate('/returns/new')}>
              <Plus />
              New return
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden py-0">
          <CardContent className="min-h-0 flex-1 overflow-auto px-0">
            <ReturnsTable
              data={returns}
              search={search}
              from={from}
              to={to}
              onOpen={onOpen}
            />
          </CardContent>
        </Card>
      )}

      <ReturnDetailDialog
        returnId={openId}
        onOpenChange={(open) => {
          if (!open) setOpenId(null)
        }}
      />
    </div>
  )
}
