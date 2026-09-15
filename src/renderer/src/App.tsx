import { Route, Routes } from 'react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/app-shell'
import { PosPage } from '@/features/pos/pos-page'
import { ProductsPage } from '@/features/products/products-page'
import { PurchasesPage } from '@/features/purchases/purchases-page'
import { SalesPage } from '@/features/sales/sales-page'
import { ReturnsPage } from '@/features/returns/returns-page'
import { ExpensesPage } from '@/features/expenses/expenses-page'
import { ReportsPage } from '@/features/reports/reports-page'
import { SettingsPage } from '@/features/settings/settings-page'

export function App(): React.JSX.Element {
  return (
    <TooltipProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<PosPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="purchases" element={<PurchasesPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="returns" element={<ReturnsPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      <Toaster />
    </TooltipProvider>
  )
}
