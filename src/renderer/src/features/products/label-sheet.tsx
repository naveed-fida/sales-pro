import { chunk } from 'lodash-es'
import { cn } from 'cn'
import { formatRs } from '@shared/money'
import type { LabelVariant } from '@shared/schemas/catalog'
import { BarcodeSvg } from './barcode-svg'
import { LABELS_PER_PAGE } from './label-layout'

function LabelSticker({
  variant,
  shopName,
}: {
  variant: LabelVariant | null
  shopName: string
}): React.JSX.Element {
  if (!variant) {
    return <div className="min-h-0" />
  }

  const detail = [variant.size, variant.colour].filter(Boolean).join(' · ')

  return (
    <div className="flex min-h-0 flex-col overflow-hidden border border-neutral-400 bg-white p-1.5 text-black">
      {shopName ? (
        <p className="truncate text-[8px] leading-tight text-neutral-600">{shopName}</p>
      ) : null}
      <p className="truncate text-[11px] leading-tight font-semibold">
        {variant.productName}
      </p>
      {detail ? <p className="truncate text-[9px] leading-tight">{detail}</p> : null}
      <p className="text-[11px] leading-tight font-medium">
        {formatRs(variant.salePriceRs)}
      </p>
      <BarcodeSvg value={variant.barcode} className="mt-auto w-full" />
    </div>
  )
}

export function LabelSheets({
  variants,
  shopName,
}: {
  variants: LabelVariant[]
  shopName: string
}): React.JSX.Element {
  const pages = chunk(variants, LABELS_PER_PAGE)

  if (pages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Tick variants on the left to fill the sheet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {pages.map((page, pageIndex) => {
        const cells = [
          ...page,
          ...Array.from({ length: LABELS_PER_PAGE - page.length }, () => null),
        ]

        return (
          <div
            key={pageIndex}
            className={cn(
              'flex h-[297mm] w-[210mm] flex-col bg-white p-[8mm] text-black shadow-sm ring-1 ring-foreground/10 print:shadow-none print:ring-0',
              pageIndex < pages.length - 1 && 'break-after-page',
            )}
          >
            <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-8 gap-[2mm]">
              {cells.map((variant, index) => (
                <LabelSticker
                  key={
                    variant
                      ? `${variant.variantId}-${pageIndex}-${index}`
                      : `empty-${index}`
                  }
                  variant={variant}
                  shopName={shopName}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
