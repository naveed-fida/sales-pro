import { ImageIcon } from 'lucide-react'
import { productImageSrc } from '@shared/product-image'
import { cn } from 'cn'

export function ProductImage({
  fileName,
  previewUrl,
  alt,
  className,
}: {
  fileName: string | null
  previewUrl?: string | null
  alt: string
  className?: string
}): React.JSX.Element {
  const src = previewUrl ?? (fileName ? productImageSrc(fileName) : null)

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden bg-muted text-muted-foreground',
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-1/2 max-h-8 max-w-8" />
      )}
    </div>
  )
}
