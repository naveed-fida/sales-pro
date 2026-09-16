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
import type { Expense } from '@shared/schemas/expenses'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type ExpenseDateRange = {
  from: string
  to: string
}

function filterFn_dateRange(
  row: { getValue: (columnId: string) => unknown },
  columnId: string,
  range: ExpenseDateRange,
): boolean {
  const raw = row.getValue(columnId)
  const at = raw instanceof Date ? raw : new Date(String(raw))
  if (range.from && isBefore(at, startOfDay(parseISO(range.from)))) return false
  if (range.to && isAfter(at, endOfDay(parseISO(range.to)))) return false
  return true
}

const expenseTableFeatures = tableFeatures({
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

const columnHelper = createColumnHelper<typeof expenseTableFeatures, Expense>()
const EMPTY_EXPENSES: Expense[] = []

function createColumns(): ReturnType<(typeof columnHelper)['columns']> {
  return columnHelper.columns([
    columnHelper.accessor('incurredAt', {
      header: 'Date',
      sortFn: 'basic',
      filterFn: 'dateRange',
      enableGlobalFilter: false,
      cell: ({ getValue }) => format(new Date(getValue()), 'd MMM yyyy'),
    }),
    columnHelper.accessor('category', {
      header: 'Category',
      sortFn: 'alphanumeric',
      filterFn: 'equals',
    }),
    columnHelper.accessor('amountRs', {
      header: 'Amount',
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

export function ExpensesTable({
  data,
  search,
  category,
  from,
  to,
  onOpen,
}: {
  data: Expense[]
  search: string
  category: string | 'all'
  from: string
  to: string
  onOpen: (id: number) => void
}): React.JSX.Element {
  const columns = useMemo(() => createColumns(), [])
  const columnFilters = useMemo(() => {
    const filters: Array<{ id: string; value: unknown }> = []
    if (category !== 'all') filters.push({ id: 'category', value: category })
    if (from || to) filters.push({ id: 'incurredAt', value: { from, to } })
    return filters
  }, [category, from, to])
  const table = useTable({
    features: expenseTableFeatures,
    columns,
    data: data.length > 0 ? data : EMPTY_EXPENSES,
    state: {
      globalFilter: search,
      columnFilters,
    },
    globalFilterFn: 'includesString',
    getColumnCanGlobalFilter: (column) =>
      column.id === 'category' || column.id === 'note',
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
              No expenses match these filters.
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
