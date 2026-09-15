import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Barcode, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { productUnits, type ProductUnit } from '@shared/quantity'
import type { ProductListItem } from '@shared/schemas/catalog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useSettingsQuery } from '@/features/settings/use-settings'
import { LabelsDialog } from './labels-dialog'
import { ProductForm } from './product-form'
import { ProductsTable } from './products-table'
import { UNIT_LABELS } from './unit-labels'
import {
  productQueryKey,
  productsQueryKey,
  useCategoriesQuery,
  useProductQuery,
  useProductsQuery,
} from './use-catalog'

const ALL = 'all'

function ProductEditor({
  productId,
  onClose,
}: {
  productId: number | 'new'
  onClose: () => void
}): React.JSX.Element {
  const categoriesQuery = useCategoriesQuery()
  const settingsQuery = useSettingsQuery()
  const productQuery = useProductQuery(productId === 'new' ? null : productId)
  const categories = categoriesQuery.data ?? []
  const isLoading =
    categoriesQuery.isPending ||
    settingsQuery.isPending ||
    (productId !== 'new' && productQuery.isPending)

  if (isLoading) {
    return <Skeleton className="h-80 w-full rounded-xl" />
  }

  if (categoriesQuery.isError || settingsQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        Could not load the form. Close this dialog and try again.
      </p>
    )
  }

  if (productId !== 'new' && (productQuery.isError || !productQuery.data)) {
    return (
      <p className="text-sm text-destructive">
        {productQuery.error instanceof Error
          ? productQuery.error.message
          : 'Could not load the product.'}
      </p>
    )
  }

  return (
    <ProductForm
      product={productId === 'new' ? null : (productQuery.data ?? null)}
      categories={categories}
      defaultReorderPieces={settingsQuery.data?.defaultReorderPieces ?? 5}
      onClose={onClose}
    />
  )
}

export function ProductsPage(): React.JSX.Element {
  const queryClient = useQueryClient()
  const productsQuery = useProductsQuery()
  const categoriesQuery = useCategoriesQuery()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | 'all'>('all')
  const [unit, setUnit] = useState<ProductUnit | 'all'>('all')
  const [active, setActive] = useState<'all' | 'active' | 'archived'>('active')
  const [editor, setEditor] = useState<number | 'new' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ProductListItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [labelsOpen, setLabelsOpen] = useState(false)
  const settingsQuery = useSettingsQuery()
  const onEdit = useCallback((id: number) => setEditor(id), [])
  const onDelete = useCallback(
    (product: ProductListItem) => setPendingDelete(product),
    [],
  )

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) return

    setDeleting(true)
    const result = await window.api.products.delete(pendingDelete.id)
    setDeleting(false)

    if (!result.ok) {
      toast.error(result.error.message)
      return
    }

    await queryClient.invalidateQueries({ queryKey: productsQueryKey })
    queryClient.removeQueries({ queryKey: productQueryKey(pendingDelete.id) })
    setPendingDelete(null)
    toast.success('Product deleted')
  }

  const categories = categoriesQuery.data ?? []
  const products = productsQuery.data ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Categories, units, variants, barcodes and sale prices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setLabelsOpen(true)}>
            <Barcode />
            Labels
          </Button>
          <Button type="button" onClick={() => setEditor('new')}>
            <Plus />
            New product
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, category, barcode"
        />
        <Select
          value={categoryId === 'all' ? ALL : String(categoryId)}
          onValueChange={(value) =>
            setCategoryId(value === ALL ? 'all' : Number.parseInt(value, 10))
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={unit}
          onValueChange={(value) =>
            setUnit(value === ALL ? 'all' : (value as ProductUnit))
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All units</SelectItem>
            {productUnits.map((item) => (
              <SelectItem key={item} value={item}>
                {UNIT_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={active}
          onValueChange={(value) => setActive(value as 'all' | 'active' | 'archived')}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {productsQuery.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : productsQuery.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-destructive">
            {productsQuery.error instanceof Error
              ? productsQuery.error.message
              : 'Could not load products.'}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void productsQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <p className="text-sm text-muted-foreground">
              No products yet. Add a category when you create the first one, then save a
              variant so it can be purchased and sold.
            </p>
            <Button type="button" onClick={() => setEditor('new')}>
              <Plus />
              New product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden py-0">
          <CardContent className="min-h-0 flex-1 overflow-auto px-0">
            <ProductsTable
              data={products}
              search={search}
              categoryId={categoryId}
              unit={unit}
              active={active}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={editor !== null} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent
          className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-4xl"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle>{editor === 'new' ? 'New product' : 'Edit product'}</DialogTitle>
            <DialogDescription>
              One row per size or colour. Leave barcode blank to generate the next number.
            </DialogDescription>
          </DialogHeader>
          {editor !== null ? (
            <ProductEditor productId={editor} onClose={() => setEditor(null)} />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the product and its variants. You cannot undo it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LabelsDialog
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
        shopName={settingsQuery.data?.shopName ?? ''}
      />
    </div>
  )
}
