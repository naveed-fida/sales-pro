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
} as const
