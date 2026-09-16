import { cn } from '@/lib/utils'
import { isMac } from '@/lib/platform'

export function TitleBar(): React.JSX.Element {
  return (
    <header
      className={cn(
        'title-bar relative z-20 flex h-11 shrink-0 items-center gap-2 border-b bg-sidebar px-3 select-none',
        isMac() && 'pl-20',
      )}
    ></header>
  )
}
