import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import type { LabelVariant } from '@shared/schemas/catalog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { LABELS_PER_PAGE, variantOptionLabel } from './label-layout'
import { LabelSheets } from './label-sheet'
import { useLabelVariantsQuery } from './use-catalog'

const EMPTY_VARIANTS: LabelVariant[] = []
const PREVIEW_SCALE = 0.38

function expandCopies(
  variants: LabelVariant[],
  copies: Record<number, number>,
): LabelVariant[] {
  const stickers: LabelVariant[] = []
  for (const variant of variants) {
    const count = copies[variant.variantId] ?? 0
    for (let index = 0; index < count; index += 1) {
      stickers.push(variant)
    }
  }
  return stickers
}

function matchesSearch(variant: LabelVariant, search: string): boolean {
  if (!search) return true
  const haystack = [
    variant.productName,
    variant.barcode,
    variant.size ?? '',
    variant.colour ?? '',
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(search)
}

export function LabelsDialog({
  open,
  onOpenChange,
  shopName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  shopName: string
}): React.JSX.Element {
  const variantsQuery = useLabelVariantsQuery(open)
  const [search, setSearch] = useState('')
  const [copies, setCopies] = useState<Record<number, number>>({})
  const variants = variantsQuery.data ?? EMPTY_VARIANTS
  const query = search.trim().toLowerCase()
  const visible = useMemo(
    () => variants.filter((variant) => matchesSearch(variant, query)),
    [query, variants],
  )
  const stickers = useMemo(() => expandCopies(variants, copies), [copies, variants])
  const selectedCount = stickers.length
  const pageCount = selectedCount === 0 ? 0 : Math.ceil(selectedCount / LABELS_PER_PAGE)

  function setCopyCount(variantId: number, value: number): void {
    const next = Number.isFinite(value) ? Math.min(99, Math.max(0, Math.round(value))) : 0
    setCopies((current) => ({ ...current, [variantId]: next }))
  }

  function selectVisible(selected: boolean): void {
    setCopies((current) => {
      const next = { ...current }
      for (const variant of visible) {
        next[variant.variantId] = selected ? Math.max(next[variant.variantId] ?? 0, 1) : 0
      }
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-6xl"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>Barcode labels</DialogTitle>
          <DialogDescription>
            24 labels per A4 sheet, Code 128. Pick a regular printer in the print dialog,
            not the receipt printer.
          </DialogDescription>
        </DialogHeader>

        {variantsQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading variants…</p>
        ) : variantsQuery.isError ? (
          <p className="text-sm text-destructive">
            {variantsQuery.error instanceof Error
              ? variantsQuery.error.message
              : 'Could not load variants.'}
          </p>
        ) : (
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col gap-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, barcode, size"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectVisible(true)}
                >
                  Select visible
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => selectVisible(false)}
                >
                  Clear
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto rounded-xl ring-1 ring-foreground/10">
                {visible.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    No matching variants.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {visible.map((variant) => {
                      const count = copies[variant.variantId] ?? 0
                      return (
                        <li
                          key={variant.variantId}
                          className="flex items-center gap-2 px-3 py-2"
                        >
                          <Checkbox
                            checked={count > 0}
                            onCheckedChange={(checked) =>
                              setCopyCount(
                                variant.variantId,
                                checked === true ? Math.max(count, 1) : 0,
                              )
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">
                              {variantOptionLabel(variant)}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {variant.barcode}
                            </p>
                          </div>
                          <Input
                            className="w-16"
                            type="number"
                            min={0}
                            max={99}
                            step={1}
                            value={count}
                            onChange={(event) =>
                              setCopyCount(
                                variant.variantId,
                                Number.parseInt(event.target.value, 10),
                              )
                            }
                            aria-label={`Copies of ${variantOptionLabel(variant)}`}
                          />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="relative isolate min-h-0 overflow-auto rounded-xl bg-muted/40 p-3">
              <div
                className="origin-top-left"
                style={{
                  transform: `scale(${PREVIEW_SCALE})`,
                  width: `${100 / PREVIEW_SCALE}%`,
                }}
              >
                <LabelSheets variants={stickers} shopName={shopName} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedCount === 0
              ? 'No labels selected'
              : `${selectedCount} label${selectedCount === 1 ? '' : 's'} · ${pageCount} sheet${
                  pageCount === 1 ? '' : 's'
                }`}
          </p>
          <Button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => window.print()}
          >
            <Printer />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>

      {open && selectedCount > 0
        ? createPortal(
            <div className="hidden print:block">
              <LabelSheets variants={stickers} shopName={shopName} />
            </div>,
            document.body,
          )
        : null}
    </Dialog>
  )
}
