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
  clock: {
    get: 'clock:get',
    changed: 'clock:changed',
  },
  categories: {
    list: 'categories:list',
    create: 'categories:create',
  },
  products: {
    list: 'products:list',
    get: 'products:get',
    save: 'products:save',
    delete: 'products:delete',
    saveImage: 'products:saveImage',
    clearImage: 'products:clearImage',
    listVariants: 'products:listVariants',
  },
  suppliers: {
    list: 'suppliers:list',
    get: 'suppliers:get',
    save: 'suppliers:save',
    delete: 'suppliers:delete',
  },
  purchases: {
    list: 'purchases:list',
    get: 'purchases:get',
    receive: 'purchases:receive',
    catalog: 'purchases:catalog',
  },
  sales: {
    catalog: 'sales:catalog',
    complete: 'sales:complete',
    listHolds: 'sales:holds:list',
    saveHold: 'sales:holds:save',
    deleteHold: 'sales:holds:delete',
    list: 'sales:list',
    get: 'sales:get',
    print: 'sales:print',
  },
  receipt: {
    ready: 'receipt:ready',
  },
  returns: {
    lookup: 'returns:lookup',
    complete: 'returns:complete',
  },
  expenses: {
    list: 'expenses:list',
    save: 'expenses:save',
    delete: 'expenses:delete',
  },
} as const
