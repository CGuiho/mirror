#!/usr/bin/env bash
set -Eeuo pipefail

repo="${MIRROR_REPO:-CGuiho/mirror}"
version="${MIRROR_VERSION:-latest}"
install_dir="${MIRROR_INSTALL_DIR:-$HOME/.local/bin}"

usage() {
  printf '%s\n' "Install GUIHO Mirror native binary."
  printf '%s\n' "Environment: MIRROR_VERSION, MIRROR_REPO, MIRROR_INSTALL_DIR"
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'error: required command not found: %s\n' "$1" >&2
    exit 1
  }
}

detect_asset() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Linux) os="linux" ;;
    Darwin) os="macos" ;;
    *) printf 'error: unsupported OS: %s\n' "$os" >&2; exit 1 ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="x64-baseline" ;;
    arm64|aarch64) arch="arm64" ;;
    *) printf 'error: unsupported architecture: %s\n' "$arch" >&2; exit 1 ;;
  esac

  printf 'guiho-mirror-%s-%s' "$os" "$arch"
}

require_command curl
require_command install

asset="$(detect_asset)"
if [[ "$version" == "latest" ]]; then
  url="https://github.com/${repo}/releases/latest/download/${asset}"
else
  url="https://github.com/${repo}/releases/download/${version}/${asset}"
fi

tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT

printf 'Downloading %s\n' "$url"
curl -fsSL "$url" -o "$tmp/mirror"

mkdir -p "$install_dir"
install -m 0755 "$tmp/mirror" "$install_dir/mirror"
printf 'Installed mirror to %s\n' "$install_dir/mirror"
