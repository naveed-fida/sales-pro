import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldPath,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { cn } from 'cn'
import { lineTotalRs } from '@shared/cost'
import { formatRs } from '@shared/money'
import { formatQuantity, toMilli } from '@shared/quantity'
import {
  receivePurchaseSchema,
  type PurchaseCatalogVariant,
  type ReceivePurchase,
  type ReceivePurchaseInput,
} from '@shared/schemas/purchases'
import type { Supplier } from '@shared/schemas/suppliers'
import { variantOptionLabel } from '@shared/variant-label'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { UNIT_LABELS } from '@/features/products/unit-labels'
import { labelVariantsQueryKey, productsQueryKey } from '@/features/products/use-catalog'
import { PURCHASE_HOTKEYS } from '@/lib/hotkeys'
import { NumberEditDialog } from '@/components/number-edit-dialog'
import { SupplierForm } from './supplier-form'
import {
  purchaseCatalogQueryKey,
  purchasesQueryKey,
  usePurchaseCatalogQuery,
} from './use-purchases'
import { useSuppliersQuery } from './use-suppliers'

const EMPTY_VARIANTS: PurchaseCatalogVariant[] = []

type LineEdit =
  | { kind: 'quantity' | 'unitCostRs' | 'discountRs'; index: number }
  | { kind: 'billDiscount' }

function matchesSearch(variant: PurchaseCatalogVariant, query: string): boolean {
  if (!query) return false
  return [variant.productName, variant.barcode, variant.size ?? '', variant.colour ?? '']
    .join(' ')
    .toLowerCase()
    .includes(query)
}

function PurchaseEntryForm({
  suppliers,
  variants,
}: {
  suppliers: Supplier[]
  variants: PurchaseCatalogVariant[]
}): React.JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [selectedIndexRaw, setSelectedIndex] = useState(0)
  const [lineEdit, setLineEdit] = useState<LineEdit | null>(null)
  const [supplierOpen, setSupplierOpen] = useState(false)

  const form = useForm<ReceivePurchaseInput, unknown, ReceivePurchase>({
    resolver: zodResolver(receivePurchaseSchema),
    defaultValues: {
      supplierId: suppliers[0]?.id,
      purchasedAt: new Date(),
      discountRs: 0,
      note: '',
      items: [],
    },
  })

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = form

  const items = useFieldArray({ control, name: 'items' })
  const watchedItems = useWatch({ control, name: 'items' }) ?? []
  const discountRs = useWatch({ control, name: 'discountRs' }) ?? 0
  const selectedIndex =
    items.fields.length === 0 ? 0 : Math.min(selectedIndexRaw, items.fields.length - 1)
  const query = search.trim().toLowerCase()
  const resultsOpen = query.length > 0
  const results = useMemo(
    () => variants.filter((variant) => matchesSearch(variant, query)),
    [query, variants],
  )
  const exact = useMemo(
    () => variants.find((variant) => variant.barcode.toLowerCase() === query),
    [query, variants],
  )

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  function focusSearch(): void {
    searchRef.current?.focus()
    searchRef.current?.select()
  }

  function addVariant(variant: PurchaseCatalogVariant): void {
    const current = getValues('items')
    const existingIndex = current.findIndex(
      (item) => item.variantId === variant.variantId,
    )
    if (existingIndex >= 0) {
      const currentQty = Number(current[existingIndex]?.quantity ?? 0)
      setValue(`items.${existingIndex}.quantity`, currentQty + 1, {
        shouldDirty: true,
        shouldValidate: true,
      })
      setSelectedIndex(existingIndex)
    } else {
      items.append({
        variantId: variant.variantId,
        productName: variant.productName,
        barcode: variant.barcode,
        size: variant.size,
        colour: variant.colour,
        unit: variant.unit,
        quantity: 1,
        unitCostRs: variant.avgCostRs,
        discountRs: 0,
      })
      setSelectedIndex(current.length)
    }
    setSearch('')
    focusSearch()
  }

  function addFromSearch(): void {
    if (exact) {
      addVariant(exact)
      return
    }
    const picked = results[highlight]
    if (picked) addVariant(picked)
  }

  function removeSelected(): void {
    if (items.fields.length === 0) return
    items.remove(selectedIndex)
    focusSearch()
  }

  function openLineEdit(
    kind: Exclude<LineEdit, { kind: 'billDiscount' }>['kind'],
    index = selectedIndex,
  ): void {
    if (items.fields.length === 0) return
    setSelectedIndex(index)
    setLineEdit({ kind, index })
  }

  async function onSubmit(values: ReceivePurchase): Promise<void> {
    const result = await window.api.purchases.receive(values)
    if (!result.ok) {
      if (result.error.field) {
        setError(result.error.field as FieldPath<ReceivePurchase>, {
          type: 'server',
          message: result.error.message,
        })
        return
      }
      toast.error(result.error.message)
      return
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: purchasesQueryKey }),
      queryClient.invalidateQueries({ queryKey: productsQueryKey }),
      queryClient.invalidateQueries({ queryKey: labelVariantsQueryKey }),
      queryClient.invalidateQueries({ queryKey: purchaseCatalogQueryKey }),
    ])
    toast.success('Purchase received')
    navigate('/purchases')
  }

  useHotkeys(
    PURCHASE_HOTKEYS.quantity.combo,
    (event) => {
      event.preventDefault()
      if (lineEdit) return
      openLineEdit('quantity')
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    PURCHASE_HOTKEYS.cost.combo,
    (event) => {
      event.preventDefault()
      if (lineEdit) return
      openLineEdit('unitCostRs')
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    PURCHASE_HOTKEYS.lineDiscount.combo,
    (event) => {
      event.preventDefault()
      if (lineEdit) return
      openLineEdit('discountRs')
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    PURCHASE_HOTKEYS.billDiscount.combo,
    (event) => {
      event.preventDefault()
      if (lineEdit) return
      setLineEdit({ kind: 'billDiscount' })
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    PURCHASE_HOTKEYS.complete.combo,
    (event) => {
      event.preventDefault()
      if (lineEdit || supplierOpen) return
      void handleSubmit(onSubmit)()
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys('f11', (event) => event.preventDefault(), {
    enableOnFormTags: true,
    preventDefault: true,
  })
  useHotkeys(
    'up',
    (event) => {
      event.preventDefault()
      if (lineEdit) return
      if (resultsOpen) {
        setHighlight((current) => Math.max(0, current - 1))
        return
      }
      if (items.fields.length === 0) return
      setSelectedIndex((current) => Math.max(0, current - 1))
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    'down',
    (event) => {
      event.preventDefault()
      if (lineEdit) return
      if (resultsOpen) {
        setHighlight((current) => Math.min(Math.max(results.length - 1, 0), current + 1))
        return
      }
      if (items.fields.length === 0) return
      setSelectedIndex((current) => Math.min(items.fields.length - 1, current + 1))
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    'del',
    (event) => {
      if (lineEdit) return
      const target = event.target
      if (
        (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
        target.value.length > 0
      ) {
        return
      }
      event.preventDefault()
      removeSelected()
    },
    { enableOnFormTags: true },
  )
  useHotkeys(
    'esc',
    (event) => {
      if (lineEdit || supplierOpen) return
      if (search.length > 0) {
        event.preventDefault()
        setSearch('')
        setHighlight(0)
        focusSearch()
      }
    },
    { enableOnFormTags: true },
  )

  const subtotal = watchedItems.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0
    const unitCostRs = Number(item.unitCostRs) || 0
    const lineDiscount = Number(item.discountRs) || 0
    return sum + lineTotalRs(toMilli(quantity), unitCostRs, lineDiscount)
  }, 0)
  const totalRs = subtotal - (Number(discountRs) || 0)
  const selected = watchedItems[selectedIndex]
  const editValue =
    lineEdit === null
      ? 0
      : lineEdit.kind === 'billDiscount'
        ? Number(discountRs) || 0
        : Number(watchedItems[lineEdit.index]?.[lineEdit.kind]) || 0
  const editInteger = lineEdit?.kind === 'quantity' ? selected?.unit === 'piece' : true

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <form
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          if (event.target instanceof HTMLTextAreaElement) return
          if (event.target instanceof HTMLButtonElement) return
          event.preventDefault()
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">New purchase</h1>
            <p className="text-sm text-muted-foreground">
              Scan or search, Enter to add, then receive to put stock on the shelf.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/purchases')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Receive
              <Kbd>{PURCHASE_HOTKEYS.complete.label}</Kbd>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_16rem]">
          <Field data-invalid={!!errors.supplierId}>
            <FieldLabel>Supplier</FieldLabel>
            <div className="flex gap-2">
              <Controller
                name="supplierId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ? String(field.value) : undefined}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <SelectTrigger className="w-full" aria-invalid={!!errors.supplierId}>
                      <SelectValue placeholder="Pick a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={String(supplier.id)}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setSupplierOpen(true)}
                aria-label="Add supplier"
              >
                <Plus />
              </Button>
            </div>
            <FieldError errors={[errors.supplierId]} />
          </Field>
          <Field data-invalid={!!errors.purchasedAt}>
            <FieldLabel htmlFor="purchased-at">Date</FieldLabel>
            <Controller
              name="purchasedAt"
              control={control}
              render={({ field }) => (
                <Input
                  id="purchased-at"
                  type="date"
                  value={
                    field.value instanceof Date ? format(field.value, 'yyyy-MM-dd') : ''
                  }
                  onChange={(event) => {
                    const next = event.target.value
                    if (!next) return
                    field.onChange(new Date(`${next}T12:00:00`))
                  }}
                  aria-invalid={!!errors.purchasedAt}
                />
              )}
            />
            <FieldError errors={[errors.purchasedAt]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="purchase-search">Search / barcode</FieldLabel>
            <div className="relative">
              <Input
                id="purchase-search"
                ref={searchRef}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setHighlight(0)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addFromSearch()
                  }
                }}
                placeholder="Type a name or scan a barcode"
                autoComplete="off"
              />
              {resultsOpen ? (
                <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl bg-popover p-1 text-sm shadow-md ring-1 ring-foreground/10">
                  {results.length === 0 ? (
                    <li className="px-3 py-2 text-muted-foreground">
                      No matching variants.
                    </li>
                  ) : (
                    results.map((variant, index) => (
                      <li key={variant.variantId}>
                        <button
                          type="button"
                          className={cn(
                            'flex w-full flex-col items-start rounded-lg px-3 py-2 text-left',
                            index === highlight && 'bg-muted',
                          )}
                          onMouseEnter={() => setHighlight(index)}
                          onClick={() => addVariant(variant)}
                        >
                          <span>{variantOptionLabel(variant)}</span>
                          <span className="text-xs text-muted-foreground">
                            {variant.barcode} ·{' '}
                            {formatQuantity(variant.quantityMilli, variant.unit)} in stock
                            · {UNIT_LABELS[variant.unit]}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
          </Field>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.fields.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Search or scan to add a line.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.fields.map((field, index) => {
                    const item = watchedItems[index]
                    if (!item) return null
                    const quantity = Number(item.quantity) || 0
                    const unitCostRs = Number(item.unitCostRs) || 0
                    const lineDiscount = Number(item.discountRs) || 0
                    const lineTotal = lineTotalRs(
                      toMilli(quantity),
                      unitCostRs,
                      lineDiscount,
                    )
                    return (
                      <TableRow
                        key={field.id}
                        className={cn(
                          'cursor-pointer',
                          index === selectedIndex && 'bg-muted',
                        )}
                        onClick={() => setSelectedIndex(index)}
                      >
                        <TableCell>
                          <p>{variantOptionLabel(item)}</p>
                          <p className="text-xs text-muted-foreground">{item.barcode}</p>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            className="-ml-2 h-auto px-2 py-1 font-normal"
                            aria-label={`Quantity of ${variantOptionLabel(item)}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              openLineEdit('quantity', index)
                            }}
                          >
                            {item.unit === 'piece'
                              ? String(quantity)
                              : formatQuantity(toMilli(quantity), item.unit)}{' '}
                            {UNIT_LABELS[item.unit].toLowerCase()}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            className="-ml-2 h-auto px-2 py-1 font-normal"
                            aria-label={`Cost of ${variantOptionLabel(item)}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              openLineEdit('unitCostRs', index)
                            }}
                          >
                            {formatRs(unitCostRs)}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            className="-ml-2 h-auto px-2 py-1 font-normal"
                            aria-label={`Discount of ${variantOptionLabel(item)}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              openLineEdit('discountRs', index)
                            }}
                          >
                            {lineDiscount > 0 ? formatRs(lineDiscount) : '—'}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatRs(lineTotal)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${variantOptionLabel(item)}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              items.remove(index)
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </table>
          </div>
          <FieldError errors={[errors.items?.root, errors.items]} />
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <Field data-invalid={!!errors.note}>
            <FieldLabel htmlFor="purchase-note">Note</FieldLabel>
            <Textarea id="purchase-note" rows={2} {...register('note')} />
            <FieldError errors={[errors.note]} />
          </Field>
          <div className="flex flex-col items-end justify-end gap-1 text-sm">
            <p className="text-muted-foreground">
              Subtotal {formatRs(subtotal)}
              {Number(discountRs) > 0
                ? ` · discount ${formatRs(Number(discountRs))}`
                : ''}
            </p>
            <p className="text-base font-medium">Total {formatRs(totalRs)}</p>
            <FieldError errors={[errors.discountRs]} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>
            Qty <Kbd>{PURCHASE_HOTKEYS.quantity.label}</Kbd>
          </span>
          <span>
            Cost <Kbd>{PURCHASE_HOTKEYS.cost.label}</Kbd>
          </span>
          <span>
            Line discount <Kbd>{PURCHASE_HOTKEYS.lineDiscount.label}</Kbd>
          </span>
          <span>
            Bill discount <Kbd>{PURCHASE_HOTKEYS.billDiscount.label}</Kbd>
          </span>
          <span>
            Remove line <Kbd>Del</Kbd>
          </span>
        </div>
      </form>

      <NumberEditDialog
        open={lineEdit !== null}
        title={
          lineEdit?.kind === 'quantity'
            ? 'Quantity'
            : lineEdit?.kind === 'unitCostRs'
              ? 'Cost'
              : lineEdit?.kind === 'discountRs'
                ? 'Line discount'
                : 'Bill discount'
        }
        description="Enter confirms. Esc cancels."
        label={
          lineEdit?.kind === 'quantity'
            ? selected
              ? UNIT_LABELS[selected.unit]
              : 'Quantity'
            : 'Rs'
        }
        value={editValue}
        kind={lineEdit?.kind === 'quantity' ? 'quantity' : 'money'}
        integer={editInteger}
        onOpenChange={(open) => {
          if (!open) setLineEdit(null)
        }}
        onSave={(value) => {
          if (lineEdit === null) return
          if (lineEdit.kind === 'billDiscount') {
            setValue('discountRs', value, { shouldDirty: true, shouldValidate: true })
            return
          }
          setValue(`items.${lineEdit.index}.${lineEdit.kind}`, value, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }}
      />

      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>New supplier</DialogTitle>
            <DialogDescription>
              Saved to the supplier list for later purchases.
            </DialogDescription>
          </DialogHeader>
          <SupplierForm
            supplier={null}
            onClose={() => setSupplierOpen(false)}
            onSaved={(saved) => {
              setValue('supplierId', saved.id, { shouldValidate: true })
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function PurchaseEntryPage(): React.JSX.Element {
  const suppliersQuery = useSuppliersQuery()
  const catalogQuery = usePurchaseCatalogQuery()
  const isLoading = suppliersQuery.isPending || catalogQuery.isPending

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    )
  }

  if (suppliersQuery.isError || catalogQuery.isError) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <p className="text-sm text-destructive">
          Could not load purchase entry. Go back to Purchases and try again.
        </p>
      </div>
    )
  }

  return (
    <PurchaseEntryForm
      suppliers={suppliersQuery.data ?? []}
      variants={catalogQuery.data ?? EMPTY_VARIANTS}
    />
  )
}
