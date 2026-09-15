import { NavLink, useLocation } from 'react-router'
import {
  BarChart3,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Undo2,
  Wallet,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Kbd } from '@/components/ui/kbd'
import { appNavWithHotkeys, type AppNavId } from '@/lib/hotkeys'

const NAV_ICONS: Record<AppNavId, typeof ShoppingCart> = {
  pos: ShoppingCart,
  products: Package,
  purchases: Truck,
  sales: Receipt,
  returns: Undo2,
  expenses: Wallet,
  reports: BarChart3,
  settings: Settings,
}

function isActivePath(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}

const NAV_BUTTON_CLASS =
  'data-active:bg-sidebar-primary data-active:font-semibold data-active:text-sidebar-primary-foreground'

export function AppSidebar(): React.JSX.Element {
  const { pathname } = useLocation()
  const nav = appNavWithHotkeys()
  const mainNav = nav.filter((item) => item.id !== 'settings')
  const settingsNav = nav.find((item) => item.id === 'settings')

  return (
    <Sidebar collapsible="icon" className="h-full">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => {
                const Icon = NAV_ICONS[item.id]

                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, item.path)}
                      tooltip={item.label}
                      className={NAV_BUTTON_CLASS}
                    >
                      <NavLink to={item.path} end={item.path === '/'}>
                        <Icon />
                        <span>{item.label}</span>
                        <Kbd className="ml-auto">{item.hotkeyLabel}</Kbd>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {settingsNav ? (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActivePath(pathname, settingsNav.path)}
                tooltip={settingsNav.label}
                className={NAV_BUTTON_CLASS}
              >
                <NavLink to={settingsNav.path}>
                  <Settings />
                  <span>{settingsNav.label}</span>
                  <Kbd className="ml-auto">{settingsNav.hotkeyLabel}</Kbd>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      ) : null}
    </Sidebar>
  )
}
