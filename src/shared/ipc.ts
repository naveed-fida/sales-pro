/**
 * Channel names for the main/renderer boundary. Import these constants; never
 * write a string-literal channel at a call site. Feature groups are added as
 * each slice lands.
 */
export const IPC = {
  settings: {
    get: 'settings:get',
    save: 'settings:save',
    listPrinters: 'settings:listPrinters',
  },
} as const
