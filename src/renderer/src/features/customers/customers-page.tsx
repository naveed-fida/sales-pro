import { useMemo, useState } from 'react'
import { useDebounceValue } from 'usehooks-ts'
// lodash-es rather than lodash: the CJS build defeats tree-shaking and pulls
// the whole ~73 kB monolith into the renderer bundle for one function.
import { deburr } from 'lodash-es'
import { Search } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CustomerForm } from './customer-form'
import { useCustomers } from './use-customers'

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
})

/**
 * lodash's deburr strips diacritics, so searching "jose" matches "José".
 * Folding accents correctly by hand is not worth reimplementing.
 */
function normalize(value: string): string {
  return deburr(value).toLowerCase()
}

export function CustomersPage(): React.JSX.Element {
  const { customers, isLoading, error, add } = useCustomers()
  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebounceValue(search, 200)

  const filtered = useMemo(() => {
    const query = normalize(debouncedSearch.trim())
    if (!query) return customers

    return customers.filter(
      (customer) =>
        normalize(customer.name).includes(query) ||
        normalize(customer.email).includes(query),
    )
  }, [customers, debouncedSearch])

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 p-8 lg:grid-cols-[20rem_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>New customer</CardTitle>
          <CardDescription>Name and email are both required.</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerForm onCreated={add} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>
            {isLoading
              ? 'Loading...'
              : `${customers.length} total${
                  debouncedSearch.trim() ? `, ${filtered.length} matching` : ''
                }`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
              className="pl-8"
              aria-label="Search customers"
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      {isLoading
                        ? 'Loading customers...'
                        : customers.length === 0
                          ? 'No customers yet. Add the first one.'
                          : 'No customers match that search.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {customer.email}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {dateFormat.format(customer.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
