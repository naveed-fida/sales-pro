import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'

export function App(): React.JSX.Element {
  const versions = window.electron.process.versions

  const runtime = [
    { label: 'Electron', value: versions.electron },
    { label: 'Chromium', value: versions.chrome },
    { label: 'Node', value: versions.node },
  ]

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sales Pro</CardTitle>
          <CardDescription>
            Tailwind and shadcn/ui are wired up. Data and features land next.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableBody>
              {runtime.map(({ label, value }) => (
                <TableRow key={label}>
                  <TableCell className="text-muted-foreground">{label}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button className="w-full">
            <Check />
            Scaffold verified
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
