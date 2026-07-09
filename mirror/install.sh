#!/usr/bin/env bash
set -Eeuo pipefail

# === Defaults (overridable via env vars or CLI flags) ===
REPO="${MIRROR_REPO:-CGuiho/mirror}"
VERSION="${MIRROR_VERSION:-latest}"
INSTALL_DIR="${MIRROR_INSTALL_DIR:-$HOME/.local/bin}"
ARCH_OVERRIDE=""
VARIANT_OVERRIDE=""

# === Usage ===
usage() {
  cat <<EOF
Install GUIHO Mirror — native CLI binary from GitHub Releases.

Usage: install.sh [flags]

Flags:
  -v, --version VERSION   Version to install (default: latest).
                          Examples: latest, alpha, 3.3.1, @guiho/mirror@3.3.1
  --arch ARCH             Force architecture: x64 | arm64 (default: auto-detect)
  --variant VARIANT       Force variant for x64: baseline | modern (default: baseline)
  --install-dir DIR       Install directory (default: \$HOME/.local/bin)
  -h, --help              Show this help

Environment variables:
  MIRROR_VERSION          Same as --version
  MIRROR_REPO             GitHub repo (default: CGuiho/mirror)
  MIRROR_INSTALL_DIR      Install directory
EOF
  exit 0
}

# === Parse CLI flags ===
while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--version)
      VERSION="$2"; shift 2 ;;
    --version=*)
      VERSION="${1#*=}"; shift ;;
    --arch)
      ARCH_OVERRIDE="$2"; shift 2 ;;
    --arch=*)
      ARCH_OVERRIDE="${1#*=}"; shift ;;
    --variant)
      VARIANT_OVERRIDE="$2"; shift 2 ;;
    --variant=*)
      VARIANT_OVERRIDE="${1#*=}"; shift ;;
    --install-dir)
      INSTALL_DIR="$2"; shift 2 ;;
    --install-dir=*)
      INSTALL_DIR="${1#*=}"; shift ;;
    -h|--help)
      usage ;;
    *)
      echo "Unknown flag: $1" >&2
      echo "Run with --help for usage." >&2
      exit 1 ;;
  esac
done

# === Detect OS ===
detect_os() {
  case "$(uname -s)" in
    Linux)  echo "linux" ;;
    Darwin) echo "macos" ;;
    *)
      echo "error: unsupported OS: $(uname -s)" >&2
      exit 1 ;;
  esac
}

# === Detect architecture ===
detect_arch() {
  if [[ -n "$ARCH_OVERRIDE" ]]; then
    case "$ARCH_OVERRIDE" in
      x64|arm64) echo "$ARCH_OVERRIDE" ;;
      *)
        echo "error: invalid --arch '$ARCH_OVERRIDE'. Must be x64 or arm64." >&2
        exit 1 ;;
    esac
  fi

  case "$(uname -m)" in
    x86_64|amd64) echo "x64" ;;
    arm64|aarch64) echo "arm64" ;;
    *)
      echo "error: unsupported architecture: $(uname -m)" >&2
      exit 1 ;;
  esac
}

# === Build asset candidates (baseline-first for x64) ===
build_candidates() {
  local os="$1"
  local arch="$2"

  if [[ "$arch" == "x64" ]]; then
    local variant="${VARIANT_OVERRIDE:-baseline}"
    case "$variant" in
      baseline)
        echo "guiho-mirror-${os}-x64-baseline guiho-mirror-${os}-x64 guiho-mirror-${os}-x64-modern" ;;
      modern)
        echo "guiho-mirror-${os}-x64-modern guiho-mirror-${os}-x64 guiho-mirror-${os}-x64-baseline" ;;
      *)
        echo "guiho-mirror-${os}-x64-${variant} guiho-mirror-${os}-x64-baseline guiho-mirror-${os}-x64 guiho-mirror-${os}-x64-modern" ;;
    esac
  else
    echo "guiho-mirror-${os}-${arch}"
  fi
}

# === Build download URL ===
build_url() {
  local asset="$1"

  if [[ "$VERSION" == "latest" ]]; then
    echo "https://github.com/${REPO}/releases/latest/download/${asset}"
    return
  fi

  # Convert version to release tag
  local tag
  case "$VERSION" in
    @guiho/mirror@*) tag="$VERSION" ;;
    @*)               tag="$VERSION" ;;
    *)                tag="@guiho/mirror@${VERSION}" ;;
  esac

  local encoded_tag
  encoded_tag="$(printf '%s' "$tag" | sed 's/@/%40/g; s#/#%2F#g')"
  echo "https://github.com/${REPO}/releases/download/${encoded_tag}/${asset}"
}

# === Main ===
require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "error: required command not found: $1" >&2
    exit 1
  }
}

require_command curl

OS="$(detect_os)"
ARCH="$(detect_arch)"

echo "mirror: ${VERSION}  os=${OS}  arch=${ARCH}${VARIANT_OVERRIDE:+ variant=${VARIANT_OVERRIDE}}"

CANDIDATES="$(build_candidates "$OS" "$ARCH")"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT

for ASSET in $CANDIDATES; do
  URL="$(build_url "$ASSET")"
  echo "  Trying ${URL}"
  if curl -fsSL "$URL" -o "$TMP/mirror" 2>/dev/null; then
    mkdir -p "$INSTALL_DIR"
    install -m 0755 "$TMP/mirror" "$INSTALL_DIR/mirror"
    echo "Installed mirror to ${INSTALL_DIR}/mirror"
    echo "Run: mirror --version"
    exit 0
  fi
  echo "  not available, trying next..."
done

echo "error: no compatible mirror binary found" >&2
echo "Check available assets at: https://github.com/${REPO}/releases" >&2
exit 1
