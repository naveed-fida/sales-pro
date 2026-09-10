import { useCallback, useEffect, useState } from 'react'
import type { Customer } from '@shared/ipc-contract'

type UseCustomersResult = {
  customers: Customer[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  add: (customer: Customer) => void
}

export function useCustomers(): UseCustomersResult {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    const result = await window.api.customers.list()

    if (result.ok) {
      setCustomers(result.data)
      setError(null)
    } else {
      setError(result.error.message)
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // The create handler returns the inserted row, so splice it in rather than
  // re-querying the whole table.
  const add = useCallback((customer: Customer) => {
    setCustomers((current) =>
      [...current, customer].sort((a, b) => a.name.localeCompare(b.name)),
    )
  }, [])

  return { customers, isLoading, error, refresh, add }
}
