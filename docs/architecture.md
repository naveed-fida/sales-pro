# Architecture

This document covers how the pieces fit together and how to add a feature.
For build and release concerns, see [packaging.md](packaging.md).

## Three processes

Electron splits an app across processes, and this one keeps that split
strict.

**Main** (`src/main`) is Node with full privileges. It owns the database, the
filesystem, and the app lifecycle. Nothing else may touch SQLite.

**Renderer** (`src/renderer`) is the React app, and it is treated as
untrusted. It runs with `nodeIntegration: false` and `contextIsolation: true`,
so it has no `require`, no `fs`, and no way to reach the database except by
asking main.

**Preload** (`src/preload`) is the only bridge. It runs in the renderer's
process but with access to Electron's IPC, and it publishes a narrow,
explicitly enumerated API onto `window.api` through `contextBridge`.

`sandbox` is deliberately left off, which is the one relaxation here. It is
required for the preload to use `@electron-toolkit/preload`. Everything else
stays locked down: external links are handed to the system browser rather
than opened in an app window, and a second launch focuses the existing window
instead of starting a rival instance that would race on the SQLite file.

`src/shared` is imported by all three, so it must contain types and Zod
schemas only. A runtime import of `electron` or `node:fs` there will break
the renderer bundle, and a DOM reference will break main.

## The IPC contract

`src/shared/ipc-contract.ts` is the single source of truth for the boundary.
It holds the channel names, the payload schemas, and the result envelope.
Both sides import it, so a renamed channel or a changed payload shape is a
type error rather than a runtime surprise.

### Channels are constants

```ts
export const IPC = {
  customers: {
    list: 'customers:list',
    create: 'customers:create',
  },
} as const
```

No call site should ever contain a string literal channel. A typo in a
literal fails silently — the handler simply never runs.

### Handlers resolve, they never reject

Every handler returns an `IpcResult<T>`:

```ts
export type IpcFailure = {
  message: string
  /** Names the offending input so a form can attach the message to it. */
  field?: string
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcFailure }
```

This matters more than it looks. When an `ipcMain.handle` callback throws,
the rejection reaches the renderer as an opaque
`Error invoking remote method 'customers:create': ...` string. You cannot
show that to a user, and you certainly cannot attach it to the right form
field. The envelope keeps failures structured and typed instead.

The optional `field` is what makes form errors work. When a create fails
because the email is taken, the handler returns
`ipcFail('A customer with that email already exists.', 'email')`, and the
form maps that straight onto the offending input via react-hook-form's
`setError`. Without it, a uniqueness failure would land in a detached banner
somewhere away from the input that caused it.

### One schema, validated in main

The same Zod schema validates on both sides, so the client-side message and
the server-side one cannot disagree. The renderer validates for immediate
feedback via `zodResolver`; main validates because the renderer is untrusted
input and a compromised renderer could invoke any exposed channel with
anything.

Schemas also carry transforms, and those run in main too:

```ts
export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
})
```

Because `.toLowerCase()` is part of the schema rather than the form, the
unique index on `email` is effectively case-insensitive no matter who calls
the channel.

Note the two exported types: `Customer` comes from `z.infer` (the parsed
shape) and `CreateCustomerInput` from `z.input` (the shape before transforms
run). Forms want the input type.

## A request, end to end

Submitting the customer form runs through these steps:

1. `customer-form.tsx` validates with `zodResolver(createCustomerSchema)`
   and blocks the submit if it fails.
2. It calls `window.api.customers.create(values)`.
3. The preload forwards that to `ipcRenderer.invoke(IPC.customers.create, input)`.
4. The handler in `src/main/ipc/customers.ts` runs
   `createCustomerSchema.safeParse(payload)` before anything else.
5. On success it inserts through the Drizzle builder and returns the row via
   `ipcOk`. On a unique-constraint violation it returns `ipcFail(msg, 'email')`.
6. The form either resets, or calls `setError` with the returned field name.

The inserted row travels back through Electron's structured clone, which
preserves `Date` objects, so `createdAt` arrives in the renderer as a real
`Date` with no serialisation step in between.

## Data layer

**Schema** lives in `src/main/db/schema.ts` as Drizzle table definitions.
Timestamps use `integer(..., { mode: 'timestamp' })` with a
`(unixepoch())` default, which is the SQLite-native way to store them.

**Migrations** are generated, never hand-written. Edit the schema, then run
`npm run db:generate`, which writes SQL plus a snapshot into `drizzle/`.
Editing anything in `drizzle/` by hand desynchronises it from the snapshot
and the next generate will produce nonsense.

Migrations apply at boot, before any window opens, so a window can never
issue a query against a stale schema. If migration fails the app shows an
error dialog and exits rather than opening a window that will throw on its
first read. `drizzle-kit` is only for generating migrations and for Studio;
it never applies them.

**Connection** is opened lazily in `src/main/db/client.ts` with three
pragmas: WAL journaling for concurrent reads, a 5 second busy timeout, and
foreign key enforcement, which SQLite leaves off by default. The connection
is closed on `will-quit` so WAL is checkpointed back into the main file.

### Where the database lives

`src/main/db/paths.ts` is the only place that decides. In order:

1. `SALES_PRO_DB_PATH`, if set, resolved against the repo root when relative.
2. Development: `<repo>/.data/sales-pro.db`, git-ignored.
3. Packaged: `<OS userData>/sales-pro.db`, which survives app updates.

Both the main process and `drizzle.config.ts` import from this module, so
Studio and the app can never disagree about which file they mean. Never call
`app.getPath('userData')` or join a database filename at a call site; use
`getDatabasePath()`.

Development also gets its own userData directory (`sales-pro-dev`), set
before anything reads a path from it. This is not cosmetic. Chromium keeps
the single-instance lock under userData, so a dev build and a packaged build
sharing it means whichever launches second quits immediately and silently.

To inspect a packaged build's real data, point `SALES_PRO_DB_PATH` at its
userData file and run `npm run db:studio`. `.env.example` lists the paths.

## Boot sequence

`src/main/index.ts`, in order:

1. Override userData in development, before any path is read.
2. Load `.env` if present, using Node's built-in parser.
3. Acquire the single-instance lock, or quit.
4. On ready: run migrations, or show an error dialog and exit.
5. Register IPC handlers.
6. Create the window, shown only on `ready-to-show` to avoid a white flash.

## Adding a feature

Follow the customers feature; it is the reference implementation. Adding one
called `invoices` means touching five places.

**1. Schema.** Add the table to `src/main/db/schema.ts`, then:

```bash
npm run db:generate
```

**2. Contract.** In `src/shared/ipc-contract.ts`, add the channels and the
Zod schemas, and export the inferred types.

```ts
export const IPC = {
  customers: { ... },
  invoices: {
    list: 'invoices:list',
    create: 'invoices:create',
  },
} as const
```

**3. Handlers.** Create `src/main/ipc/invoices.ts` exporting
`registerInvoiceHandlers()`, and call it from `src/main/ipc/index.ts`. Parse
the payload first, wrap the query, and return `ipcOk` / `ipcFail`. Return a
`field` name on any failure a form could sensibly attach to an input.

**4. Preload.** Add the methods to the `api` object in
`src/preload/index.ts`, and to the `window.api` types in
`src/preload/index.d.ts`. The renderer cannot reach anything you do not
enumerate here.

**5. Renderer.** Create `src/renderer/src/features/invoices/` with a data
hook, a form, and a page, mirroring the customers feature.

A note on the data hook: `use-customers.ts` performs its initial load inside
the promise rather than the effect body, and carries a `cancelled` flag for
unmount. Both are deliberate. Calling `setState` synchronously in an effect
causes cascading renders, and `react-hooks/set-state-in-effect` will fail
your lint run if you do. Copy the existing shape.

## Renderer notes

Forms use react-hook-form with `zodResolver` and the shared schema. Do not
manage a `useState` per field or hand-roll validation.

shadcn primitives are vendored into `src/renderer/src/components/ui` by the
CLI. Add new ones with `npx shadcn@latest add <name>` and compose them; do
not edit them, because the next `shadcn add` will overwrite your changes.
Lint rules that fight the generator's conventions are switched off for that
directory alone.

Import individual members rather than namespaces. This is a bundle-size
concern, not a style preference: importing `lodash` rather than `lodash-es`
once added 73 kB of dead weight to the renderer for the sake of one function,
because the CommonJS build cannot be tree-shaken.
