import { registerCatalogHandlers } from './catalog'
import { registerClockHandlers, startClockWatch } from './clock'
import { registerExpensesHandlers } from './expenses'
import { registerPurchasesHandlers } from './purchases'
import { registerReportsHandlers } from './reports'
import { registerReturnsHandlers } from './returns'
import { registerSalesHandlers } from './sales'
import { registerSettingsHandlers } from './settings'
import { registerSuppliersHandlers } from './suppliers'

/**
 * Call once, after app.whenReady and after migrations, so no handler can run a
 * query against a schema that has not been brought up to date yet.
 */
export function registerIpcHandlers(): void {
  registerSettingsHandlers()
  registerClockHandlers()
  registerCatalogHandlers()
  registerSuppliersHandlers()
  registerPurchasesHandlers()
  registerSalesHandlers()
  registerReturnsHandlers()
  registerExpensesHandlers()
  registerReportsHandlers()
  startClockWatch()
}
