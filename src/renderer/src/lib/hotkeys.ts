import { isMac } from '@/lib/platform'

export const APP_NAV = [
  { id: 'pos', path: '/', label: 'POS', digit: '1' },
  { id: 'products', path: '/products', label: 'Products', digit: '2' },
  { id: 'purchases', path: '/purchases', label: 'Purchases', digit: '3' },
  { id: 'sales', path: '/sales', label: 'Sales', digit: '4' },
  { id: 'returns', path: '/returns', label: 'Returns', digit: '5' },
  { id: 'expenses', path: '/expenses', label: 'Expenses', digit: '6' },
  { id: 'reports', path: '/reports', label: 'Reports', digit: '7' },
  { id: 'settings', path: '/settings', label: 'Settings', digit: '8' },
] as const

export type AppNavId = (typeof APP_NAV)[number]['id']

export function navHotkey(digit: string): { combo: string; label: string } {
  if (isMac()) {
    return { combo: `meta+${digit}`, label: `⌘${digit}` }
  }

  return { combo: `alt+${digit}`, label: `Alt+${digit}` }
}

export function appNavWithHotkeys(): ReadonlyArray<
  (typeof APP_NAV)[number] & { combo: string; hotkeyLabel: string }
> {
  return APP_NAV.map((item) => {
    const hotkey = navHotkey(item.digit)
    return { ...item, combo: hotkey.combo, hotkeyLabel: hotkey.label }
  })
}

export function navShortcutHint(): string {
  return isMac() ? '⌘1 to ⌘8 to move around' : 'Alt+1 to Alt+8 to move around'
}

export const POS_HOTKEYS = {
  quantity: { combo: 'f2', label: 'F2' },
  price: { combo: 'f3', label: 'F3' },
  phone: { combo: 'f4', label: 'F4' },
  lineDiscount: { combo: 'f5', label: 'F5' },
  billDiscount: { combo: 'f6', label: 'F6' },
  voidSale: { combo: 'f7', label: 'F7' },
  hold: { combo: 'f8', label: 'F8' },
  tendered: { combo: 'f9', label: 'F9' },
  recall: { combo: 'f10', label: 'F10' },
  complete: { combo: 'f12', label: 'F12' },
} as const

export const PURCHASE_HOTKEYS = {
  quantity: { combo: 'f2', label: 'F2' },
  cost: { combo: 'f3', label: 'F3' },
  lineDiscount: { combo: 'f5', label: 'F5' },
  billDiscount: { combo: 'f6', label: 'F6' },
  complete: { combo: 'f12', label: 'F12' },
} as const

export const RETURN_HOTKEYS = {
  quantity: { combo: 'f2', label: 'F2' },
  price: { combo: 'f3', label: 'F3' },
  lineDiscount: { combo: 'f5', label: 'F5' },
  tendered: { combo: 'f9', label: 'F9' },
  complete: { combo: 'f12', label: 'F12' },
} as const
