import { Outlet } from 'react-router'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { AppHotkeys } from '@/components/app-hotkeys'
import { AppSidebar } from '@/components/app-sidebar'
import { TitleBar } from '@/components/title-bar'
import { navShortcutHint } from '@/lib/hotkeys'

export function AppShell(): React.JSX.Element {
  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <TitleBar />
      <SidebarProvider className="relative min-h-0 flex-1 contain-layout">
        <AppHotkeys />
        <AppSidebar />
        <SidebarInset>
          <header className="title-bar flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <SidebarTrigger className="title-bar-no-drag" />
            <Separator orientation="vertical" className="h-4" />
            <p className="text-sm text-muted-foreground">{navShortcutHint()}</p>
          </header>
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
