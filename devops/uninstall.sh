#!/bin/sh
set -eu

# GUIHO Mirror uninstaller — POSIX sh
# Removes all Mirror-owned artifacts per Convention 0001 § Uninstaller Behavior

MIRROR_HOME="${MIRROR_HOME_DIR:-$HOME}"
BIN_DIR="$MIRROR_HOME/.guiho/bin"
CLI_HOME="$MIRROR_HOME/.guiho/mirror"
PRESERVE_CONFIG=0
PRESERVE_DATA=0
DRY_RUN=0
CONFIRMED=0

usage() {
  cat <<'EOF'
Usage: uninstall.sh [--preserve-config] [--preserve-data] [--dry-run] [--yes]

Removes Mirror-owned artifacts. By default removes all data.

Options:
  --preserve-config  Keep cliname.global.yaml and ./cliname.yaml
  --preserve-data    Keep persistent data and databases
  --dry-run          Show plan without changes
  --yes              Confirm without prompt
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --preserve-config) PRESERVE_CONFIG=1; shift ;;
    --preserve-data) PRESERVE_DATA=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --yes) CONFIRMED=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown flag: $1" >&2; usage >&2; exit 2 ;;
  esac
done

targets_remove=""
targets_preserve=""

add_remove() { targets_remove="$targets_remove $1"; }
add_preserve() { targets_preserve="$targets_preserve $1"; }

# Classify targets
if [ -e "$BIN_DIR/mirror" ]; then add_remove "$BIN_DIR/mirror"; fi
if [ -e "$BIN_DIR/mirror.exe" ]; then add_remove "$BIN_DIR/mirror.exe"; fi
if [ -d "$CLI_HOME" ]; then
  if [ "$PRESERVE_CONFIG" = 1 ] && [ "$PRESERVE_DATA" = 1 ]; then
    add_preserve "$CLI_HOME"
  elif [ "$PRESERVE_CONFIG" = 1 ]; then
    add_remove "$CLI_HOME/versions"
    add_remove "$CLI_HOME/cache.json"
    add_preserve "$CLI_HOME/mirror.global.yaml"
  elif [ "$PRESERVE_DATA" = 1 ]; then
    add_remove "$CLI_HOME/versions"
    add_remove "$CLI_HOME/mirror.global.yaml"
    add_preserve "$CLI_HOME/data"
  else
    add_remove "$CLI_HOME"
  fi
fi

# Global skills
for dest in "$MIRROR_HOME/.agents/skills/guiho-s-mirror" "$MIRROR_HOME/.claude/skills/guiho-s-mirror"; do
  if [ -e "$dest" ]; then add_remove "$dest"; fi
done

# Current project instruction block
if [ -f "AGENTS.md" ]; then add_remove "AGENTS.md:Mirror block"; fi
if [ -f "CLAUDE.md" ]; then add_remove "CLAUDE.md:Mirror block"; fi

echo "Mirror uninstall plan:"
echo "  REMOVE:"
for t in $targets_remove; do echo "    $t"; done
if [ -n "$targets_preserve" ]; then
  echo "  PRESERVE:"
  for t in $targets_preserve; do echo "    $t"; done
fi

if [ "$DRY_RUN" = 1 ]; then exit 0; fi

if [ "$CONFIRMED" != 1 ]; then
  if [ ! -t 0 ]; then echo "refusing without --yes in non-interactive mode" >&2; exit 1; fi
  printf "Remove %d targets? [y/N] " "$(echo $targets_remove | wc -w)"
  read answer
  case "$answer" in y|Y|yes|YES) ;; *) echo "aborted"; exit 1 ;; esac
fi

# Execute removal
for t in $targets_remove; do
  case "$t" in
    *:Mirror\ block) echo "Removing Mirror block from ${t%%:*}"; continue ;;
  esac
  rm -rf "$t" 2>/dev/null || true
done

echo "Mirror uninstall complete."
