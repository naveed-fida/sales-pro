import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SettingsForm } from './settings-form'
import { usePrintersQuery, useSettingsQuery } from './use-settings'

function SettingsPageSkeleton(): React.JSX.Element {
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

export function SettingsPage(): React.JSX.Element {
  const settingsQuery = useSettingsQuery()
  const printersQuery = usePrintersQuery()

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Shop details, receipt footer, printer, and the default low-stock level.
        </p>
      </div>

      {settingsQuery.isPending ? (
        <SettingsPageSkeleton />
      ) : settingsQuery.isError || !settingsQuery.data ? (
        <div className="flex max-w-xl flex-col items-start gap-3">
          <p className="text-sm text-destructive">
            {settingsQuery.error instanceof Error
              ? settingsQuery.error.message
              : 'Could not load settings.'}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void settingsQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <SettingsForm
          settings={settingsQuery.data}
          printers={printersQuery.data ?? []}
          printersError={printersQuery.isError}
          printersPending={printersQuery.isPending}
        />
      )}
    </div>
  )
}
