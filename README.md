# Sales Pro

A cross-platform desktop application built with Electron, React and SQLite.
It builds to a DMG for Apple Silicon and an NSIS installer for Windows on
both x64 and arm64.

This is an early-stage codebase. The Customers page is the only feature so
far, and it exists as much to be a worked example as to be useful: it
exercises the whole stack end to end, from a Zod schema through validated
IPC to a Drizzle query. Copy its shape when adding the next feature.

## Requirements

- **Node 24.x.** The exact version is pinned in `.nvmrc`; `nvm use` will pick
  it up. `package.json` enforces `>=24.20.0 <25` on install.
- **npm 11.x**, which ships with Node 24. The project relies on npm 11's
  `allowScripts` field, so older npm will try to run install scripts this
  project deliberately blocks.

Building installers needs nothing extra. Regenerating app icons does — see
[docs/packaging.md](docs/packaging.md).

## Getting started

```bash
nvm use
npm install
npm run dev
```

That is the whole setup. There is no database to provision and no `.env` to
write: the app creates its SQLite file at `.data/sales-pro.db` on first run
and applies migrations before opening a window.

### What `npm install` does that may surprise you

npm 11 blocks dependency install scripts by default and records the
exceptions in the `allowScripts` field of `package.json`. Two consequences
are worth knowing about, because both look like bugs otherwise:

- **Electron's own postinstall is blocked**, so the binary would never
  download. The root `postinstall` script calls `install-electron` explicitly
  to do it. Scripts in the root package always run; only dependencies are
  gated.
- **`better-sqlite3` is denied on purpose.** Its install script compiles the
  addon from source, which we neither need nor want: it publishes Node-API
  prebuilds for every platform we target, and Node-API is ABI-stable across
  Node and Electron. Letting it build would cost minutes per install and
  require a C++ toolchain on every contributor's machine.

If you add a dependency that legitimately needs an install script, review it
and then run `npm install-scripts approve <pkg>` rather than editing
`allowScripts` by hand.

## Scripts

| Script                 | What it does                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run dev`          | Runs the app with hot reload for the renderer and restart-on-change for main and preload        |
| `npm run build`        | Typechecks, then bundles main, preload and renderer into `out/`                                 |
| `npm run preview`      | Runs the production bundle without packaging it                                                 |
| `npm run lint`         | ESLint over the whole repo, including Prettier differences as warnings                          |
| `npm run lint:fix`     | The same, applying every fix it can                                                             |
| `npm run format`       | Rewrites files to Prettier style                                                                |
| `npm run format:check` | Fails if anything is unformatted; this is what CI runs                                          |
| `npm run typecheck`    | `tsc --noEmit` over both the Node and web projects                                              |
| `npm run db:generate`  | Generates a migration from changes to `src/main/db/schema.ts`                                   |
| `npm run db:studio`    | Opens Drizzle Studio against the development database                                           |
| `npm run build:mac`    | Builds a DMG and ZIP for Apple Silicon into `release/`                                          |
| `npm run build:win`    | Builds NSIS installers for Windows x64 and arm64                                                |
| `npm run build:unpack` | Builds an unpacked app directory, which is much faster when you only need to inspect the result |
| `npm run icons`        | Regenerates the app icons from `build/icon.svg`                                                 |

Before opening a pull request, run the three checks CI runs:

```bash
npm run lint && npm run format:check && npm run typecheck
```

## Project layout

```
src/
  main/            Node. Full privileges: database, filesystem, OS.
    db/            Drizzle schema, client, migrator, path resolution
    ipc/           Channel handlers, one module per feature
    index.ts       App lifecycle, window creation, security posture
  preload/         The only bridge between main and renderer
  renderer/        The React app. No Node, no filesystem.
    src/
      components/ui/   shadcn components, vendored and generator-owned
      features/        One directory per feature
      lib/             Shared renderer utilities
  shared/          Code both sides import. Types and Zod schemas only.
drizzle/           Generated migration history. Never edit by hand.
build/             Icons and macOS entitlements
scripts/           Dev and build helpers
docs/              The rest of the documentation
```

Two import aliases are configured everywhere, including for the shadcn CLI:
`@/` for `src/renderer/src`, and `@shared/` for `src/shared`.

`src/shared` must stay free of runtime imports from either side. It is
compiled into both the Node and the browser bundle, so anything reaching for
`electron`, `node:fs` or the DOM will break one of them.

## Conventions

The conventions that matter are written down as Cursor rules in
`.cursor/rules/`, so the AI and the humans work from the same instructions.
They are worth reading directly, but in short:

- **`library-first.mdc`** — the stack was chosen deliberately. Check whether
  a dependency already solves your problem before writing a component, hook
  or utility. Import individual members, never a namespace.
- **`data-layer.mdc`** — IPC goes through the shared contract, schema changes
  are generated rather than hand-written, and the database location is
  resolved in one place.
- **`shadcn-ui.mdc`** — add primitives with the CLI and compose them. Do not
  fork the vendored components.
- **`ui-verification.mdc`** — how to verify visual changes.

Styling is Tailwind v4, configured through `@tailwindcss/vite` with no
`tailwind.config`. Theme tokens live in `src/renderer/src/index.css`.

## Documentation

- **[docs/architecture.md](docs/architecture.md)** — how the three processes
  fit together, how a call travels from a form to SQLite and back, and a
  walkthrough of adding a feature.
- **[docs/packaging.md](docs/packaging.md)** — building installers, icons,
  signing, the release flow, and the packaging traps this project has already
  fallen into.

## Configuration

Everything runs without configuration. To override a default, copy
`.env.example` to `.env`; it documents the only variable the app reads,
`SALES_PRO_DB_PATH`. `.env` is git-ignored and never packaged.

Environment variables are parsed by Node's built-in `.env` support, so the
project has no `dotenv` dependency. Please keep it that way.
