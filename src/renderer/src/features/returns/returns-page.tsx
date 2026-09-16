import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { cn } from 'cn'
import { refundPortionRs } from '@shared/cost'
import { formatRs } from '@shared/money'
import { formatQuantity, fromMilli, toMilli } from '@shared/quantity'
import { lookupReturnSchema, type ReturnBill } from '@shared/schemas/returns'
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
import { posCatalogQueryKey } from '@/features/pos/use-pos'
import { purchaseCatalogQueryKey } from '@/features/purchases/use-purchases'
import { SALE_STATUS_LABELS } from '@/features/sales/status-labels'
import { salesQueryKey } from '@/features/sales/use-sales'
import { RETURN_HOTKEYS } from '@/lib/hotkeys'

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

export function ReturnsPage(): React.JSX.Element {
  const queryClient = useQueryClient()
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [bill, setBill] = useState<ReturnBill | null>(null)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [selectedIndexRaw, setSelectedIndex] = useState(0)
  const [qtyOpen, setQtyOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const selectedIndex =
    bill === null || bill.items.length === 0
      ? 0
      : Math.min(selectedIndexRaw, bill.items.length - 1)
  const selected = bill?.items[selectedIndex]
  const blocked = qtyOpen || confirmOpen || lookingUp || submitting
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
  const remainingDisplay = selected
    ? displayQty(selected.remainingMilli, selected.unit)
    : 0
  const qtyValue = selected
    ? (quantities[selected.saleItemId] ?? 0) || remainingDisplay
    : 0

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  function focusSearch(): void {
    searchRef.current?.focus()
    searchRef.current?.select()
  }

  function clearBill(): void {
    setBill(null)
    setQuantities({})
    setSelectedIndex(0)
    setQtyOpen(false)
    setConfirmOpen(false)
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
    setSearch(String(result.data.billNo))
  }

  function setLineQuantity(saleItemId: number, quantity: number, max: number): void {
    const next = Math.min(Math.max(0, quantity), max)
    setQuantities((current) => ({ ...current, [saleItemId]: next }))
  }

  function openQuantity(): void {
    if (!selected || selected.remainingMilli <= 0) return
    setQtyOpen(true)
  }

  function bumpPiece(delta: number): void {
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
    setConfirmOpen(true)
  }

  async function submitReturn(): Promise<void> {
    if (!bill || returnLines.length === 0 || submitting) return
    setSubmitting(true)
    const result = await window.api.returns.complete({
      saleId: bill.saleId,
      items: returnLines,
    })
    setSubmitting(false)
    setConfirmOpen(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success(
      `Returned bill ${result.data.billNo} · ${formatRs(result.data.totalRs)}`,
    )
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: salesQueryKey }),
      queryClient.invalidateQueries({ queryKey: posCatalogQueryKey }),
      queryClient.invalidateQueries({ queryKey: purchaseCatalogQueryKey }),
      queryClient.invalidateQueries({ queryKey: productsQueryKey }),
      queryClient.invalidateQueries({ queryKey: labelVariantsQueryKey }),
    ])
    clearBill()
    setSearch('')
    focusSearch()
  }

  useHotkeys(
    RETURN_HOTKEYS.quantity.combo,
    (event) => {
      event.preventDefault()
      if (blocked) return
      openQuantity()
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    RETURN_HOTKEYS.complete.combo,
    (event) => {
      event.preventDefault()
      if (qtyOpen || lookingUp || submitting) return
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
      if (blocked || !bill) return
      setSelectedIndex((current) => Math.max(0, current - 1))
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    'down',
    (event) => {
      event.preventDefault()
      if (blocked || !bill) return
      setSelectedIndex((current) => Math.min(bill.items.length - 1, current + 1))
    },
    { enableOnFormTags: true, preventDefault: true },
  )
  useHotkeys(
    'esc',
    (event) => {
      if (qtyOpen || confirmOpen) return
      if (!bill && search.length === 0) return
      event.preventDefault()
      if (bill) {
        clearBill()
        setSearch('')
      } else {
        setSearch('')
      }
      focusSearch()
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Returns</h1>
          <p className="text-sm text-muted-foreground">
            Type a bill number, Enter to load, F2 for quantity, F12 to refund.
          </p>
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
            Load a completed bill to return lines and put stock back on the shelf.
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Item</TableHead>
                    <TableHead>Sold</TableHead>
                    <TableHead>Returned</TableHead>
                    <TableHead>Return</TableHead>
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
                          index === selectedIndex && 'bg-muted',
                          done && 'text-muted-foreground',
                        )}
                        onClick={() => setSelectedIndex(index)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{variantOptionLabel(item)}</span>
                            <span className="text-xs text-muted-foreground">
                              {item.barcode} · {UNIT_LABELS[item.unit]}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{formatQuantity(item.soldMilli, item.unit)}</TableCell>
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
                              setSelectedIndex(index)
                              if (!done) setQtyOpen(true)
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
          </div>
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
              <div className="mt-2 flex justify-between text-base font-medium">
                <span>Refund</span>
                <span>{formatRs(refundRs)}</span>
              </div>
            </div>
            <div className="mt-auto flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!selected || selected.remainingMilli <= 0 || submitting}
                onClick={openQuantity}
              >
                Quantity
                <Kbd>{RETURN_HOTKEYS.quantity.label}</Kbd>
              </Button>
              <Button type="button" disabled={submitting} onClick={requestComplete}>
                Return
                <Kbd className="bg-primary-foreground/20 text-primary-foreground">
                  {RETURN_HOTKEYS.complete.label}
                </Kbd>
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Refund is the share of what the customer paid, including bill discount.
          </p>
        )}
      </aside>

      <NumberEditDialog
        key={selected?.saleItemId ?? 'qty'}
        open={qtyOpen}
        title="Return quantity"
        description="Enter confirms. Esc cancels."
        label={selected ? UNIT_LABELS[selected.unit] : 'Quantity'}
        value={qtyValue}
        kind="quantity"
        integer={selected?.unit === 'piece'}
        max={remainingDisplay || undefined}
        onOpenChange={setQtyOpen}
        onSave={(value) => {
          if (!selected) return
          setLineQuantity(selected.saleItemId, value, remainingDisplay)
        }}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return these items?</AlertDialogTitle>
            <AlertDialogDescription>
              {bill
                ? `Refund ${formatRs(refundRs)} on bill ${bill.billNo}. Stock goes back on the shelf.`
                : 'Stock goes back on the shelf.'}
            </AlertDialogDescription>
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
              Return
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
