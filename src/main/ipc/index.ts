import { registerCatalogHandlers } from './catalog'
import { registerClockHandlers, startClockWatch } from './clock'
import { registerPurchasesHandlers } from './purchases'
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
  startClockWatch()
}
