# Packaging and release

How the app becomes an installer, and the traps this project has already
fallen into. Configuration lives in `electron-builder.yml`.

## Building locally

```bash
npm run build:unpack   # unpacked app directory, fastest for inspection
npm run build:mac      # DMG + ZIP, Apple Silicon
npm run build:win      # NSIS installers, x64 and arm64
```

Everything lands in `release/`. Each script runs `npm run build` first, which
typechecks and then bundles into `out/`.

Extra flags pass through after `--`:

```bash
npm run build:mac -- --publish never
```

Nothing is ever uploaded by default — `publish: null` in the config — so
that flag is belt and braces.

### Targets

| Platform | Format         | Architectures |
| -------- | -------------- | ------------- |
| macOS    | DMG and ZIP    | arm64 only    |
| Windows  | NSIS installer | x64 and arm64 |

macOS is Apple Silicon only by choice. Supporting Intel means a second
Electron download and a universal binary, and universal merging has its own
failure mode with native modules (see below). If Intel Macs ever need
supporting, add an `x64` entry under `mac.target`.

**Windows installers can be built from macOS.** macOS builds cannot be built
anywhere but macOS, because the DMG tooling is platform-only.

## The native module story

`better-sqlite3` is the only native dependency, and almost every packaging
decision here follows from it.

It publishes **Node-API prebuilds** for every platform and architecture we
target. Node-API is ABI-stable across both Node and Electron versions, which
means the prebuilt binary works as-is and never needs recompiling.

Three settings follow from that:

**`npmRebuild: false`.** Rebuilding is not merely unnecessary, it actively
breaks things. `@electron/rebuild` falls back to node-gyp whenever the target
architecture differs from the host, and node-gyp cannot cross-compile. With
rebuilding on, building Windows from macOS fails outright, and Windows CI
would need a full MSVC toolchain for no benefit.

**`asarUnpack`** for `node_modules/better-sqlite3`. Node's `dlopen` cannot
load a `.node` file from inside an asar archive, and better-sqlite3 resolves
its binary with `require('../prebuilds/<target>.node')`. Unpacking lets
Electron's filesystem shim redirect that to `app.asar.unpacked`. Without it
the app dies on its first database call.

**Pruning** in the `files` list. The SQLite amalgamation and addon sources
(`deps`, `src`, `binding.gyp`) are only needed to compile from source, which
we never do — that is about 10 MB. The four Linux prebuilds are another
8.7 MB for platforms we do not ship.

If a universal macOS build is ever attempted, expect `@electron/universal` to
reject the prebuilt `.node` for being byte-identical across architectures.
Declaring it under `mac.x64ArchFiles` is the fix. That key is not in the
config today, because the arm64-only target does not need it.

## Migrations must ship outside the asar

`extraResources` copies `drizzle/` into the app's resources directory, and
`src/main/db/migrate.ts` reads from `process.resourcesPath` when packaged.
Migration files have to be readable as ordinary files by the migrator, so
they cannot live inside the archive.

## The `files` list is exclusion-based

This is the part most likely to bite you. electron-builder starts from
_everything_ plus production dependencies, and the `files` list subtracts
from that. It is not an allowlist.

The advantage is that it cannot accidentally strip a `node_modules` package
the main process needs at runtime. The cost is that **anything new at the
repo root ships unless you exclude it.**

This has already caused a real bug. The asar was shipping `.data/`, which is
the development database — local rows would have travelled to end users. It
also carried `.cursor/`, `.github/`, and both `.tsbuildinfo` files, the last
because the exclusion named `tsconfig.tsbuildinfo` while the real files are
`tsconfig.node.tsbuildinfo` and `tsconfig.web.tsbuildinfo`.

**If you add a config file or directory at the repo root, add an exclusion
and then verify it.** Prefer globs over literal filenames. Verification is
one command:

```bash
npm run build:unpack
npx asar list "release/mac-arm64/Sales Pro.app/Contents/Resources/app.asar" | grep -E "^/[^/]+$"
```

That should print exactly `/node_modules`, `/out` and `/package.json`.
Anything else is a leak.

## Icons

Both icon files are generated from vector sources by:

```bash
npm run icons
```

This needs two tools that are not npm dependencies:

```bash
brew install librsvg imagemagick
```

There are two sources because the platforms differ. `build/icon.svg` insets
the mark to 824×824 within a 1024 canvas with an r=185 corner, which is the
macOS convention and makes the icon sit at the same visual weight as system
icons in the Dock. `build/icon-win.svg` is full-bleed, because Windows
neither insets nor masks app icons.

Every size is rendered from the vector rather than downscaled from one large
bitmap, which matters at 16 and 32 pixels.

The script prints a warning from ImageMagick about `png:bit-depth` when
writing the `.ico`. It is a known quirk of the ICO writer, it cannot be
silenced, and the file it produces is correct. The script asserts on the
resulting icon sizes instead, so a genuinely broken `.ico` fails the build
rather than passing quietly.

## Signing and notarisation

Both are **off by default**, so a clean checkout builds without credentials.
An unsigned macOS build will be blocked by Gatekeeper on other machines;
right-click and Open, or clear the quarantine attribute, to run it locally.

To turn signing on, supply credentials as environment variables:

| Platform           | Variables                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| macOS              | `CSC_LINK`, `CSC_KEY_PASSWORD`                                                                         |
| macOS notarisation | `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, plus `mac.notarize` in `electron-builder.yml` |
| Windows            | `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`                                                                 |

CI sets `CSC_IDENTITY_AUTO_DISCOVERY: false` so that tags and manual runs
build without secrets. Remove it on the workflow's build step when you add
certificates.

## CI and releases

`.github/workflows/build.yml` runs on pushes to `main`, on pull requests
against `main`, on `v*` tags, and on manual dispatch.

- **Lint** runs on every trigger, once on Linux. It installs with
  `--ignore-scripts`, since ESLint, Prettier and tsc are pure JavaScript and
  skipping that avoids a 300 MB Electron download.
- **Build** is a matrix over macOS and Windows, on tags and manual dispatch
  only. It uploads installers as artifacts with 14 day retention. `fail-fast`
  is off so one platform failing does not hide the other's result.
- **Release** runs on `v*` tags only and attaches every artifact to a
  generated GitHub release.

Electron downloads are cached via `electron_config_cache`, which is the
variable `@electron/get` actually reads. `ELECTRON_CACHE` is a common
suggestion and has no effect. Note that it belongs on the install step,
because that is where Electron's postinstall does the download.

To cut a release:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The release job uses `--verify-tag`, so the tag must exist on the remote.

## Troubleshooting

**The app exits immediately with no output.** Almost always the
single-instance lock. A dev instance still running holds it, and the second
launcher calls `app.quit()` silently by design. Note that the dev binary is
named `Electron`, not `Sales Pro`, so `pkill -f "Sales Pro"` will not match
it.

**`require('electron')` returns a path string, and `app` is undefined.**
VS Code and Cursor are themselves Electron apps and their integrated
terminals leak `ELECTRON_RUN_AS_NODE=1` into child processes, which makes
Electron boot as plain Node. `npm run dev` goes through
`scripts/electron-vite.mjs`, which strips it. If you invoke the Electron
binary directly, `unset ELECTRON_RUN_AS_NODE` first.

**`node-gyp does not support cross-compiling native modules from source`.**
Something re-enabled rebuilding. Check `npmRebuild` is still `false`.

**The packaged app throws on its first database call.** The native binary
is trapped inside the asar. Check `asarUnpack` still covers
`better-sqlite3`.

**Migrations folder missing at ...** The generated SQL did not make it into
resources. Check `extraResources`, and that `npm run db:generate` has been
run and `drizzle/` is committed.
