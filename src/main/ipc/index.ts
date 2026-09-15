/**
 * Call once, after app.whenReady and after migrations, so no handler can run a
 * query against a schema that has not been brought up to date yet. Feature
 * modules register themselves here as they land.
 */
export function registerIpcHandlers(): void {
  // Handlers arrive with each feature slice.
}
