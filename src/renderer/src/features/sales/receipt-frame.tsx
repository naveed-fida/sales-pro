import { productImageSrc } from '@shared/product-image'
import type { AppSettings } from '@shared/schemas/settings'

export function ReceiptFrame({
  settings,
  children,
}: {
  settings: AppSettings
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="w-[80mm] bg-white p-[3mm] font-sans text-[11px] leading-tight text-black">
      <div className="text-center">
        {settings.shopLogo ? (
          <img
            src={productImageSrc(settings.shopLogo)}
            alt=""
            className="mx-auto mb-1.5 h-[16mm] w-auto max-w-[48mm] object-contain"
          />
        ) : null}
        <p className="text-sm font-semibold">{settings.shopName || 'Sales Pro'}</p>
        {settings.shopAddress ? (
          <p className="whitespace-pre-wrap">{settings.shopAddress}</p>
        ) : null}
        {settings.shopPhone ? <p>{settings.shopPhone}</p> : null}
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      {children}

      {settings.receiptFooter ? (
        <>
          <div className="my-2 border-t border-dashed border-black" />
          <p className="whitespace-pre-wrap text-center">{settings.receiptFooter}</p>
        </>
      ) : null}
    </div>
  )
}
