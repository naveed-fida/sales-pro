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
import { endOfDay, format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns'
import { formatRs } from '@shared/money'
import type { ReturnListItem } from '@shared/schemas/returns'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type ReturnDateRange = {
  from: string
  to: string
}

function filterFn_dateRange(
  row: { getValue: (columnId: string) => unknown },
  columnId: string,
  range: ReturnDateRange,
): boolean {
  const raw = row.getValue(columnId)
  const at = raw instanceof Date ? raw : new Date(String(raw))
  if (range.from && isBefore(at, startOfDay(parseISO(range.from)))) return false
  if (range.to && isAfter(at, endOfDay(parseISO(range.to)))) return false
  return true
}

const returnTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
    dateRange: filterFn_dateRange,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
  },
})

const columnHelper = createColumnHelper<typeof returnTableFeatures, ReturnListItem>()
const EMPTY_RETURNS: ReturnListItem[] = []

function createColumns(): ReturnType<(typeof columnHelper)['columns']> {
  return columnHelper.columns([
    columnHelper.accessor('createdAt', {
      header: 'Date',
      sortFn: 'basic',
      filterFn: 'dateRange',
      enableGlobalFilter: false,
      cell: ({ getValue }) => format(new Date(getValue()), 'd MMM yyyy, h:mm a'),
    }),
    columnHelper.accessor('billNo', {
      header: 'Bill',
      sortFn: 'basic',
    }),
    columnHelper.accessor('phone', {
      header: 'Phone',
      sortFn: 'alphanumeric',
      cell: ({ getValue }) => getValue() || '—',
    }),
    columnHelper.accessor('itemCount', {
      header: 'Lines',
      sortFn: 'basic',
      enableGlobalFilter: false,
    }),
    columnHelper.accessor('totalRs', {
      header: 'Returned',
      sortFn: 'basic',
      enableGlobalFilter: false,
      cell: ({ getValue }) => formatRs(getValue()),
    }),
    columnHelper.accessor('exchangeTotalRs', {
      header: 'Taken',
      sortFn: 'basic',
      enableGlobalFilter: false,
      cell: ({ getValue }) => (getValue() > 0 ? formatRs(getValue()) : '—'),
    }),
  ])
}

export function ReturnsTable({
  data,
  search,
  from,
  to,
  onOpen,
}: {
  data: ReturnListItem[]
  search: string
  from: string
  to: string
  onOpen: (id: number) => void
}): React.JSX.Element {
  const columns = useMemo(() => createColumns(), [])
  const columnFilters = useMemo(() => {
    if (!from && !to) return []
    return [{ id: 'createdAt', value: { from, to } }]
  }, [from, to])
  const table = useTable({
    features: returnTableFeatures,
    columns,
    data: data.length > 0 ? data : EMPTY_RETURNS,
    state: {
      globalFilter: search,
      columnFilters,
    },
    globalFilterFn: 'includesString',
    getColumnCanGlobalFilter: (column) => column.id === 'billNo' || column.id === 'phone',
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
              No returns match these filters.
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
