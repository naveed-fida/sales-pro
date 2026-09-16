import { useMemo } from 'react'
import {
  createColumnHelper,
  columnFilteringFeature,
  columnVisibilityFeature,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { formatRs } from '@shared/money'
import type { SaleListItem } from '@shared/schemas/sales'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SALE_STATUS_LABELS } from './status-labels'

const saleTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
  },
})

const columnHelper = createColumnHelper<typeof saleTableFeatures, SaleListItem>()
const EMPTY_SALES: SaleListItem[] = []

function createColumns(): ReturnType<(typeof columnHelper)['columns']> {
  return columnHelper.columns([
    columnHelper.accessor('billNo', {
      header: 'Bill',
      sortFn: 'basic',
    }),
    columnHelper.accessor('createdAt', {
      header: 'Date',
      sortFn: 'basic',
      cell: ({ getValue }) => format(new Date(getValue()), 'd MMM yyyy, h:mm a'),
    }),
    columnHelper.accessor('phone', {
      header: 'Phone',
      sortFn: 'alphanumeric',
      cell: ({ getValue }) => getValue() || '—',
    }),
    columnHelper.accessor('itemCount', {
      header: 'Lines',
      sortFn: 'basic',
    }),
    columnHelper.accessor('totalRs', {
      header: 'Total',
      sortFn: 'basic',
      cell: ({ getValue }) => formatRs(getValue()),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: ({ getValue }) => SALE_STATUS_LABELS[getValue()],
    }),
  ])
}

export function SalesTable({
  data,
  onOpen,
}: {
  data: SaleListItem[]
  onOpen: (id: number) => void
}): React.JSX.Element {
  const columns = useMemo(() => createColumns(), [])
  const table = useTable({
    features: saleTableFeatures,
    columns,
    data: data.length > 0 ? data : EMPTY_SALES,
  })
  const rows = table.getRowModel().rows
  const headers = table.getHeaderGroups()[0]?.headers ?? []

  return (
    <table className="w-full caption-bottom text-sm">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {headers.map((header) => (
            <TableHead key={header.id} className="sticky top-0 z-10 bg-card">
              {header.isPlaceholder ? null : <table.FlexRender header={header} />}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={Math.max(headers.length, 1)} className="h-24 text-center">
              No sales match this search.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer"
              onClick={() => onOpen(row.original.id)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </table>
  )
}
