import type { SaleListItem } from '@shared/schemas/sales'

export const SALE_STATUS_LABELS: Record<SaleListItem['status'], string> = {
  completed: 'Completed',
  partially_returned: 'Partial return',
  returned: 'Returned',
}
