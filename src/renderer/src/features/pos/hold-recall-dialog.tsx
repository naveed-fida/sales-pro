import { format } from 'date-fns'
import { formatRs } from '@shared/money'
import type { HeldSale } from '@shared/schemas/sales'
import { cn } from 'cn'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'

export function HoldRecallDialog({
  open,
  holds,
  selectedIndex,
  onOpenChange,
  onSelect,
  onRecall,
}: {
  open: boolean
  holds: HeldSale[]
  selectedIndex: number
  onOpenChange: (open: boolean) => void
  onSelect: (index: number) => void
  onRecall: (hold: HeldSale) => void
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Held sales</DialogTitle>
          <DialogDescription>
            Enter resumes. Delete discards. Esc closes.
          </DialogDescription>
        </DialogHeader>
        {holds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No held sales.</p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-1 overflow-auto">
            {holds.map((hold, index) => (
              <li key={hold.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full flex-col items-start rounded-lg px-3 py-2 text-left text-sm',
                    index === selectedIndex && 'bg-muted',
                  )}
                  onMouseEnter={() => onSelect(index)}
                  onClick={() => onRecall(hold)}
                >
                  <span className="font-medium">
                    {hold.customerName || hold.phone || 'Walk-in'} ·{' '}
                    {formatRs(hold.totalRs)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(hold.createdAt), 'd MMM, h:mm a')} · {hold.itemCount}{' '}
                    {hold.itemCount === 1 ? 'line' : 'lines'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {holds.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Discard <Kbd>Del</Kbd>
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
