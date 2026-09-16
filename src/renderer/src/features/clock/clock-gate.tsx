import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import type { ClockStatus } from '@shared/schemas/clock'
import { Button } from '@/components/ui/button'
import { TitleBar } from '@/components/title-bar'
import { isMac } from '@/lib/platform'
import { clockQueryKey, useClockQuery } from './use-clock'

function formatClock(ms: number): string {
  return format(ms, 'd MMM yyyy, h:mm a')
}

function clockHint(): string {
  return isMac()
    ? 'Open System Settings → General → Date & Time, turn on Set time and date automatically, then try again.'
    : 'Open Windows Settings → Time & language, turn on Set time automatically, then try again.'
}

function LockScreen({
  status,
  onRetry,
  pending,
}: {
  status: ClockStatus & { ok: false }
  onRetry: () => void
  pending: boolean
}): React.JSX.Element {
  const title =
    status.reason === 'rollback'
      ? "This computer's date was set backwards"
      : "This computer's date and time is wrong"

  const description =
    status.reason === 'rollback'
      ? 'Sales Pro last ran later than the time this computer shows now. Fix the clock before selling or receiving stock.'
      : 'The clock is more than five minutes off. Sales, purchases and reports would be dated wrongly.'

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <TitleBar />
      <div className="title-bar-no-drag flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6">
        <div className="flex max-w-md flex-col gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
          <p className="text-sm">This computer: {formatClock(status.localMs)}</p>
          {status.trustedMs !== undefined ? (
            <p className="text-sm">Expected around: {formatClock(status.trustedMs)}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">{clockHint()}</p>
          <Button type="button" disabled={pending} onClick={onRetry}>
            {pending ? 'Checking…' : 'Try again'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ClockGate({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const clockQuery = useClockQuery()

  useEffect(() => {
    return window.api.clock.onStatus((status) => {
      queryClient.setQueryData(clockQueryKey, status)
    })
  }, [queryClient])

  if (clockQuery.isPending) {
    return (
      <div className="flex h-svh flex-col overflow-hidden">
        <TitleBar />
        <div className="title-bar-no-drag flex min-h-0 flex-1 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Checking date and time…</p>
        </div>
      </div>
    )
  }

  if (clockQuery.isError) {
    return (
      <div className="flex h-svh flex-col overflow-hidden">
        <TitleBar />
        <div className="title-bar-no-drag flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6">
          <p className="text-sm text-destructive">
            {clockQuery.error instanceof Error
              ? clockQuery.error.message
              : 'Could not check the date and time.'}
          </p>
          <Button type="button" onClick={() => void clockQuery.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  const status = clockQuery.data
  if (status && !status.ok) {
    return (
      <LockScreen
        status={status}
        pending={clockQuery.isFetching}
        onRetry={() => void clockQuery.refetch()}
      />
    )
  }

  return <>{children}</>
}
