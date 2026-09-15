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
import { formatRs } from '@shared/money'
import { formatQuantity, type ProductUnit } from '@shared/quantity'
import type { ProductListItem } from '@shared/schemas/catalog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProductImage } from './product-image'
import { UNIT_LABELS } from './unit-labels'

const catalogTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
    equals: filterFn_equals,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
  },
})

const columnHelper = createColumnHelper<typeof catalogTableFeatures, ProductListItem>()
const EMPTY_PRODUCTS: ProductListItem[] = []

function priceLabel(row: ProductListItem): string {
  if (row.variantCount === 0) return '—'
  if (row.minSalePriceRs === row.maxSalePriceRs) return formatRs(row.minSalePriceRs)
  return `${formatRs(row.minSalePriceRs)} – ${formatRs(row.maxSalePriceRs)}`
}

function createColumns({
  onEdit,
  onDelete,
}: {
  onEdit: (id: number) => void
  onDelete: (product: ProductListItem) => void
}): ReturnType<(typeof columnHelper)['columns']> {
  return columnHelper.columns([
    columnHelper.display({
      id: 'image',
      header: '',
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <ProductImage
          fileName={row.original.imagePath}
          alt=""
          className="size-10 rounded-md"
        />
      ),
    }),
    columnHelper.accessor('name', {
      header: 'Name',
      sortFn: 'alphanumeric',
    }),
    columnHelper.accessor('categoryName', {
      header: 'Category',
      sortFn: 'alphanumeric',
    }),
    columnHelper.accessor('categoryId', {
      header: 'Category id',
      filterFn: 'equals',
      enableGlobalFilter: false,
    }),
    columnHelper.accessor('unit', {
      header: 'Unit',
      filterFn: 'equals',
      enableGlobalFilter: false,
      cell: ({ getValue }) => UNIT_LABELS[getValue()],
    }),
    columnHelper.accessor('variantCount', {
      header: 'Variants',
      sortFn: 'basic',
      enableGlobalFilter: false,
    }),
    columnHelper.accessor('quantityMilli', {
      header: 'Stock',
      sortFn: 'basic',
      enableGlobalFilter: false,
      cell: ({ row, getValue }) => formatQuantity(getValue(), row.original.unit),
    }),
    columnHelper.accessor('minSalePriceRs', {
      header: 'Price',
      sortFn: 'basic',
      enableGlobalFilter: false,
      cell: ({ row }) => priceLabel(row.original),
    }),
    columnHelper.accessor('barcodes', {
      header: 'Barcode',
      enableSorting: false,
      cell: ({ getValue }) => {
        const [first, ...rest] = getValue().split(' ').filter(Boolean)
        if (!first) return '—'
        if (rest.length === 0) return first
        return `${first} +${rest.length}`
      },
    }),
    columnHelper.accessor('isActive', {
      header: 'Status',
      filterFn: 'equals',
      enableGlobalFilter: false,
      cell: ({ getValue }) =>
        getValue() ? <Badge>Active</Badge> : <Badge variant="secondary">Archived</Badge>,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              onEdit(row.original.id)
            }}
          >
            Edit
          </Button>
          {row.original.isActive ? null : (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(row.original)
              }}
            >
              Delete
            </Button>
          )}
        </div>
      ),
    }),
  ])
}

export function ProductsTable({
  data,
  search,
  categoryId,
  unit,
  active,
  onEdit,
  onDelete,
}: {
  data: ProductListItem[]
  search: string
  categoryId: number | 'all'
  unit: ProductUnit | 'all'
  active: 'all' | 'active' | 'archived'
  onEdit: (id: number) => void
  onDelete: (product: ProductListItem) => void
}): React.JSX.Element {
  const columns = useMemo(() => createColumns({ onEdit, onDelete }), [onDelete, onEdit])
  const columnFilters = useMemo(() => {
    const filters: Array<{ id: string; value: unknown }> = []
    if (categoryId !== 'all') filters.push({ id: 'categoryId', value: categoryId })
    if (unit !== 'all') filters.push({ id: 'unit', value: unit })
    if (active !== 'all') filters.push({ id: 'isActive', value: active === 'active' })
    return filters
  }, [active, categoryId, unit])

  const table = useTable({
    features: catalogTableFeatures,
    columns,
    data: data.length > 0 ? data : EMPTY_PRODUCTS,
    state: {
      globalFilter: search,
      columnFilters,
      columnVisibility: { categoryId: false },
    },
    globalFilterFn: 'includesString',
    getColumnCanGlobalFilter: (column) =>
      column.id === 'name' || column.id === 'categoryName' || column.id === 'barcodes',
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
              No products match these filters.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer"
              onClick={() => onEdit(row.original.id)}
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
