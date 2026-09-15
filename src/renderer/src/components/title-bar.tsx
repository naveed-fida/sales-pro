import logoUrl from '@/assets/logo.svg'
import { cn } from '@/lib/utils'
import { isMac } from '@/lib/platform'

export function TitleBar(): React.JSX.Element {
  return (
    <header
      className={cn(
        'title-bar relative z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-sidebar px-3 select-none',
        isMac() && 'pl-20',
      )}
    >
      <img src={logoUrl} alt="" width={20} height={20} className="size-5 rounded-md" />
      <p className="text-sm font-semibold tracking-tight">Sales Pro</p>
    </header>
  )
}
