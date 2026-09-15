import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export function BarcodeSvg({
  value,
  className,
}: {
  value: string
  className?: string
}): React.JSX.Element {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = ref.current
    if (!svg || !value) return

    try {
      JsBarcode(svg, value, {
        format: 'CODE128',
        displayValue: true,
        fontSize: 11,
        height: 32,
        width: 1.15,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
        font: 'monospace',
        textMargin: 1,
      })
    } catch {
      svg.replaceChildren()
    }
  }, [value])

  return <svg ref={ref} className={className} role="img" aria-label={value} />
}
