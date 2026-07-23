#!/usr/bin/env bash
set -Eeuo pipefail

REPO="${MIRROR_REPO:-CGuiho/mirror}"
VERSION="${MIRROR_VERSION:-latest}"
INSTALL_DIR="${MIRROR_INSTALL_DIR:-$HOME/.local/bin}"
ARCH_OVERRIDE=""
VARIANT_OVERRIDE=""
OS=""
ARCH=""
CANDIDATES=()
TMP=""
INSTALL_CANDIDATE=""
INSTALL_BACKUP=""
INSTALL_DESTINATION=""

cleanup() {
  if [[ -n "$TMP" ]]; then
    rm -rf -- "$TMP"
  fi
  [[ -z "$INSTALL_CANDIDATE" ]] || rm -f -- "$INSTALL_CANDIDATE"
  if [[ -n "$INSTALL_BACKUP" && -e "$INSTALL_BACKUP" ]]; then
    if [[ -n "$INSTALL_DESTINATION" && ! -e "$INSTALL_DESTINATION" ]]; then
      mv -f -- "$INSTALL_BACKUP" "$INSTALL_DESTINATION"
    else
      printf 'warning: preserving mirror backup because rollback state is ambiguous: %s\n' "$INSTALL_BACKUP" >&2
    fi
  fi
}

trap cleanup EXIT

usage() {
  cat <<EOF
Install GUIHO Mirror as a native CLI binary from GitHub Releases.

Usage: install.sh [flags]

Flags:
  -v, --version VERSION   Version to install (default: latest).
                          Examples: latest, 0.4.7, @guiho/mirror@0.4.7
  --arch ARCH             Force architecture: x64 | arm64 (default: auto-detect)
  --variant VARIANT       Force x64 variant: baseline | default | modern (default: baseline)
  --install-dir DIR       Install directory (default: \$HOME/.local/bin)
  -h, --help              Show this help

Environment variables:
  MIRROR_VERSION           Same as --version
  MIRROR_REPO              GitHub repo (default: CGuiho/mirror)
  MIRROR_INSTALL_DIR       Same as --install-dir
EOF
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require_value() {
  local option="$1"
  local value="${2:-}"

  [[ -n "$value" ]] || fail "$option requires a value"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -v | --version)
        require_value "$1" "${2:-}"
        VERSION="$2"
        shift 2
        ;;
      --version=*)
        VERSION="${1#*=}"
        shift
        ;;
      --arch)
        require_value "$1" "${2:-}"
        ARCH_OVERRIDE="$2"
        shift 2
        ;;
      --arch=*)
        ARCH_OVERRIDE="${1#*=}"
        shift
        ;;
      --variant)
        require_value "$1" "${2:-}"
        VARIANT_OVERRIDE="$2"
        shift 2
        ;;
      --variant=*)
        VARIANT_OVERRIDE="${1#*=}"
        shift
        ;;
      --install-dir)
        require_value "$1" "${2:-}"
        INSTALL_DIR="$2"
        shift 2
        ;;
      --install-dir=*)
        INSTALL_DIR="${1#*=}"
        shift
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        fail "unknown flag: $1. Run with --help for usage."
        ;;
    esac
  done
}

detect_os() {
  case "$(uname -s)" in
    Linux) printf 'linux\n' ;;
    Darwin) printf 'darwin\n' ;;
    *) fail "unsupported OS: $(uname -s)" ;;
  esac
}

detect_arch() {
  if [[ -n "$ARCH_OVERRIDE" ]]; then
    case "$ARCH_OVERRIDE" in
      x64 | arm64) printf '%s\n' "$ARCH_OVERRIDE" ;;
      *) fail "invalid --arch '$ARCH_OVERRIDE'. Must be x64 or arm64." ;;
    esac
    return
  fi

  case "$(uname -m)" in
    x86_64 | amd64) printf 'x64\n' ;;
    arm64 | aarch64) printf 'arm64\n' ;;
    *) fail "unsupported architecture: $(uname -m)" ;;
  esac
}

build_candidates() {
  local variant="${VARIANT_OVERRIDE:-baseline}"

  if [[ "$ARCH" == "arm64" ]]; then
    [[ -z "$VARIANT_OVERRIDE" ]] || fail "--variant is only valid for x64 installs"
    CANDIDATES=("mirror-${OS}-arm64")
    return
  fi

  case "$variant" in
    baseline)
      CANDIDATES=("mirror-${OS}-x64-baseline" "mirror-${OS}-x64" "mirror-${OS}-x64-modern")
      ;;
    default)
      CANDIDATES=("mirror-${OS}-x64" "mirror-${OS}-x64-baseline" "mirror-${OS}-x64-modern")
      ;;
    modern)
      CANDIDATES=("mirror-${OS}-x64-modern" "mirror-${OS}-x64" "mirror-${OS}-x64-baseline")
      ;;
    *)
      fail "invalid --variant '$variant'. Must be baseline, default, or modern."
      ;;
  esac
}

build_url() {
  local asset="$1"

  if [[ -n "${MIRROR_DOWNLOAD_BASE_URL:-}" ]]; then
    printf '%s/%s\n' "${MIRROR_DOWNLOAD_BASE_URL%/}" "$asset"
    return
  fi

  if [[ "$VERSION" == "latest" ]]; then
    printf 'https://github.com/%s/releases/latest/download/%s\n' "$REPO" "$asset"
    return
  fi

  local tag
  case "$VERSION" in
    @guiho/mirror@*) tag="$VERSION" ;;
    @*) tag="$VERSION" ;;
    *) tag="@guiho/mirror@${VERSION}" ;;
  esac

  local encoded_tag="${tag//@/%40}"
  encoded_tag="${encoded_tag//\//%2F}"
  printf 'https://github.com/%s/releases/download/%s/%s\n' "$REPO" "$encoded_tag" "$asset"
}

verify_native_binary() {
  local path="$1"
  local magic2
  local magic4

  magic2="$(LC_ALL=C head -c 2 "$path" 2>/dev/null || true)"
  magic4="$(LC_ALL=C head -c 4 "$path" 2>/dev/null || true)"

  case "$OS" in
    linux)
      [[ "$magic4" == $'\177ELF' ]]
      ;;
    darwin)
      case "$magic4" in
        $'\xcf\xfa\xed\xfe' | $'\xce\xfa\xed\xfe' | $'\xfe\xed\xfa\xcf' | $'\xfe\xed\xfa\xce' | $'\xca\xfe\xba\xbe' | $'\xbe\xba\xfe\xca') return 0 ;;
        *) return 1 ;;
      esac
      ;;
    *)
      return 1
      ;;
  esac
}

verify_markdown_agent_asset() {
  local path="$1"
  local expected_name="$2"
  local magic2

  [[ -s "$path" ]] || return 1
  magic2="$(LC_ALL=C head -c 2 "$path" 2>/dev/null || true)"
  [[ "$magic2" != 'MZ' ]] || return 1
  LC_ALL=C grep -Iq . "$path" || return 1
  LC_ALL=C grep -Eq "^name:[[:space:]]*['\"]?${expected_name}['\"]?[[:space:]]*\r?$" "$path" || return 1
  LC_ALL=C grep -Eq '^#[[:space:]]+[^[:space:]]' "$path" || return 1
}

normalize_version() {
  local value="$1"
  value="${value#@guiho/mirror@}"
  value="${value#v}"
  printf '%s\n' "$value"
}

executable_version() {
  local path="$1"
  local output
  local output_file
  output_file="$(mktemp)"
  MIRROR_DISABLE_UPDATE_CHECK=1 "$path" --version >"$output_file" 2>&1 &
  local verification_pid=$!
  local attempts=0
  while kill -0 "$verification_pid" 2>/dev/null; do
    if [[ "$attempts" -ge 150 ]]; then
      kill -TERM "$verification_pid" 2>/dev/null || true
      sleep 0.1
      kill -KILL "$verification_pid" 2>/dev/null || true
      wait "$verification_pid" 2>/dev/null || true
      output="$(cat "$output_file")"
      rm -f -- "$output_file"
      printf 'executable verification timed out for %s after 15 seconds: %s\n' "$path" "$output" >&2
      return 1
    fi
    sleep 0.1
    attempts=$((attempts + 1))
  done
  local exit_code=0
  wait "$verification_pid" || exit_code=$?
  output="$(cat "$output_file")"
  rm -f -- "$output_file"
  if [[ "$exit_code" -ne 0 ]]; then
    printf 'executable verification failed for %s: %s\n' "$path" "$output" >&2
    return 1
  fi
  local version
  version="$(printf '%s\n' "$output" | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?' | head -n 1)"
  if [[ -z "$version" ]]; then
    printf 'executable verification did not return a semantic version for %s: %s\n' "$path" "$output" >&2
    return 1
  fi
  printf '%s\n' "$version"
}

shell_profile_path() {
  local shell_name="${SHELL##*/}"

  case "$shell_name" in
    fish) printf '%s/.config/fish/config.fish\n' "$HOME" ;;
    zsh) printf '%s/.zshrc\n' "$HOME" ;;
    bash)
      if [[ "$OS" == "darwin" && -f "$HOME/.bash_profile" ]]; then
        printf '%s/.bash_profile\n' "$HOME"
      else
        printf '%s/.bashrc\n' "$HOME"
      fi
      ;;
    *) printf '%s/.profile\n' "$HOME" ;;
  esac
}

path_contains_install_dir() {
  case ":$PATH:" in
    *:"$INSTALL_DIR":*) return 0 ;;
    *) return 1 ;;
  esac
}

append_path_to_profile() {
  local profile="$1"
  local shell_name="${SHELL##*/}"

  if [[ "$shell_name" == "fish" ]]; then
    mkdir -p "$HOME/.config/fish"
    if [[ -f "$profile" ]] && grep -Fq "$INSTALL_DIR" "$profile"; then
      return 0
    fi
    printf '\n# Added by mirror installer\nfish_add_path %q\n' "$INSTALL_DIR" >>"$profile"
    return 0
  fi

  if [[ -f "$profile" ]] && grep -Fq "$INSTALL_DIR" "$profile"; then
    return 0
  fi

  printf '\n# Added by mirror installer\nexport PATH=%q:$PATH\n' "$INSTALL_DIR" >>"$profile"
}

ensure_path() {
  export PATH="$INSTALL_DIR:$PATH"

  if path_contains_install_dir; then
    printf 'mirror: %s is available in PATH for this installer process.\n' "$INSTALL_DIR"
  fi

  local profile
  profile="$(shell_profile_path)"
  append_path_to_profile "$profile"

  printf 'mirror: ensured %s is added to PATH in %s\n' "$INSTALL_DIR" "$profile"
  printf 'mirror: restart your terminal, or run this for the current shell:\n'
  printf '  export PATH=%q:$PATH\n' "$INSTALL_DIR"
}

check_shadowing() {
  local installed="$INSTALL_DIR/mirror"
  local resolved

  resolved="$(command -v mirror 2>/dev/null || true)"
  [[ -n "$resolved" ]] || return 0
  [[ "$resolved" == "$installed" ]] && return 0

  printf '\nwarning: another mirror appears earlier in PATH:\n' >&2
  printf '  %s\n' "$resolved" >&2
  printf 'The newly installed binary is at:\n' >&2
  printf '  %s\n' "$installed" >&2
}

install_binary() {
  TMP="$(mktemp -d)"
  mkdir -p "$INSTALL_DIR"

  local destination="$INSTALL_DIR/mirror"
  local transaction_id="$$-${RANDOM:-0}"
  local candidate="$INSTALL_DIR/.mirror-install-${transaction_id}"
  local backup="$INSTALL_DIR/.mirror-backup-${transaction_id}"
  INSTALL_DESTINATION="$destination"
  INSTALL_CANDIDATE="$candidate"
  INSTALL_BACKUP="$backup"

  for asset in "${CANDIDATES[@]}"; do
    local url
    url="$(build_url "$asset")"
    printf '  Trying %s\n' "$url"

    printf 'Initiating GUIHO CLI Upgrade / Installation Sequence...\n'
    printf 'Target Version: v%s\n' "$(normalize_version "$VERSION")"
    printf 'Architecture:   %s\n' "$ARCH"
    printf 'Variant:        %s\n' "${VARIANT_OVERRIDE:-baseline}"
    printf 'Source URL:     %s\n' "$url"
    printf 'Downloading native binary with progress...\n'
    if curl --fail --location --progress-bar --proto '=https' --tlsv1.2 "$url" --output "$TMP/mirror"; then
      if ! verify_native_binary "$TMP/mirror"; then
        printf '  %s was not a native binary, trying next candidate...\n' "$asset" >&2
        continue
      fi

      install -m 0755 "$TMP/mirror" "$candidate"
      local candidate_version
      if ! candidate_version="$(executable_version "$candidate")"; then
        rm -f -- "$candidate"
        printf '  %s failed executable verification; trying next candidate...\n' "$asset" >&2
        continue
      fi
      if [[ "$VERSION" != "latest" && "$candidate_version" != "$(normalize_version "$VERSION")" ]]; then
        rm -f -- "$candidate"
        printf '  %s reports %s, expected %s; trying next candidate...\n' "$asset" "$candidate_version" "$(normalize_version "$VERSION")" >&2
        continue
      fi

      local backup_created=0
      if [[ -e "$destination" ]]; then
        mv -f -- "$destination" "$backup"
        backup_created=1
      fi
      if ! mv -f -- "$candidate" "$destination"; then
        [[ "$backup_created" -eq 0 ]] || mv -f -- "$backup" "$destination"
        fail "failed to install the candidate at $destination"
      fi

      local installed_version=""
      if ! installed_version="$(executable_version "$destination")" || [[ "$installed_version" != "$candidate_version" ]]; then
        rm -f -- "$destination"
        [[ "$backup_created" -eq 0 ]] || mv -f -- "$backup" "$destination"
        fail "installed mirror verification failed; the previous executable was restored"
      fi
      rm -f -- "$backup"
      printf 'Installed mirror to %s\n' "$destination"
      printf 'Saving Mirror schema: %s/.guiho/mirror/schema.json\n' "$HOME"
      "$destination" config schema --save --format json >/dev/null
      local skill_url
      local prompt_url
      skill_url="$(build_url guiho-s-mirror.md)"
      prompt_url="$(build_url guiho-i-mirror.md)"
      printf 'Downloading skill asset: %s\n' "$skill_url"
      curl --fail --location --progress-bar --proto '=https' --tlsv1.2 "$skill_url" --output "$TMP/guiho-s-mirror.md"
      printf 'Downloading instruction/prompt asset: %s\n' "$prompt_url"
      curl --fail --location --progress-bar --proto '=https' --tlsv1.2 "$prompt_url" --output "$TMP/guiho-i-mirror.md"
      verify_markdown_agent_asset "$TMP/guiho-s-mirror.md" 'guiho-s-mirror' \
        || fail 'downloaded guiho-s-mirror.md was not valid Markdown skill content'
      verify_markdown_agent_asset "$TMP/guiho-i-mirror.md" 'guiho-i-mirror' \
        || fail 'downloaded guiho-i-mirror.md was not valid Markdown prompt content'
      for skill_destination in "$HOME/.agents/skills/guiho-s-mirror" "$HOME/.claude/skills/guiho-s-mirror"; do
        mkdir -p "$skill_destination"
        install -m 0644 "$TMP/guiho-s-mirror.md" "$skill_destination/SKILL.md"
        printf 'Installed skill: %s\n' "$skill_destination"
      done
      for instruction_file in AGENTS.md CLAUDE.md; do
        [[ ! -f "$PWD/$instruction_file" ]] || printf 'Discovered instruction file: %s\n' "$PWD/$instruction_file"
      done
      printf 'Reconciling project instruction blocks...\n'
      "$destination" agent instruction update
      if [[ "${MIRROR_SKIP_PATH_UPDATE:-0}" != "1" ]]; then
        ensure_path
        check_shadowing
      fi
      printf 'Final verification: %s --version\n' "$destination"
      printf 'Verified: %s --version -> %s\n' "$destination" "$installed_version"
      return 0
    fi

    printf '  not available, trying next...\n'
  done

  fail "no compatible mirror binary found. Check available assets at: https://github.com/${REPO}/releases"
}

main() {
  parse_args "$@"
  require_command curl
  require_command grep
  require_command head
  require_command install
  require_command mv
  require_command mktemp
  require_command uname

  OS="$(detect_os)"
  ARCH="$(detect_arch)"
  build_candidates

  local variant_label=""
  [[ -z "$VARIANT_OVERRIDE" ]] || variant_label=" variant=${VARIANT_OVERRIDE}"
  printf 'mirror: %s  os=%s  arch=%s%s\n' "$VERSION" "$OS" "$ARCH" "$variant_label"
  install_binary
}

main "$@"
