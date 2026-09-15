import { useMemo } from 'react'
import {
  createColumnHelper,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { formatRs } from '@shared/money'
import type { PurchaseListItem } from '@shared/schemas/purchases'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const purchaseTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
  },
})

const columnHelper = createColumnHelper<typeof purchaseTableFeatures, PurchaseListItem>()
const EMPTY_PURCHASES: PurchaseListItem[] = []

function createColumns(): ReturnType<(typeof columnHelper)['columns']> {
  return columnHelper.columns([
    columnHelper.accessor('purchasedAt', {
      header: 'Date',
      sortFn: 'basic',
      cell: ({ getValue }) => format(new Date(getValue()), 'd MMM yyyy'),
    }),
    columnHelper.accessor('supplierName', {
      header: 'Supplier',
      sortFn: 'alphanumeric',
    }),
    columnHelper.accessor('itemCount', {
      header: 'Lines',
      sortFn: 'basic',
      enableGlobalFilter: false,
    }),
    columnHelper.accessor('totalRs', {
      header: 'Total',
      sortFn: 'basic',
      enableGlobalFilter: false,
      cell: ({ getValue }) => formatRs(getValue()),
    }),
    columnHelper.accessor('note', {
      header: 'Note',
      enableSorting: false,
      cell: ({ getValue }) => getValue() || '—',
    }),
  ])
}

export function PurchasesTable({
  data,
  search,
  onOpen,
}: {
  data: PurchaseListItem[]
  search: string
  onOpen: (id: number) => void
}): React.JSX.Element {
  const columns = useMemo(() => createColumns(), [])
  const table = useTable({
    features: purchaseTableFeatures,
    columns,
    data: data.length > 0 ? data : EMPTY_PURCHASES,
    state: { globalFilter: search },
    globalFilterFn: 'includesString',
    getColumnCanGlobalFilter: (column) =>
      column.id === 'supplierName' || column.id === 'note',
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
              No purchases match this search.
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
