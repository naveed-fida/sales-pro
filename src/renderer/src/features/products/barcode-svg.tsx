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
        fontSize: 9,
        height: 26,
        width: 1,
        margin: 2,
        background: '#ffffff',
        lineColor: '#000000',
        font: 'monospace',
        textMargin: 0,
      })
    } catch {
      svg.replaceChildren()
    }
  }, [value])

  return <svg ref={ref} className={className} role="img" aria-label={value} />
}
