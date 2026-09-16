import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { cn } from 'cn'
import { lineTotalRs } from '@shared/cost'
import { formatRs } from '@shared/money'
import { formatQuantity, fromMilli, toMilli } from '@shared/quantity'
import {
  completeSaleSchema,
  type CompleteSale,
  type CompleteSaleInput,
  type HeldSale,
  type PosCatalogVariant,
} from '@shared/schemas/sales'
import { variantOptionLabel } from '@shared/variant-label'
import { NumberEditDialog } from '@/components/number-edit-dialog'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UNIT_LABELS } from '@/features/products/unit-labels'
import { labelVariantsQueryKey, productsQueryKey } from '@/features/products/use-catalog'
import { purchaseCatalogQueryKey } from '@/features/purchases/use-purchases'
import { reportsQueryKey } from '@/features/reports/use-reports'
import { salesQueryKey } from '@/features/sales/use-sales'
import { POS_HOTKEYS } from '@/lib/hotkeys'
import { HoldRecallDialog } from './hold-recall-dialog'
import {
  holdsQueryKey,
  posCatalogQueryKey,
  useHoldsQuery,
  usePosCatalogQuery,
} from './use-pos'

const EMPTY_VARIANTS: PosCatalogVariant[] = []

type LineEdit =
  | { kind: 'quantity' | 'unitPriceRs' | 'lineDiscountRs'; index: number }
  | { kind: 'billDiscount' }
  | { kind: 'tendered' }

function emptySale(): CompleteSaleInput {
  return { phone: '', discountRs: 0, tenderedRs: 0, items: [] }
}

function matchesSearch(variant: PosCatalogVariant, query: string): boolean {
  if (!query) return false
  return [variant.productName, variant.barcode, variant.size ?? '', variant.colour ?? '']
    .join(' ')
    .toLowerCase()
    .includes(query)
}

function quantityFromMilli(milli: number, unit: PosCatalogVariant['unit']): number {
  const display = fromMilli(milli)
  return unit === 'piece' ? Math.round(display) : display
}

function itemsFromHold(hold: HeldSale): CompleteSaleInput['items'] {
  return hold.items.map((item) => ({
    variantId: item.variantId,
    productName: item.productName,
    barcode: item.barcode,
    size: item.size,
    colour: item.colour,
    unit: item.unit,
    quantity: quantityFromMilli(item.quantityMilli, item.unit),
    unitPriceRs: item.unitPriceRs,
    lineDiscountRs: item.lineDiscountRs,
  }))
}

function PosSale({ variants }: { variants: PosCatalogVariant[] }): React.JSX.Element {
  const queryClient = useQueryClient()
  const holdsQuery = useHoldsQuery()
  const searchRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [selectedIndexRaw, setSelectedIndex] = useState(0)
  const [lineEdit, setLineEdit] = useState<LineEdit | null>(null)
  const [recallOpen, setRecallOpen] = useState(false)
  const [recallIndex, setRecallIndex] = useState(0)
  const [voidOpen, setVoidOpen] = useState(false)
  const [pendingRecall, setPendingRecall] = useState<HeldSale | null>(null)
  const [pendingDiscard, setPendingDiscard] = useState<HeldSale | null>(null)

  const form = useForm<CompleteSaleInput, unknown, CompleteSale>({
    resolver: zodResolver(completeSaleSchema),
    defaultValues: emptySale(),
  })

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = form

  const items = useFieldArray({ control, name: 'items' })
  const watchedItems = useWatch({ control, name: 'items' }) ?? []
  const discountRs = useWatch({ control, name: 'discountRs' }) ?? 0
  const tenderedRs = useWatch({ control, name: 'tenderedRs' }) ?? 0
  const phone = useWatch({ control, name: 'phone' }) ?? ''
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
  const holds = holdsQuery.data ?? []
  const recallSelected = holds.length === 0 ? 0 : Math.min(recallIndex, holds.length - 1)
  const blocked =
    lineEdit !== null ||
    recallOpen ||
    voidOpen ||
    pendingRecall !== null ||
    pendingDiscard !== null

  const subtotal = watchedItems.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0
    const unitPriceRs = Number(item.unitPriceRs) || 0
    const lineDiscount = Number(item.lineDiscountRs) || 0
    return sum + lineTotalRs(toMilli(quantity), unitPriceRs, lineDiscount)
  }, 0)
  const totalRs = subtotal - (Number(discountRs) || 0)
  const tendered = Number(tenderedRs) || 0
  const changeRs = Math.max(0, tendered - totalRs)
  const selected = watchedItems[selectedIndex]
  const editValue =
    lineEdit === null
      ? 0
      : lineEdit.kind === 'billDiscount'
        ? Number(discountRs) || 0
        : lineEdit.kind === 'tendered'
          ? tendered
          : Number(watchedItems[lineEdit.index]?.[lineEdit.kind]) || 0
  const editInteger = lineEdit?.kind === 'quantity' ? selected?.unit === 'piece' : true

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  function focusSearch(): void {
    searchRef.current?.focus()
    searchRef.current?.select()
  }

  function addVariant(variant: PosCatalogVariant): void {
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
        unitPriceRs: variant.salePriceRs,
        lineDiscountRs: 0,
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
    kind: Exclude<LineEdit, { kind: 'billDiscount' } | { kind: 'tendered' }>['kind'],
    index = selectedIndex,
  ): void {
    if (items.fields.length === 0) return
    setSelectedIndex(index)
    setLineEdit({ kind, index })
  }

  function bumpPiece(delta: number): void {
    const item = watchedItems[selectedIndex]
    if (!item || item.unit !== 'piece') return
    const next = Math.max(1, (Number(item.quantity) || 1) + delta)
    setValue(`items.${selectedIndex}.quantity`, next, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  function clearSale(): void {
    reset(emptySale())
    setSearch('')
    setHighlight(0)
    setSelectedIndex(0)
    focusSearch()
  }

  async function invalidateStock(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: posCatalogQueryKey }),
      queryClient.invalidateQueries({ queryKey: purchaseCatalogQueryKey }),
      queryClient.invalidateQueries({ queryKey: productsQueryKey }),
      queryClient.invalidateQueries({ queryKey: labelVariantsQueryKey }),
      queryClient.invalidateQueries({ queryKey: holdsQueryKey }),
      queryClient.invalidateQueries({ queryKey: salesQueryKey }),
      queryClient.invalidateQueries({ queryKey: reportsQueryKey }),
    ])
  }

  async function saveHold(): Promise<boolean> {
    const values = getValues()
    if ((values.items ?? []).length === 0) return false
    const result = await window.api.sales.saveHold({
      phone: values.phone ?? '',
      note: '',
      discountRs: Number(values.discountRs) || 0,
      items: values.items,
    })
    if (!result.ok) {
      toast.error(result.error.message)
      return false
    }
    await queryClient.invalidateQueries({ queryKey: holdsQueryKey })
    return true
  }

  async function applyHold(hold: HeldSale): Promise<void> {
    const result = await window.api.sales.deleteHold(hold.id)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    reset({
      phone: hold.phone ?? '',
      discountRs: hold.discountRs,
      tenderedRs: 0,
      items: itemsFromHold(hold),
    })
    setSelectedIndex(0)
    setRecallOpen(false)
    setPendingRecall(null)
    await queryClient.invalidateQueries({ queryKey: holdsQueryKey })
    focusSearch()
  }

  function requestRecall(hold: HeldSale): void {
    if (items.fields.length > 0) {
      setPendingRecall(hold)
      return
    }
    void applyHold(hold)
  }

  async function holdCurrent(): Promise<void> {
    if (isSubmitting || items.fields.length === 0) return
    if (!(await saveHold())) return
    clearSale()
    toast.success('Sale held')
  }

  async function holdThenRecall(): Promise<void> {
    const hold = pendingRecall
    if (!hold) return
    if (!(await saveHold())) return
    clearSale()
    await applyHold(hold)
  }

  async function discardHold(hold: HeldSale): Promise<void> {
    const result = await window.api.sales.deleteHold(hold.id)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    setPendingDiscard(null)
    await queryClient.invalidateQueries({ queryKey: holdsQueryKey })
  }

  async function onComplete(values: CompleteSale): Promise<void> {
    const result = await window.api.sales.complete(values)
    if (!result.ok) {
      if (result.error.field === 'tenderedRs') {
        setLineEdit({ kind: 'tendered' })
        return
      }
      if (result.error.field) {
        setError(result.error.field as FieldPath<CompleteSale>, {
          type: 'server',
          message: result.error.message,
        })
        toast.error(result.error.message)
        return
      }
      toast.error(result.error.message)
      return
    }

    await invalidateStock()
    toast.success(`Bill ${result.data.billNo} · ${formatRs(result.data.totalRs)}`)
    clearSale()
    const printed = await window.api.sales.print(result.data.id)
    if (!printed.ok) toast.error(printed.error.message)
  }

  function requestComplete(): void {
    if (isSubmitting || items.fields.length === 0) return
    if (tendered < totalRs) {
      setLineEdit({ kind: 'tendered' })
      return
    }
    void handleSubmit(onComplete)()
  }

  useHotkeys(
    POS_HOTKEYS.quantity.combo,
    (event) => {
      event.preventDefault()
      if (blocked) return
      openLineEdit('quantity')
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    POS_HOTKEYS.price.combo,
    (event) => {
      event.preventDefault()
      if (blocked) return
      openLineEdit('unitPriceRs')
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    POS_HOTKEYS.phone.combo,
    (event) => {
      event.preventDefault()
      if (blocked) return
      phoneRef.current?.focus()
      phoneRef.current?.select()
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    POS_HOTKEYS.lineDiscount.combo,
    (event) => {
      event.preventDefault()
      if (blocked) return
      openLineEdit('lineDiscountRs')
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    POS_HOTKEYS.billDiscount.combo,
    (event) => {
      event.preventDefault()
      if (blocked) return
      setLineEdit({ kind: 'billDiscount' })
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    POS_HOTKEYS.voidSale.combo,
    (event) => {
      event.preventDefault()
      if (blocked) return
      if (items.fields.length === 0 && !phone) return
      setVoidOpen(true)
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    POS_HOTKEYS.hold.combo,
    (event) => {
      event.preventDefault()
      if (blocked) return
      void holdCurrent()
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    POS_HOTKEYS.tendered.combo,
    (event) => {
      event.preventDefault()
      if (blocked) return
      if (items.fields.length === 0) return
      setLineEdit({ kind: 'tendered' })
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    POS_HOTKEYS.recall.combo,
    (event) => {
      event.preventDefault()
      if (lineEdit !== null || voidOpen || pendingRecall || pendingDiscard) return
      setRecallIndex(0)
      setRecallOpen(true)
      void holdsQuery.refetch()
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    POS_HOTKEYS.complete.combo,
    (event) => {
      event.preventDefault()
      if (blocked) return
      requestComplete()
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
      if (recallOpen) {
        setRecallIndex((current) => Math.max(0, current - 1))
        return
      }
      if (blocked) return
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
      if (recallOpen) {
        setRecallIndex((current) => Math.min(Math.max(holds.length - 1, 0), current + 1))
        return
      }
      if (blocked) return
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
    'enter',
    (event) => {
      if (!recallOpen || pendingRecall || pendingDiscard) return
      const hold = holds[recallSelected]
      if (!hold) return
      event.preventDefault()
      requestRecall(hold)
    },
    { enableOnFormTags: true },
  )
  useHotkeys(
    'del',
    (event) => {
      if (recallOpen && !pendingDiscard && !pendingRecall) {
        const hold = holds[recallSelected]
        if (!hold) return
        event.preventDefault()
        setPendingDiscard(hold)
        return
      }
      if (blocked) return
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
      if (blocked) return
      if (search.length > 0) {
        event.preventDefault()
        setSearch('')
        setHighlight(0)
        focusSearch()
      }
    },
    { enableOnFormTags: true },
  )
  useHotkeys(
    '+,=,numpadadd',
    (event) => {
      if (blocked) return
      const target = event.target
      if (target instanceof HTMLInputElement && target === phoneRef.current) return
      if (
        target instanceof HTMLInputElement &&
        target === searchRef.current &&
        search.length > 0
      ) {
        return
      }
      event.preventDefault()
      bumpPiece(1)
    },
    { enableOnFormTags: true },
  )
  useHotkeys(
    '-,numpadsub',
    (event) => {
      if (blocked) return
      const target = event.target
      if (target instanceof HTMLInputElement && target === phoneRef.current) return
      if (
        target instanceof HTMLInputElement &&
        target === searchRef.current &&
        search.length > 0
      ) {
        return
      }
      event.preventDefault()
      bumpPiece(-1)
    },
    { enableOnFormTags: true },
  )

  const phoneRegister = register('phone')

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">POS</h1>
          <p className="text-sm text-muted-foreground">
            Scan or search, Enter to add, F9 for cash, F12 to complete and print.
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="pos-search">Search / barcode</FieldLabel>
          <div className="relative">
            <Input
              id="pos-search"
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
                  <li className="px-3 py-2 text-muted-foreground">No matching items.</li>
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
                          {variant.barcode} · {formatRs(variant.salePriceRs)} ·{' '}
                          {formatQuantity(variant.quantityMilli, variant.unit)} in stock
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        </Field>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
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
                    const unitPriceRs = Number(item.unitPriceRs) || 0
                    const lineDiscount = Number(item.lineDiscountRs) || 0
                    const lineTotal = lineTotalRs(
                      toMilli(quantity),
                      unitPriceRs,
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
                            aria-label={`Price of ${variantOptionLabel(item)}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              openLineEdit('unitPriceRs', index)
                            }}
                          >
                            {formatRs(unitPriceRs)}
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
                              openLineEdit('lineDiscountRs', index)
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

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>
            Qty <Kbd>{POS_HOTKEYS.quantity.label}</Kbd>
          </span>
          <span>
            Price <Kbd>{POS_HOTKEYS.price.label}</Kbd>
          </span>
          <span>
            Phone <Kbd>{POS_HOTKEYS.phone.label}</Kbd>
          </span>
          <span>
            Line discount <Kbd>{POS_HOTKEYS.lineDiscount.label}</Kbd>
          </span>
          <span>
            Remove <Kbd>Del</Kbd>
          </span>
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-4 border-t p-6 lg:w-80 lg:border-t-0 lg:border-l">
        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor="pos-phone">Phone</FieldLabel>
          <Input
            id="pos-phone"
            ref={(element) => {
              phoneRef.current = element
              phoneRegister.ref(element)
            }}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            maxLength={20}
            placeholder="Optional"
            aria-invalid={!!errors.phone}
            name={phoneRegister.name}
            onChange={phoneRegister.onChange}
            onBlur={phoneRegister.onBlur}
          />
          <FieldError errors={[errors.phone]} />
        </Field>

        <div className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatRs(subtotal)}</span>
          </div>
          <button
            type="button"
            className="flex justify-between text-left text-muted-foreground"
            onClick={() => setLineEdit({ kind: 'billDiscount' })}
          >
            <span>
              Discount <Kbd>{POS_HOTKEYS.billDiscount.label}</Kbd>
            </span>
            <span>{Number(discountRs) > 0 ? formatRs(Number(discountRs)) : '—'}</span>
          </button>
          <div className="flex justify-between text-base font-medium">
            <span>Total</span>
            <span>{formatRs(totalRs)}</span>
          </div>
          <button
            type="button"
            className="flex justify-between text-left"
            onClick={() => {
              if (items.fields.length === 0) return
              setLineEdit({ kind: 'tendered' })
            }}
          >
            <span>
              Tendered <Kbd>{POS_HOTKEYS.tendered.label}</Kbd>
            </span>
            <span>{tendered > 0 ? formatRs(tendered) : '—'}</span>
          </button>
          <div className="flex justify-between">
            <span>Change</span>
            <span>
              {tendered >= totalRs && items.fields.length > 0 ? formatRs(changeRs) : '—'}
            </span>
          </div>
          <FieldError errors={[errors.discountRs, errors.tenderedRs]} />
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={items.fields.length === 0 || isSubmitting}
              onClick={() => void holdCurrent()}
            >
              Hold
              {holds.length > 0 ? (
                <Badge variant="secondary">{holds.length}</Badge>
              ) : null}
              <Kbd>{POS_HOTKEYS.hold.label}</Kbd>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRecallIndex(0)
                setRecallOpen(true)
                void holdsQuery.refetch()
              }}
            >
              Recall
              <Kbd>{POS_HOTKEYS.recall.label}</Kbd>
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={(items.fields.length === 0 && !phone) || isSubmitting}
            onClick={() => setVoidOpen(true)}
          >
            Void
            <Kbd>{POS_HOTKEYS.voidSale.label}</Kbd>
          </Button>
          <Button
            type="button"
            disabled={items.fields.length === 0 || isSubmitting}
            onClick={requestComplete}
          >
            Complete
            <Kbd className="bg-primary-foreground/20 text-primary-foreground">
              {POS_HOTKEYS.complete.label}
            </Kbd>
          </Button>
        </div>
      </aside>

      <NumberEditDialog
        open={lineEdit !== null}
        title={
          lineEdit?.kind === 'quantity'
            ? 'Quantity'
            : lineEdit?.kind === 'unitPriceRs'
              ? 'Price'
              : lineEdit?.kind === 'lineDiscountRs'
                ? 'Line discount'
                : lineEdit?.kind === 'billDiscount'
                  ? 'Bill discount'
                  : 'Amount tendered'
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
          if (lineEdit.kind === 'tendered') {
            setValue('tenderedRs', value, { shouldDirty: true, shouldValidate: true })
            return
          }
          setValue(`items.${lineEdit.index}.${lineEdit.kind}`, value, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }}
      />

      <HoldRecallDialog
        open={recallOpen}
        holds={holds}
        selectedIndex={recallSelected}
        onOpenChange={setRecallOpen}
        onSelect={setRecallIndex}
        onRecall={requestRecall}
      />

      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this sale?</AlertDialogTitle>
            <AlertDialogDescription>
              The cart is cleared. Held sales are not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                clearSale()
                setVoidOpen(false)
              }}
            >
              Void
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingRecall !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRecall(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Park this sale first?</AlertDialogTitle>
            <AlertDialogDescription>
              The cart has items. Hold it, or discard it, then recall.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const hold = pendingRecall
                setPendingRecall(null)
                if (hold) void applyHold(hold)
              }}
            >
              Discard
            </Button>
            <AlertDialogAction onClick={() => void holdThenRecall()}>
              Hold
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDiscard !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDiscard(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this hold?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDiscard
                ? `${pendingDiscard.phone || 'Walk-in'} · ${formatRs(pendingDiscard.totalRs)}. You cannot undo it.`
                : 'You cannot undo it.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDiscard) void discardHold(pendingDiscard)
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function PosPage(): React.JSX.Element {
  const catalogQuery = usePosCatalogQuery()

  if (catalogQuery.isPending) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    )
  }

  if (catalogQuery.isError) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <p className="text-sm text-destructive">
          {catalogQuery.error instanceof Error
            ? catalogQuery.error.message
            : 'Could not load the sale screen.'}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void catalogQuery.refetch()}
        >
          Try again
        </Button>
      </div>
    )
  }

  return <PosSale variants={catalogQuery.data ?? EMPTY_VARIANTS} />
}
