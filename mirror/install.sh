#!/usr/bin/env bash
set -Eeuo pipefail

repo="${MIRROR_REPO:-CGuiho/mirror}"
version="${MIRROR_VERSION:-latest}"
install_dir="${MIRROR_INSTALL_DIR:-$HOME/.local/bin}"
arch_override=""
variant_override=""
os=""
arch=""
tmp=""
candidates=()

cleanup() { [[ -z "$tmp" ]] || rm -rf -- "$tmp"; }
trap cleanup EXIT

usage() {
  cat <<EOF
Install GUIHO Mirror as a native CLI binary from GitHub Releases.

Usage: install.sh [flags]

Flags:
  -v, --version VERSION   Version to install (default: latest).
  --arch ARCH             Force architecture: x64 | arm64 (default: auto-detect)
  --variant VARIANT       Force x64 variant: baseline | default | modern (default: baseline)
  --install-dir DIR       Install directory (default: \$HOME/.local/bin)
  -h, --help              Show this help

Environment variables:
  MIRROR_VERSION          Same as --version
  MIRROR_REPO             GitHub repo (default: CGuiho/mirror)
  MIRROR_INSTALL_DIR      Same as --install-dir
EOF
}

fail() { printf 'error: %s\n' "$*" >&2; exit 1; }
require_command() { command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"; }
require_value() { [[ -n "${2:-}" ]] || fail "$1 requires a value"; }

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -v|--version) require_value "$1" "${2:-}"; version="$2"; shift 2 ;;
      --version=*) version="${1#*=}"; shift ;;
      --arch) require_value "$1" "${2:-}"; arch_override="$2"; shift 2 ;;
      --arch=*) arch_override="${1#*=}"; shift ;;
      --variant) require_value "$1" "${2:-}"; variant_override="$2"; shift 2 ;;
      --variant=*) variant_override="${1#*=}"; shift ;;
      --install-dir) require_value "$1" "${2:-}"; install_dir="$2"; shift 2 ;;
      --install-dir=*) install_dir="${1#*=}"; shift ;;
      -h|--help) usage; exit 0 ;;
      *) fail "unknown flag: $1" ;;
    esac
  done
}

detect_os() {
  case "$(uname -s)" in
    Linux) printf 'linux\n' ;;
    Darwin) printf 'macos\n' ;;
    *) fail "unsupported OS: $(uname -s)" ;;
  esac
}

detect_arch() {
  if [[ -n "$arch_override" ]]; then
    case "$arch_override" in x64|arm64) printf '%s\n' "$arch_override" ;; *) fail "invalid --arch '$arch_override'" ;; esac
    return
  fi
  case "$(uname -m)" in
    x86_64|amd64) printf 'x64\n' ;;
    arm64|aarch64) printf 'arm64\n' ;;
    *) fail "unsupported architecture: $(uname -m)" ;;
  esac
}

build_candidates() {
  local variant="${variant_override:-baseline}"
  if [[ "$arch" == "arm64" ]]; then
    [[ -z "$variant_override" ]] || fail "--variant is only valid for x64 installs"
    candidates=("guiho-mirror-${os}-arm64")
    return
  fi
  case "$variant" in
    baseline) candidates=("guiho-mirror-${os}-x64-baseline" "guiho-mirror-${os}-x64" "guiho-mirror-${os}-x64-modern") ;;
    default) candidates=("guiho-mirror-${os}-x64" "guiho-mirror-${os}-x64-baseline" "guiho-mirror-${os}-x64-modern") ;;
    modern) candidates=("guiho-mirror-${os}-x64-modern" "guiho-mirror-${os}-x64" "guiho-mirror-${os}-x64-baseline") ;;
    *) fail "invalid --variant '$variant'. Must be baseline, default, or modern." ;;
  esac
}

build_url() {
  local asset="$1"
  if [[ "$version" == "latest" ]]; then
    printf 'https://github.com/%s/releases/latest/download/%s\n' "$repo" "$asset"
    return
  fi
  local tag
  case "$version" in @guiho/mirror@*) tag="$version" ;; @*) tag="$version" ;; *) tag="@guiho/mirror@${version}" ;; esac
  local encoded="${tag//@/%40}"
  encoded="${encoded//\//%2F}"
  printf 'https://github.com/%s/releases/download/%s/%s\n' "$repo" "$encoded" "$asset"
}

verify_native_binary() {
  local path="$1"
  local magic2 magic4
  magic2="$(LC_ALL=C head -c 2 "$path" 2>/dev/null || true)"
  magic4="$(LC_ALL=C head -c 4 "$path" 2>/dev/null || true)"
  case "$magic4" in $'\177ELF'|$'\xcf\xfa\xed\xfe'|$'\xce\xfa\xed\xfe'|$'\xca\xfe\xba\xbe') return 0 ;; '<!DO'|'<htm') return 1 ;; esac
  case "$magic2" in MZ) return 0 ;; '#!') return 1 ;; esac
  return 2
}

shell_profile_path() {
  local shell_name="${SHELL##*/}"
  case "$shell_name" in fish) printf '%s/.config/fish/config.fish\n' "$HOME" ;; zsh) printf '%s/.zshrc\n' "$HOME" ;; bash) printf '%s/.bashrc\n' "$HOME" ;; *) printf '%s/.profile\n' "$HOME" ;; esac
}

ensure_path() {
  export PATH="$install_dir:$PATH"
  local profile shell_name
  profile="$(shell_profile_path)"
  shell_name="${SHELL##*/}"
  if [[ "$shell_name" == "fish" ]]; then
    mkdir -p "$HOME/.config/fish"
    grep -Fq "$install_dir" "$profile" 2>/dev/null || printf '\n# Added by Mirror installer\nfish_add_path %q\n' "$install_dir" >>"$profile"
  else
    grep -Fq "$install_dir" "$profile" 2>/dev/null || printf '\n# Added by Mirror installer\nexport PATH=%q:\$PATH\n' "$install_dir" >>"$profile"
  fi
  printf 'mirror: ensured %s is added to PATH in %s\n' "$install_dir" "$profile"
  printf 'mirror: restart your terminal, or run: export PATH=%q:\$PATH\n' "$install_dir"
}

install_binary() {
  tmp="$(mktemp -d)"
  for asset in "${candidates[@]}"; do
    local url
    url="$(build_url "$asset")"
    printf '  Trying %s\n' "$url"
    if curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 "$url" --output "$tmp/mirror"; then
      verify_native_binary "$tmp/mirror" || { printf '  %s was not a native binary, trying next...\n' "$asset" >&2; continue; }
      mkdir -p "$install_dir"
      install -m 0755 "$tmp/mirror" "$install_dir/mirror"
      printf 'Installed mirror to %s/mirror\n' "$install_dir"
      ensure_path
      printf 'Run: mirror --version\n'
      return 0
    fi
    printf '  not available, trying next...\n'
  done
  fail "no compatible Mirror binary found. Check available assets at: https://github.com/${repo}/releases"
}

main() {
  parse_args "$@"
  require_command curl
  require_command head
  require_command install
  require_command mktemp
  require_command uname
  os="$(detect_os)"
  arch="$(detect_arch)"
  build_candidates
  printf 'mirror: %s  os=%s  arch=%s%s\n' "$version" "$os" "$arch" "${variant_override:+ variant=${variant_override}}"
  install_binary
}

main "$@"
