#!/usr/bin/env bash
set -euo pipefail

PIDS=()
TARGETS=()
FAILED=0

compile() {
  local target="$1"
  local outfile="$2"
  bun build source/guiho-mirror-bin.ts --compile --production --minify-whitespace --minify-syntax --target "$target" --outfile "$outfile" &
  PIDS+=($!)
  TARGETS+=("$target → $outfile")
}

# ── Linux ────────────────────────────────────────────────────────────────────
compile bun-linux-arm64           bin/mirror-linux-arm64
compile bun-linux-x64             bin/mirror-linux-x64
compile bun-linux-x64-baseline    bin/mirror-linux-x64-baseline
compile bun-linux-x64-modern      bin/mirror-linux-x64-modern

# ── Windows ──────────────────────────────────────────────────────────────────
compile bun-windows-arm64         bin/mirror-windows-arm64.exe
compile bun-windows-x64           bin/mirror-windows-x64.exe
compile bun-windows-x64-baseline  bin/mirror-windows-x64-baseline.exe
compile bun-windows-x64-modern    bin/mirror-windows-x64-modern.exe

# ── macOS ────────────────────────────────────────────────────────────────────
compile bun-darwin-arm64          bin/mirror-darwin-arm64
compile bun-darwin-x64            bin/mirror-darwin-x64
compile bun-darwin-x64-baseline   bin/mirror-darwin-x64-baseline
compile bun-darwin-x64-modern     bin/mirror-darwin-x64-modern

# ── Wait for all and report ──────────────────────────────────────────────────
for i in "${!PIDS[@]}"; do
  if wait "${PIDS[$i]}"; then
    echo "  ✓ ${TARGETS[$i]}"
  else
    echo "  ✗ ${TARGETS[$i]}"
    FAILED=1
  fi
done

if [[ "$FAILED" -eq 1 ]]; then
  echo ""
  echo "error: one or more compilations failed"
  exit 1
fi
