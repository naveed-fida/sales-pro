import { useMemo } from 'react'
import {
  createColumnHelper,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equals,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { endOfDay, format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns'
import { formatRs } from '@shared/money'
import type { PurchaseListItem } from '@shared/schemas/purchases'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type PurchaseDateRange = {
  from: string
  to: string
}

function filterFn_dateRange(
  row: { getValue: (columnId: string) => unknown },
  columnId: string,
  range: PurchaseDateRange,
): boolean {
  const raw = row.getValue(columnId)
  const at = raw instanceof Date ? raw : new Date(String(raw))
  if (range.from && isBefore(at, startOfDay(parseISO(range.from)))) return false
  if (range.to && isAfter(at, endOfDay(parseISO(range.to)))) return false
  return true
}

const purchaseTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
    equals: filterFn_equals,
    dateRange: filterFn_dateRange,
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
      filterFn: 'dateRange',
      enableGlobalFilter: false,
      cell: ({ getValue }) => format(new Date(getValue()), 'd MMM yyyy'),
    }),
    columnHelper.accessor('supplierName', {
      header: 'Supplier',
      sortFn: 'alphanumeric',
    }),
    columnHelper.accessor('supplierId', {
      header: 'Supplier id',
      filterFn: 'equals',
      enableGlobalFilter: false,
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
  supplierId,
  from,
  to,
  onOpen,
}: {
  data: PurchaseListItem[]
  search: string
  supplierId: number | 'all'
  from: string
  to: string
  onOpen: (id: number) => void
}): React.JSX.Element {
  const columns = useMemo(() => createColumns(), [])
  const columnFilters = useMemo(() => {
    const filters: Array<{ id: string; value: unknown }> = []
    if (supplierId !== 'all') filters.push({ id: 'supplierId', value: supplierId })
    if (from || to) filters.push({ id: 'purchasedAt', value: { from, to } })
    return filters
  }, [from, supplierId, to])
  const table = useTable({
    features: purchaseTableFeatures,
    columns,
    data: data.length > 0 ? data : EMPTY_PURCHASES,
    state: {
      globalFilter: search,
      columnFilters,
      columnVisibility: { supplierId: false },
    },
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
              No purchases match these filters.
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
