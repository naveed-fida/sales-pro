import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { cn } from 'cn'
import { lineTotalRs, refundPortionRs } from '@shared/cost'
import { formatRs } from '@shared/money'
import { formatQuantity, fromMilli, toMilli } from '@shared/quantity'
import { lookupReturnSchema, type ReturnBill } from '@shared/schemas/returns'
import type { PosCatalogVariant } from '@shared/schemas/sales'
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
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UNIT_LABELS } from '@/features/products/unit-labels'
import { labelVariantsQueryKey, productsQueryKey } from '@/features/products/use-catalog'
import { posCatalogQueryKey, usePosCatalogQuery } from '@/features/pos/use-pos'
import { purchaseCatalogQueryKey } from '@/features/purchases/use-purchases'
import { reportsQueryKey } from '@/features/reports/use-reports'
import { SALE_STATUS_LABELS } from '@/features/sales/status-labels'
import { salesQueryKey } from '@/features/sales/use-sales'
import { RETURN_HOTKEYS } from '@/lib/hotkeys'
import { returnsQueryKey } from './use-returns'

const EMPTY_VARIANTS: PosCatalogVariant[] = []

type ExchangeLine = {
  variantId: number
  productName: string
  barcode: string
  size: string | null
  colour: string | null
  unit: PosCatalogVariant['unit']
  quantity: number
  unitPriceRs: number
  lineDiscountRs: number
}

type Edit =
  | { kind: 'returnQty' }
  | { kind: 'exchangeQty'; index: number }
  | { kind: 'exchangePrice'; index: number }
  | { kind: 'exchangeDiscount'; index: number }
  | { kind: 'tendered' }

function displayQty(milli: number, unit: ReturnBill['items'][number]['unit']): number {
  const value = fromMilli(milli)
  return unit === 'piece' ? Math.round(value) : value
}

function lineRefundRs(item: ReturnBill['items'][number], quantity: number): number {
  return refundPortionRs(
    item.netRs,
    item.soldMilli,
    toMilli(quantity),
    item.remainingMilli,
    item.remainingRefundRs,
  )
}

function matchesSearch(variant: PosCatalogVariant, query: string): boolean {
  if (!query) return false
  return [variant.productName, variant.barcode, variant.size ?? '', variant.colour ?? '']
    .join(' ')
    .toLowerCase()
    .includes(query)
}

function exchangeLineTotal(line: ExchangeLine): number {
  return lineTotalRs(toMilli(line.quantity), line.unitPriceRs, line.lineDiscountRs)
}

export function ReturnEntryPage(): React.JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const catalogQuery = usePosCatalogQuery()
  const searchRef = useRef<HTMLInputElement>(null)
  const productSearchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [bill, setBill] = useState<ReturnBill | null>(null)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [selectedIndexRaw, setSelectedIndex] = useState(0)
  const [exchangeItems, setExchangeItems] = useState<ExchangeLine[]>([])
  const [exchangeIndexRaw, setExchangeIndex] = useState(0)
  const [zone, setZone] = useState<'return' | 'exchange'>('return')
  const [tenderedRs, setTenderedRs] = useState(0)
  const [edit, setEdit] = useState<Edit | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const variants = catalogQuery.data ?? EMPTY_VARIANTS
  const selectedIndex =
    bill === null || bill.items.length === 0
      ? 0
      : Math.min(selectedIndexRaw, bill.items.length - 1)
  const selected = bill?.items[selectedIndex]
  const exchangeIndex =
    exchangeItems.length === 0 ? 0 : Math.min(exchangeIndexRaw, exchangeItems.length - 1)
  const selectedExchange = exchangeItems[exchangeIndex]
  const query = productSearch.trim().toLowerCase()
  const resultsOpen = Boolean(bill) && query.length > 0
  const results = useMemo(
    () => variants.filter((variant) => matchesSearch(variant, query)),
    [query, variants],
  )
  const exact = useMemo(
    () => variants.find((variant) => variant.barcode.toLowerCase() === query),
    [query, variants],
  )
  const blocked = edit !== null || confirmOpen || lookingUp || submitting
  const returnLines = useMemo(() => {
    if (!bill) return []
    return bill.items.flatMap((item) => {
      const quantity = quantities[item.saleItemId] ?? 0
      if (quantity <= 0) return []
      return [{ saleItemId: item.saleItemId, quantity }]
    })
  }, [bill, quantities])
  const refundRs = useMemo(() => {
    if (!bill) return 0
    return bill.items.reduce(
      (sum, item) => sum + lineRefundRs(item, quantities[item.saleItemId] ?? 0),
      0,
    )
  }, [bill, quantities])
  const exchangeTotalRs = useMemo(
    () => exchangeItems.reduce((sum, line) => sum + exchangeLineTotal(line), 0),
    [exchangeItems],
  )
  const dueRs = Math.max(0, exchangeTotalRs - refundRs)
  const netRefundRs = Math.max(0, refundRs - exchangeTotalRs)
  const remainingDisplay = selected
    ? displayQty(selected.remainingMilli, selected.unit)
    : 0
  const returnQtyValue = selected
    ? (quantities[selected.saleItemId] ?? 0) || remainingDisplay
    : 0

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  function focusBillSearch(): void {
    searchRef.current?.focus()
    searchRef.current?.select()
  }

  function focusProductSearch(): void {
    productSearchRef.current?.focus()
    productSearchRef.current?.select()
  }

  function goToList(): void {
    navigate('/returns')
  }

  function resetWork(): void {
    setBill(null)
    setQuantities({})
    setSelectedIndex(0)
    setExchangeItems([])
    setExchangeIndex(0)
    setZone('return')
    setTenderedRs(0)
    setEdit(null)
    setConfirmOpen(false)
    setProductSearch('')
    setHighlight(0)
  }

  async function lookupBill(): Promise<void> {
    const parsed = lookupReturnSchema.safeParse({ billNo: search.trim() })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Enter a bill number.')
      return
    }
    setLookingUp(true)
    const result = await window.api.returns.lookup(parsed.data)
    setLookingUp(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    setBill(result.data)
    setQuantities({})
    setSelectedIndex(0)
    setExchangeItems([])
    setExchangeIndex(0)
    setZone('return')
    setTenderedRs(0)
    setProductSearch('')
    setSearch(String(result.data.billNo))
    window.setTimeout(() => focusProductSearch(), 0)
  }

  function setLineQuantity(saleItemId: number, quantity: number, max: number): void {
    const next = Math.min(Math.max(0, quantity), max)
    setQuantities((current) => ({ ...current, [saleItemId]: next }))
  }

  function addVariant(variant: PosCatalogVariant): void {
    setExchangeItems((current) => {
      const existingIndex = current.findIndex(
        (item) => item.variantId === variant.variantId,
      )
      if (existingIndex >= 0) {
        const existing = current[existingIndex]
        if (!existing) return current
        setExchangeIndex(existingIndex)
        return current.map((item, index) =>
          index === existingIndex ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }
      setExchangeIndex(current.length)
      return [
        ...current,
        {
          variantId: variant.variantId,
          productName: variant.productName,
          barcode: variant.barcode,
          size: variant.size,
          colour: variant.colour,
          unit: variant.unit,
          quantity: 1,
          unitPriceRs: variant.salePriceRs,
          lineDiscountRs: 0,
        },
      ]
    })
    setZone('exchange')
    setProductSearch('')
    setHighlight(0)
    focusProductSearch()
  }

  function addFromSearch(): void {
    if (exact) {
      addVariant(exact)
      return
    }
    const picked = results[highlight]
    if (picked) addVariant(picked)
  }

  function updateExchange(index: number, patch: Partial<ExchangeLine>): void {
    setExchangeItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    )
  }

  function removeExchange(index: number): void {
    setExchangeItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
    setExchangeIndex((current) => Math.max(0, Math.min(current, index - 1)))
    focusProductSearch()
  }

  function openReturnQuantity(): void {
    if (!selected || selected.remainingMilli <= 0) return
    setZone('return')
    setEdit({ kind: 'returnQty' })
  }

  function openExchangeEdit(
    kind: 'exchangeQty' | 'exchangePrice' | 'exchangeDiscount',
  ): void {
    if (exchangeItems.length === 0) return
    setZone('exchange')
    setEdit({ kind, index: exchangeIndex })
  }

  function bumpPiece(delta: number): void {
    if (zone === 'exchange') {
      const line = selectedExchange
      if (!line || line.unit !== 'piece') return
      updateExchange(exchangeIndex, { quantity: Math.max(1, line.quantity + delta) })
      return
    }
    if (!selected || selected.unit !== 'piece' || selected.remainingMilli <= 0) return
    const max = displayQty(selected.remainingMilli, selected.unit)
    const current = quantities[selected.saleItemId] ?? 0
    setLineQuantity(selected.saleItemId, current + delta, max)
  }

  function requestComplete(): void {
    if (!bill || submitting) return
    if (
      bill.status === 'returned' ||
      bill.items.every((item) => item.remainingMilli <= 0)
    ) {
      toast.error('This bill is already returned.')
      return
    }
    if (returnLines.length === 0) {
      toast.error('Set a return quantity with F2.')
      return
    }
    if (dueRs > 0 && tenderedRs < dueRs) {
      setEdit({ kind: 'tendered' })
      return
    }
    setConfirmOpen(true)
  }

  async function submitReturn(): Promise<void> {
    if (!bill || returnLines.length === 0 || submitting) return
    setSubmitting(true)
    const result = await window.api.returns.complete({
      saleId: bill.saleId,
      items: returnLines,
      exchangeItems: exchangeItems.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        unitPriceRs: item.unitPriceRs,
        lineDiscountRs: item.lineDiscountRs,
      })),
      tenderedRs,
    })
    setSubmitting(false)
    setConfirmOpen(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    const net = result.data.totalRs - result.data.exchangeTotalRs
    if (result.data.exchangeTotalRs > 0) {
      toast.success(
        net === 0
          ? `Exchanged bill ${result.data.billNo}`
          : net > 0
            ? `Exchanged bill ${result.data.billNo} · refund ${formatRs(net)}`
            : `Exchanged bill ${result.data.billNo} · due ${formatRs(-net)}`,
      )
    } else {
      toast.success(
        `Returned bill ${result.data.billNo} · ${formatRs(result.data.totalRs)}`,
      )
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: salesQueryKey }),
      queryClient.invalidateQueries({ queryKey: reportsQueryKey }),
      queryClient.invalidateQueries({ queryKey: returnsQueryKey }),
      queryClient.invalidateQueries({ queryKey: posCatalogQueryKey }),
      queryClient.invalidateQueries({ queryKey: purchaseCatalogQueryKey }),
      queryClient.invalidateQueries({ queryKey: productsQueryKey }),
      queryClient.invalidateQueries({ queryKey: labelVariantsQueryKey }),
    ])
    goToList()
    try {
      const printed = await window.api.returns.print(result.data.id)
      if (!printed.ok) toast.error(printed.error.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not print the receipt.')
    }
  }

  useHotkeys(
    RETURN_HOTKEYS.quantity.combo,
    (event) => {
      event.preventDefault()
      if (blocked) return
      if (zone === 'exchange') {
        openExchangeEdit('exchangeQty')
        return
      }
      openReturnQuantity()
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    RETURN_HOTKEYS.price.combo,
    (event) => {
      event.preventDefault()
      if (blocked) return
      openExchangeEdit('exchangePrice')
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    RETURN_HOTKEYS.lineDiscount.combo,
    (event) => {
      event.preventDefault()
      if (blocked) return
      openExchangeEdit('exchangeDiscount')
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    RETURN_HOTKEYS.tendered.combo,
    (event) => {
      event.preventDefault()
      if (blocked) return
      if (dueRs <= 0) return
      setEdit({ kind: 'tendered' })
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    RETURN_HOTKEYS.complete.combo,
    (event) => {
      event.preventDefault()
      if (edit !== null || lookingUp || submitting) return
      if (confirmOpen) {
        void submitReturn()
        return
      }
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
      if (blocked) return
      if (resultsOpen) {
        setHighlight((current) => Math.max(0, current - 1))
        return
      }
      if (zone === 'exchange') {
        setExchangeIndex((current) => Math.max(0, current - 1))
        return
      }
      if (!bill) return
      setSelectedIndex((current) => Math.max(0, current - 1))
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    'down',
    (event) => {
      event.preventDefault()
      if (blocked) return
      if (resultsOpen) {
        setHighlight((current) => Math.min(Math.max(results.length - 1, 0), current + 1))
        return
      }
      if (zone === 'exchange') {
        setExchangeIndex((current) => Math.min(exchangeItems.length - 1, current + 1))
        return
      }
      if (!bill) return
      setSelectedIndex((current) => Math.min(bill.items.length - 1, current + 1))
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    'backspace,delete',
    (event) => {
      if (blocked || zone !== 'exchange' || exchangeItems.length === 0) return
      const target = event.target
      if (target instanceof HTMLInputElement && target.value.length > 0) {
        return
      }
      event.preventDefault()
      removeExchange(exchangeIndex)
    },
    { enableOnFormTags: true },
  )
  useHotkeys(
    'esc',
    (event) => {
      if (edit !== null || confirmOpen) return
      event.preventDefault()
      if (productSearch.length > 0) {
        setProductSearch('')
        setHighlight(0)
        focusProductSearch()
        return
      }
      if (bill) {
        resetWork()
        setSearch('')
        focusBillSearch()
        return
      }
      if (search.length > 0) {
        setSearch('')
        focusBillSearch()
        return
      }
      goToList()
    },
    { enableOnFormTags: true },
  )
  useHotkeys(
    '+,=,numpadadd',
    (event) => {
      if (blocked) return
      const target = event.target
      if (
        target instanceof HTMLInputElement &&
        ((target === searchRef.current && search.length > 0) ||
          (target === productSearchRef.current && productSearch.length > 0))
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
      if (
        target instanceof HTMLInputElement &&
        ((target === searchRef.current && search.length > 0) ||
          (target === productSearchRef.current && productSearch.length > 0))
      ) {
        return
      }
      event.preventDefault()
      bumpPiece(-1)
    },
    { enableOnFormTags: true },
  )

  const exchanging = exchangeItems.length > 0
  const editLine =
    edit && 'index' in edit ? (exchangeItems[edit.index] ?? null) : selectedExchange
  const editValue =
    edit?.kind === 'returnQty'
      ? returnQtyValue
      : edit?.kind === 'exchangeQty'
        ? (editLine?.quantity ?? 0)
        : edit?.kind === 'exchangePrice'
          ? (editLine?.unitPriceRs ?? 0)
          : edit?.kind === 'exchangeDiscount'
            ? (editLine?.lineDiscountRs ?? 0)
            : tenderedRs
  const editInteger =
    edit?.kind === 'returnQty'
      ? selected?.unit === 'piece'
      : edit?.kind === 'exchangeQty'
        ? editLine?.unit === 'piece'
        : true
  const confirmCopy = bill
    ? exchanging
      ? dueRs > 0
        ? `Take ${formatRs(exchangeTotalRs)} against a ${formatRs(refundRs)} return on bill ${bill.billNo}. Due ${formatRs(dueRs)}.`
        : netRefundRs > 0
          ? `Take ${formatRs(exchangeTotalRs)} against a ${formatRs(refundRs)} return on bill ${bill.billNo}. Refund ${formatRs(netRefundRs)}.`
          : `Even exchange on bill ${bill.billNo}.`
      : `Refund ${formatRs(refundRs)} on bill ${bill.billNo}. Stock goes back on the shelf.`
    : 'Stock goes back on the shelf.'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">New return</h1>
            <p className="text-sm text-muted-foreground">
              Type a bill number, F2 to return, scan to exchange, F12 to complete and
              print.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={goToList}>
            Cancel
          </Button>
        </div>

        <Field>
          <FieldLabel htmlFor="return-bill">Bill number</FieldLabel>
          <Input
            id="return-bill"
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void lookupBill()
              }
            }}
            inputMode="numeric"
            placeholder="e.g. 12"
            autoComplete="off"
            disabled={lookingUp || submitting}
          />
        </Field>

        {bill === null ? (
          <p className="text-sm text-muted-foreground">
            Load a completed bill to return lines or exchange them for something else.
          </p>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor="return-exchange-search">Exchange item</FieldLabel>
              <div className="relative">
                <Input
                  id="return-exchange-search"
                  ref={productSearchRef}
                  value={productSearch}
                  onChange={(event) => {
                    setProductSearch(event.target.value)
                    setHighlight(0)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addFromSearch()
                    }
                  }}
                  placeholder="Scan or search to take a replacement"
                  autoComplete="off"
                  disabled={lookingUp || submitting}
                />
                {resultsOpen ? (
                  <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl bg-popover p-1 text-sm shadow-md ring-1 ring-foreground/10">
                    {results.length === 0 ? (
                      <li className="px-3 py-2 text-muted-foreground">
                        No matching items.
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
                              {variant.barcode} · {formatRs(variant.salePriceRs)} ·{' '}
                              {formatQuantity(variant.quantityMilli, variant.unit)} in
                              stock
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </div>
            </Field>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
              <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
                <table className="w-full caption-bottom text-sm">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Return</TableHead>
                      <TableHead>Sold</TableHead>
                      <TableHead>Returned</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead className="text-right">Refund</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bill.items.map((item, index) => {
                      const quantity = quantities[item.saleItemId] ?? 0
                      const done = item.remainingMilli <= 0
                      return (
                        <TableRow
                          key={item.saleItemId}
                          className={cn(
                            'cursor-pointer',
                            zone === 'return' && index === selectedIndex && 'bg-muted',
                            done && 'text-muted-foreground',
                          )}
                          onClick={() => {
                            setZone('return')
                            setSelectedIndex(index)
                          }}
                        >
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{variantOptionLabel(item)}</span>
                              <span className="text-xs text-muted-foreground">
                                {item.barcode} · {UNIT_LABELS[item.unit]}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatQuantity(item.soldMilli, item.unit)}
                          </TableCell>
                          <TableCell>
                            {formatQuantity(item.returnedMilli, item.unit)}
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="text-left"
                              disabled={done}
                              onClick={(event) => {
                                event.stopPropagation()
                                setZone('return')
                                setSelectedIndex(index)
                                if (!done) setEdit({ kind: 'returnQty' })
                              }}
                            >
                              {quantity > 0
                                ? formatQuantity(toMilli(quantity), item.unit)
                                : '—'}
                            </button>
                          </TableCell>
                          <TableCell className="text-right">
                            {quantity > 0 ? formatRs(lineRefundRs(item, quantity)) : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </table>
              </div>

              <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
                <table className="w-full caption-bottom text-sm">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Take</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exchangeItems.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center text-muted-foreground"
                        >
                          Scan a replacement to exchange. Leave empty for a refund only.
                        </TableCell>
                      </TableRow>
                    ) : (
                      exchangeItems.map((item, index) => (
                        <TableRow
                          key={item.variantId}
                          className={cn(
                            'cursor-pointer',
                            zone === 'exchange' && index === exchangeIndex && 'bg-muted',
                          )}
                          onClick={() => {
                            setZone('exchange')
                            setExchangeIndex(index)
                          }}
                        >
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{variantOptionLabel(item)}</span>
                              <span className="text-xs text-muted-foreground">
                                {item.barcode} · {UNIT_LABELS[item.unit]}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="text-left"
                              onClick={(event) => {
                                event.stopPropagation()
                                setZone('exchange')
                                setExchangeIndex(index)
                                setEdit({ kind: 'exchangeQty', index })
                              }}
                            >
                              {formatQuantity(toMilli(item.quantity), item.unit)}
                            </button>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="text-left"
                              onClick={(event) => {
                                event.stopPropagation()
                                setZone('exchange')
                                setExchangeIndex(index)
                                setEdit({ kind: 'exchangePrice', index })
                              }}
                            >
                              {formatRs(item.unitPriceRs)}
                            </button>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="text-left"
                              onClick={(event) => {
                                event.stopPropagation()
                                setZone('exchange')
                                setExchangeIndex(index)
                                setEdit({ kind: 'exchangeDiscount', index })
                              }}
                            >
                              {item.lineDiscountRs > 0
                                ? formatRs(item.lineDiscountRs)
                                : '—'}
                            </button>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatRs(exchangeLineTotal(item))}
                          </TableCell>
                          <TableCell className="w-10">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={(event) => {
                                event.stopPropagation()
                                removeExchange(index)
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-4 border-t p-6 lg:w-80 lg:border-t-0 lg:border-l">
        {bill ? (
          <>
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-base font-medium">Bill {bill.billNo}</p>
              <p className="text-muted-foreground">
                {format(new Date(bill.createdAt), 'd MMM yyyy, h:mm a')}
              </p>
              <p className="text-muted-foreground">
                {bill.phone || 'No phone'} · {SALE_STATUS_LABELS[bill.status]}
              </p>
              {bill.discountRs > 0 ? (
                <p className="text-muted-foreground">
                  Bill discount {formatRs(bill.discountRs)}
                </p>
              ) : null}
              <div className="mt-2 flex justify-between">
                <span>Returned</span>
                <span>{formatRs(refundRs)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taken</span>
                <span>{formatRs(exchangeTotalRs)}</span>
              </div>
              {dueRs > 0 ? (
                <>
                  <div className="flex justify-between text-base font-medium">
                    <span>Due</span>
                    <span>{formatRs(dueRs)}</span>
                  </div>
                  <button
                    type="button"
                    className="flex justify-between text-left"
                    onClick={() => setEdit({ kind: 'tendered' })}
                  >
                    <span>Cash</span>
                    <span>{formatRs(tenderedRs)}</span>
                  </button>
                  <div className="flex justify-between">
                    <span>Change</span>
                    <span>{formatRs(Math.max(0, tenderedRs - dueRs))}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-base font-medium">
                  <span>Refund</span>
                  <span>{formatRs(netRefundRs)}</span>
                </div>
              )}
            </div>
            <div className="mt-auto flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={
                  submitting ||
                  (zone === 'exchange'
                    ? exchangeItems.length === 0
                    : !selected || selected.remainingMilli <= 0)
                }
                onClick={() => {
                  if (zone === 'exchange') {
                    openExchangeEdit('exchangeQty')
                    return
                  }
                  openReturnQuantity()
                }}
              >
                Quantity
                <Kbd>{RETURN_HOTKEYS.quantity.label}</Kbd>
              </Button>
              {dueRs > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => setEdit({ kind: 'tendered' })}
                >
                  Cash
                  <Kbd>{RETURN_HOTKEYS.tendered.label}</Kbd>
                </Button>
              ) : null}
              <Button type="button" disabled={submitting} onClick={requestComplete}>
                {exchanging ? 'Exchange' : 'Return'}
                <Kbd className="bg-primary-foreground/20 text-primary-foreground">
                  {RETURN_HOTKEYS.complete.label}
                </Kbd>
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Refund is the share of what the customer paid. Scan a replacement to exchange
            and settle the difference.
          </p>
        )}
      </aside>

      <NumberEditDialog
        key={
          edit?.kind === 'returnQty'
            ? `return-${selected?.saleItemId ?? 'qty'}`
            : edit
              ? `${edit.kind}-${'index' in edit ? edit.index : 'cash'}`
              : 'closed'
        }
        open={edit !== null}
        title={
          edit?.kind === 'returnQty'
            ? 'Return quantity'
            : edit?.kind === 'exchangeQty'
              ? 'Quantity'
              : edit?.kind === 'exchangePrice'
                ? 'Price'
                : edit?.kind === 'exchangeDiscount'
                  ? 'Line discount'
                  : 'Amount tendered'
        }
        description="Enter confirms. Esc cancels."
        label={
          edit?.kind === 'returnQty'
            ? selected
              ? UNIT_LABELS[selected.unit]
              : 'Quantity'
            : edit?.kind === 'exchangeQty'
              ? editLine
                ? UNIT_LABELS[editLine.unit]
                : 'Quantity'
              : 'Rs'
        }
        value={editValue}
        kind={
          edit?.kind === 'returnQty' || edit?.kind === 'exchangeQty'
            ? 'quantity'
            : 'money'
        }
        integer={editInteger}
        max={edit?.kind === 'returnQty' ? remainingDisplay || undefined : undefined}
        onOpenChange={(open) => {
          if (!open) setEdit(null)
        }}
        onSave={(value) => {
          if (edit === null) return
          if (edit.kind === 'returnQty') {
            if (!selected) return
            setLineQuantity(selected.saleItemId, value, remainingDisplay)
            return
          }
          if (edit.kind === 'tendered') {
            setTenderedRs(value)
            return
          }
          if (edit.kind === 'exchangeQty') {
            if (value <= 0) {
              removeExchange(edit.index)
              return
            }
            updateExchange(edit.index, { quantity: value })
            return
          }
          if (edit.kind === 'exchangePrice') {
            updateExchange(edit.index, { unitPriceRs: value })
            return
          }
          updateExchange(edit.index, { lineDiscountRs: value })
        }}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {exchanging ? 'Exchange these items?' : 'Return these items?'}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmCopy}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(event) => {
                event.preventDefault()
                void submitReturn()
              }}
            >
              {exchanging ? 'Exchange' : 'Return'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
