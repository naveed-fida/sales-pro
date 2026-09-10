#!/usr/bin/env bash
#
# Rasterises build/icon.svg and build/icon-win.svg into the artifacts
# electron-builder consumes: icon.icns (macOS), icon.ico (Windows) and
# icon.png (fallback).
#
# The generated files are committed, because CI runners do not have these
# tools installed. Run this only when the SVG sources change.
set -euo pipefail

cd "$(dirname "$0")/.."
BUILD_DIR="build"

for tool in rsvg-convert magick; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "error: $tool not found. Install with: brew install librsvg imagemagick" >&2
    exit 1
  fi
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Rendering macOS icon set..."
ICONSET="$WORK/icon.iconset"
mkdir -p "$ICONSET"

# iconutil expects this exact naming. Each logical size needs a 1x and a 2x.
render_mac() {
  rsvg-convert -w "$1" -h "$1" "$BUILD_DIR/icon.svg" -o "$ICONSET/$2"
}
render_mac 16 icon_16x16.png
render_mac 32 icon_16x16@2x.png
render_mac 32 icon_32x32.png
render_mac 64 icon_32x32@2x.png
render_mac 128 icon_128x128.png
render_mac 256 icon_128x128@2x.png
render_mac 256 icon_256x256.png
render_mac 512 icon_256x256@2x.png
render_mac 512 icon_512x512.png
render_mac 1024 icon_512x512@2x.png

if command -v iconutil >/dev/null 2>&1; then
  iconutil -c icns "$ICONSET" -o "$BUILD_DIR/icon.icns"
  echo "  wrote $BUILD_DIR/icon.icns"
else
  echo "  skipped icon.icns (iconutil is macOS-only)" >&2
fi

echo "Rendering Windows icon..."
for size in 16 24 32 48 64 128 256; do
  rsvg-convert -w "$size" -h "$size" "$BUILD_DIR/icon-win.svg" -o "$WORK/win-$size.png"
done
# A .ico is a container, so ship every size rendered from the vector rather
# than letting Windows downscale a single large bitmap badly.
#
# This prints "Cannot write image with defined png:bit-depth or
# png:color-type". That warning is a known ImageMagick quirk: entries at 256px
# are stored PNG-compressed inside the container, and the writer objects to the
# colour-type it inherited from the greyscale sources. It cannot be silenced by
# -type, -strip, or setting the defines explicitly, and the file it produces is
# correct, so the assertion below is what actually guards the output.
magick "$WORK/win-16.png" "$WORK/win-24.png" "$WORK/win-32.png" \
  "$WORK/win-48.png" "$WORK/win-64.png" "$WORK/win-128.png" \
  "$WORK/win-256.png" "$BUILD_DIR/icon.ico" 2>/dev/null || true

ico_sizes=$(magick identify "$BUILD_DIR/icon.ico" | awk '{print $3}' | tr '\n' ' ')
expected='16x16 24x24 32x32 48x48 64x64 128x128 256x256 '
if [ "$ico_sizes" != "$expected" ]; then
  echo "error: icon.ico has sizes [$ico_sizes], expected [$expected]" >&2
  exit 1
fi
echo "  wrote $BUILD_DIR/icon.ico (${ico_sizes% })"

rsvg-convert -w 1024 -h 1024 "$BUILD_DIR/icon.svg" -o "$BUILD_DIR/icon.png"
echo "  wrote $BUILD_DIR/icon.png"
