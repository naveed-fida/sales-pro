import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { Supplier } from '@shared/schemas/suppliers'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SupplierForm } from './supplier-form'
import { purchasesQueryKey } from './use-purchases'
import { supplierQueryKey, suppliersQueryKey, useSuppliersQuery } from './use-suppliers'

export function SuppliersDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const suppliersQuery = useSuppliersQuery()
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<Supplier | 'new' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null)
  const [deleting, setDeleting] = useState(false)
  const suppliers = suppliersQuery.data
  const query = search.trim().toLowerCase()
  const visible = useMemo(() => {
    const rows = suppliers ?? []
    if (!query) return rows
    return rows.filter((supplier) =>
      [supplier.name, supplier.phone ?? '', supplier.address ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [query, suppliers])

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) return
    setDeleting(true)
    const result = await window.api.suppliers.delete(pendingDelete.id)
    setDeleting(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: suppliersQueryKey }),
      queryClient.invalidateQueries({ queryKey: purchasesQueryKey }),
    ])
    queryClient.removeQueries({ queryKey: supplierQueryKey(pendingDelete.id) })
    setPendingDelete(null)
    toast.success('Supplier deleted')
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle>Suppliers</DialogTitle>
            <DialogDescription>
              Names, phones and addresses used when receiving stock.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-xs"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search suppliers"
            />
            <Button type="button" onClick={() => setEditor('new')}>
              <Plus />
              New supplier
            </Button>
          </div>
          {suppliersQuery.isPending ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : suppliersQuery.isError ? (
            <p className="text-sm text-destructive">
              {suppliersQuery.error instanceof Error
                ? suppliersQuery.error.message
                : 'Could not load suppliers.'}
            </p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {(suppliers ?? []).length === 0
                ? 'No suppliers yet. Add one before receiving a purchase.'
                : 'No suppliers match that search.'}
            </p>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto rounded-xl ring-1 ring-foreground/10">
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>{supplier.phone ?? '—'}</TableCell>
                      <TableCell className="max-w-56 truncate">
                        {supplier.address ?? '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditor(supplier)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setPendingDelete(supplier)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editor !== null} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {editor === 'new' || editor === null ? 'New supplier' : 'Edit supplier'}
            </DialogTitle>
            <DialogDescription>Used on purchases when stock comes in.</DialogDescription>
          </DialogHeader>
          {editor !== null ? (
            <SupplierForm
              supplier={editor === 'new' ? null : editor}
              onClose={() => setEditor(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You can only delete a supplier that has no purchases.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
