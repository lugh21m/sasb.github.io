#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/_site}"

ROOT_FILES=(
  ".nojekyll"
  "CNAME"
  "index.html"
)

CONTENT_DIRS=(
  "ablauf"
  "assets"
  "beweis"
  "loesung"
  "termin"
)

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

for file in "${ROOT_FILES[@]}"; do
  if [[ -f "$ROOT_DIR/$file" ]]; then
    cp "$ROOT_DIR/$file" "$OUT_DIR/$file"
  fi
done

for dir in "${CONTENT_DIRS[@]}"; do
  if [[ ! -d "$ROOT_DIR/$dir" ]]; then
    echo "Missing expected directory: $dir" >&2
    exit 1
  fi

  mkdir -p "$OUT_DIR/$dir"
  rsync -a --delete "$ROOT_DIR/$dir/" "$OUT_DIR/$dir/"
done

MIRROR_ROOT="$OUT_DIR/SASB_CaseStudy"
mkdir -p "$MIRROR_ROOT"
cp "$OUT_DIR/index.html" "$MIRROR_ROOT/index.html"

for dir in "${CONTENT_DIRS[@]}"; do
  mkdir -p "$MIRROR_ROOT/$dir"
  rsync -a --delete "$OUT_DIR/$dir/" "$MIRROR_ROOT/$dir/"
done

echo "Prepared Pages artifact at: $OUT_DIR"
