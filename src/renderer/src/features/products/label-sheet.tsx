import { formatRs } from '@shared/money'
import type { LabelVariant } from '@shared/schemas/catalog'
import { BarcodeSvg } from './barcode-svg'

function LabelSticker({
  variant,
  shopName,
}: {
  variant: LabelVariant
  shopName: string
}): React.JSX.Element {
  const detail = [variant.size, variant.colour].filter(Boolean).join(' · ')

  return (
    <div className="label-print-page flex h-[25mm] w-[38mm] shrink-0 flex-col overflow-hidden bg-white px-[1mm] py-[0.75mm] text-black ring-1 ring-neutral-300 print:ring-0">
      {shopName ? (
        <p className="truncate text-[7px] leading-2 text-neutral-600">{shopName}</p>
      ) : null}
      <p className="truncate text-[10px] leading-2.75 font-semibold">
        {variant.productName}
      </p>
      <div className="flex min-w-0 items-baseline justify-between gap-1">
        <p className="min-w-0 truncate text-[8px] leading-2.25">{detail}</p>
        <p className="shrink-0 text-[9px] leading-2.5 font-semibold">
          {formatRs(variant.salePriceRs)}
        </p>
      </div>
      <BarcodeSvg
        value={variant.barcode}
        className="mt-auto max-h-[11mm] w-full overflow-visible"
      />
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
  if (variants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Tick variants on the left to add labels to the print batch.
      </p>
    )
  }

  return (
    <div className="label-print-batch flex flex-col gap-4 print:gap-0">
      {variants.map((variant, index) => (
        <LabelSticker
          key={`${variant.variantId}-${index}`}
          variant={variant}
          shopName={shopName}
        />
      ))}
    </div>
  )
}
