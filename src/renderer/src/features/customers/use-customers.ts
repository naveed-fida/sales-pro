import { useCallback, useEffect, useState } from 'react'
import type { Customer, IpcResult } from '@shared/ipc-contract'

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

  const applyResult = useCallback((result: IpcResult<Customer[]>) => {
    if (result.ok) {
      setCustomers(result.data)
      setError(null)
    } else {
      setError(result.error.message)
    }

    setIsLoading(false)
  }, [])

  // Manual refreshes want the spinner back, since a list is already on screen.
  const refresh = useCallback(async () => {
    setIsLoading(true)
    applyResult(await window.api.customers.list())
  }, [applyResult])

  // The initial load runs inside the promise rather than the effect body: state
  // must not be set synchronously on mount, and isLoading already starts true.
  // The cancelled flag stops a slow reply landing after unmount.
  useEffect(() => {
    let cancelled = false

    void window.api.customers.list().then((result) => {
      if (cancelled) return
      applyResult(result)
    })

    return () => {
      cancelled = true
    }
  }, [applyResult])

  // The create handler returns the inserted row, so splice it in rather than
  // re-querying the whole table.
  const add = useCallback((customer: Customer) => {
    setCustomers((current) =>
      [...current, customer].sort((a, b) => a.name.localeCompare(b.name)),
    )
  }, [])

  return { customers, isLoading, error, refresh, add }
}
