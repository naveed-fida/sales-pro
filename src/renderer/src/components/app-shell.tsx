import { Outlet } from 'react-router'
import { productImageSrc } from '@shared/product-image'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { AppHotkeys } from '@/components/app-hotkeys'
import { AppSidebar } from '@/components/app-sidebar'
import { TitleBar } from '@/components/title-bar'
import { useSettingsQuery } from '@/features/settings/use-settings'
import { navShortcutHint } from '@/lib/hotkeys'

export function AppShell(): React.JSX.Element {
  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <TitleBar />
      <SidebarProvider className="relative min-h-0 flex-1 contain-layout">
        <AppHotkeys />
        <AppSidebar />
        <SidebarInset className="min-h-0 overflow-hidden">
          <AppHeader />
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

function AppHeader(): React.JSX.Element {
  const settingsQuery = useSettingsQuery()
  const shopLogo = settingsQuery.data?.shopLogo
  const shopName = settingsQuery.data?.shopName ?? ''

  return (
    <header className="title-bar relative flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <SidebarTrigger className="title-bar-no-drag" />
      {shopLogo ? (
        <img
          src={productImageSrc(shopLogo)}
          alt={shopName || 'Shop logo'}
          className="pointer-events-none absolute left-1/2 top-1/2 h-10 max-h-10 w-auto max-w-56 -translate-x-1/2 -translate-y-1/2 object-contain"
        />
      ) : (
        <>
          <Separator orientation="vertical" className="h-4" />
          <p className="text-sm text-muted-foreground">{navShortcutHint()}</p>
        </>
      )}
    </header>
  )
}
