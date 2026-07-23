#!/usr/bin/env bash
set -Eeuo pipefail

repo="${MIRROR_REPO:-CGuiho/mirror}"
version="${MIRROR_VERSION:-latest}"
api_base_url="${MIRROR_GITHUB_API_URL:-https://api.github.com}"
release_base_url="${MIRROR_RELEASE_BASE_URL:-https://github.com/${repo}/releases/download}"
install_dir="${MIRROR_INSTALL_DIR:-$HOME/.local/bin}"
arch_override=""
variant_override=""
os=""
arch=""
target_version=""
tmp=""
backup=""
candidates=()
curl_security_args=(--proto '=https' --tlsv1.2)

if [[ "${MIRROR_ALLOW_INSECURE_TEST_URLS:-0}" == '1' ]]; then
  curl_security_args=()
fi

cleanup() { [[ -z "$tmp" ]] || rm -f -- "$tmp"; }
trap cleanup EXIT

usage() {
  cat <<EOF
Install GUIHO Mirror as a verified native CLI binary from GitHub Releases.

Usage: install.sh [flags]

Flags:
  -v, --version VERSION   Exact semantic version, including prerelease (default: latest stable)
  --arch ARCH             Force architecture: x64 | arm64
  --variant VARIANT       Force x64 variant: baseline | default | modern
  --install-dir DIR       Install directory (default: \$HOME/.local/bin)
  -h, --help              Show this help
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

normalize_version() {
  local value="${1#@guiho/mirror@}"
  value="${value#v}"
  [[ "$value" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-(0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(\.(0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$ ]] || fail "invalid Mirror semantic version: $1"
  printf '%s\n' "$value"
}

resolve_target_version() {
  if [[ "$version" != "latest" ]]; then normalize_version "$version"; return; fi
  local metadata tag
  metadata="$(curl --fail --location --silent --show-error "${curl_security_args[@]}" -H 'User-Agent: mirror-installer' "${api_base_url%/}/repos/${repo}/releases/latest")"
  tag="$(printf '%s\n' "$metadata" | grep -m1 '"tag_name"' | sed -E 's/.*"tag_name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
  [[ -n "$tag" && "$tag" != "$metadata" ]] || fail 'latest Mirror release metadata did not include tag_name'
  normalize_version "$tag"
}

detect_os() {
  case "$(uname -s)" in Linux) printf 'linux\n' ;; Darwin) printf 'darwin\n' ;; *) fail "unsupported OS: $(uname -s)" ;; esac
}

detect_arch() {
  if [[ -n "$arch_override" ]]; then
    case "$arch_override" in x64|arm64) printf '%s\n' "$arch_override" ;; *) fail "invalid --arch '$arch_override'" ;; esac
    return
  fi
  case "$(uname -m)" in x86_64|amd64) printf 'x64\n' ;; arm64|aarch64) printf 'arm64\n' ;; *) fail "unsupported architecture: $(uname -m)" ;; esac
}

build_candidates() {
  local variant="${variant_override:-baseline}"
  if [[ "$arch" == "arm64" ]]; then
    [[ -z "$variant_override" ]] || fail '--variant is only valid for x64 installs'
    candidates=("mirror-${os}-arm64")
    return
  fi
  case "$variant" in
    baseline) candidates=("mirror-${os}-x64-baseline" "mirror-${os}-x64" "mirror-${os}-x64-modern") ;;
    default) candidates=("mirror-${os}-x64" "mirror-${os}-x64-baseline" "mirror-${os}-x64-modern") ;;
    modern) candidates=("mirror-${os}-x64-modern" "mirror-${os}-x64" "mirror-${os}-x64-baseline") ;;
    *) fail "invalid --variant '$variant'. Must be baseline, default, or modern." ;;
  esac
}

build_url() {
  local tag="@guiho/mirror@${target_version}"
  local encoded="${tag//@/%40}"
  encoded="${encoded//\//%2F}"
  printf '%s/%s/%s\n' "${release_base_url%/}" "$encoded" "$1"
}

verify_native_binary() {
  local magic4
  magic4="$(LC_ALL=C head -c 4 "$1" 2>/dev/null || true)"
  case "$os:$magic4" in
    linux:$'\177ELF'|darwin:$'\xcf\xfa\xed\xfe'|darwin:$'\xce\xfa\xed\xfe'|darwin:$'\xfe\xed\xfa\xcf'|darwin:$'\xfe\xed\xfa\xce'|darwin:$'\xca\xfe\xba\xbe'|darwin:$'\xbe\xba\xfe\xca') return 0 ;;
    *) return 1 ;;
  esac
}

read_binary_version() {
  local binary="$1" timeout_seconds="${MIRROR_VERIFY_TIMEOUT_SECONDS:-10}"
  local output_file="${binary}.version-$$" error_file="${binary}.version-error-$$"
  "$binary" --version >"$output_file" 2>"$error_file" &
  local pid=$! ticks=0 max_ticks=$((timeout_seconds * 10))
  while kill -0 "$pid" 2>/dev/null; do
    if (( ticks >= max_ticks )); then
      kill -TERM "$pid" 2>/dev/null || true
      sleep 0.1
      kill -KILL "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      rm -f -- "$output_file" "$error_file"
      printf 'timed out after %s seconds while running %s --version\n' "$timeout_seconds" "$binary" >&2
      return 124
    fi
    sleep 0.1
    ((ticks += 1))
  done
  local exit_code=0
  wait "$pid" || exit_code=$?
  if (( exit_code != 0 )); then
    local details
    details="$(cat "$error_file" 2>/dev/null || true)"
    rm -f -- "$output_file" "$error_file"
    printf '%s --version failed with exit code %s%s\n' "$binary" "$exit_code" "${details:+: $details}" >&2
    return "$exit_code"
  fi
  tr -d '\r\n' <"$output_file"
  rm -f -- "$output_file" "$error_file"
}

download_candidate() {
  local asset="$1" url="$2" http_code exit_code
  set +e
  http_code="$(curl --location --progress-bar --show-error "${curl_security_args[@]}" --output "$tmp" --write-out '%{http_code}' "$url")"
  exit_code=$?
  set -e
  if [[ $exit_code -ne 0 ]]; then fail "download failed for $url (curl exit $exit_code)"; fi
  if [[ "$http_code" == '404' ]]; then return 1; fi
  [[ "$http_code" =~ ^2 ]] || fail "download failed for $url (HTTP $http_code)"
  verify_native_binary "$tmp" || fail "$asset is not a native $os binary"
  chmod 755 "$tmp"
  local downloaded_version
  if ! downloaded_version="$(read_binary_version "$tmp")"; then
    fail "could not verify downloaded binary version"
  fi
  [[ "$downloaded_version" == "$target_version" ]] || fail "downloaded binary reported $downloaded_version; expected $target_version"
}

install_candidate() {
  local destination="$install_dir/mirror" failed="$install_dir/.mirror-failed-$(date +%s)-$$"
  local had_previous=0
  printf 'Replacing...\n'
  if [[ -e "$destination" ]]; then mv -- "$destination" "$backup"; had_previous=1; fi
  if ! mv -- "$tmp" "$destination"; then
    (( had_previous == 0 )) || mv -- "$backup" "$destination"
    fail "could not install Mirror at $destination"
  fi
  tmp=""
  printf 'Verifying...\n'
  local installed_version="" verification_failed=0
  if ! installed_version="$(read_binary_version "$destination")"; then
    verification_failed=1
  elif [[ "$installed_version" != "$target_version" ]]; then
    verification_failed=1
  fi
  if (( verification_failed == 1 )); then
    mv -- "$destination" "$failed" || true
    (( had_previous == 0 )) || mv -- "$backup" "$destination"
    fail "installed binary reported ${installed_version:-no version}; expected $target_version. Previous Mirror restored; failed artifact preserved at $failed"
  fi
  [[ ! -e "$backup" ]] || rm -f -- "$backup" || printf 'warning: verified upgrade is active; old backup remains at %s\n' "$backup" >&2
  printf 'Installed Mirror %s to %s\n' "$target_version" "$destination"
}

ensure_path() {
  export PATH="$install_dir:$PATH"
  local profile="${HOME}/.profile"
  case "${SHELL##*/}" in fish) profile="${HOME}/.config/fish/config.fish" ;; zsh) profile="${HOME}/.zshrc" ;; bash) profile="${HOME}/.bashrc" ;; esac
  mkdir -p "$(dirname "$profile")"
  if [[ "${SHELL##*/}" == 'fish' ]]; then
    grep -Fq "$install_dir" "$profile" 2>/dev/null || printf '\n# Added by Mirror installer\nfish_add_path %q\n' "$install_dir" >>"$profile"
  else
    grep -Fq "$install_dir" "$profile" 2>/dev/null || printf '\n# Added by Mirror installer\nexport PATH=%q:\$PATH\n' "$install_dir" >>"$profile"
  fi
}

install_agent_assets() {
  local agent_root="${HOME}/.agents/skills/guiho-s-mirror"
  local claude_root="${HOME}/.claude/skills/guiho-s-mirror"
  local skill_tmp="$install_dir/.guiho-s-mirror.md-$$"
  local prompt_tmp="$install_dir/.guiho-i-mirror.md-$$"
  local skill_url prompt_url
  skill_url="$(build_url 'guiho-s-mirror.md')"
  prompt_url="$(build_url 'guiho-i-mirror.md')"
  printf 'Downloading skill asset: %s\n' "$skill_url"
  curl --fail --location --progress-bar "${curl_security_args[@]}" --output "$skill_tmp" "$skill_url"
  printf 'Downloading instruction asset: %s\n' "$prompt_url"
  curl --fail --location --progress-bar "${curl_security_args[@]}" --output "$prompt_tmp" "$prompt_url"
  validate_markdown_asset "$skill_tmp" 'guiho-s-mirror'
  validate_markdown_asset "$prompt_tmp" 'guiho-i-mirror'
  mkdir -p "$agent_root" "$claude_root"
  cp -- "$skill_tmp" "$agent_root/SKILL.md"
  cp -- "$skill_tmp" "$claude_root/SKILL.md"
  printf 'Installed skill: %s\nInstalled skill: %s\n' "$agent_root" "$claude_root"

  local targets=()
  [[ ! -f AGENTS.md && ! -f CLAUDE.md ]] && : > AGENTS.md
  [[ -f AGENTS.md ]] && targets+=("AGENTS.md")
  [[ -f CLAUDE.md ]] && targets+=("CLAUDE.md")
  local target start='<!-- BEGIN MIRROR — DO NOT EDIT THIS SECTION -->' end='<!-- END MIRROR -->'
  for target in "${targets[@]}"; do
    printf 'Discovered instruction file: %s\n' "$target"
    awk -v start="$start" -v end="$end" '
      $0 == start { skip=1; next }
      $0 == end { skip=0; next }
      !skip { print }
    ' "$target" > "${target}.mirror.tmp"
    {
      cat "${target}.mirror.tmp"
      printf '\n%s\n' "$start"
      cat "$prompt_tmp"
      printf '\n%s\n' "$end"
    } > "$target"
    rm -f -- "${target}.mirror.tmp"
    printf 'Reconciled instruction block: %s\n' "$target"
  done
  rm -f -- "$skill_tmp" "$prompt_tmp"
}

validate_markdown_asset() {
  local path="$1" expected_name="$2" magic2 first_line
  [[ -s "$path" ]] || fail "$expected_name release asset is empty"
  magic2="$(LC_ALL=C head -c 2 "$path" 2>/dev/null || true)"
  [[ "$magic2" != 'MZ' ]] || fail "$expected_name release asset is a Windows executable, not Markdown"
  LC_ALL=C grep -Iq . "$path" || fail "$expected_name release asset is binary, not UTF-8 Markdown"
  IFS= read -r first_line < "$path" || true
  [[ "${first_line%$'\r'}" == '---' ]] || fail "$expected_name release asset is missing YAML frontmatter"
  LC_ALL=C grep -Eq "^name:[[:space:]]*${expected_name}[[:space:]]*\r?$" "$path" \
    || fail "$expected_name release asset has incorrect or missing frontmatter identity"
}

main() {
  parse_args "$@"
  for command in curl grep head sed uname; do require_command "$command"; done
  os="$(detect_os)"
  arch="$(detect_arch)"
  target_version="$(resolve_target_version)"
  build_candidates
  mkdir -p "$install_dir"
  tmp="$install_dir/.mirror-install-$$-$RANDOM"
  backup="$install_dir/.mirror-backup-$$-$RANDOM"

  local asset url selected=0
  for asset in "${candidates[@]}"; do
    url="$(build_url "$asset")"
    printf '%s\n' 'Initiating GUIHO CLI Upgrade / Installation Sequence...'
    printf 'Target Version: v%s\nArchitecture:   %s\nVariant:        %s\nSource URL:     %s\n' "$target_version" "$arch" "${variant_override:-baseline}" "$url"
    printf 'Binary Destination: %s/mirror\n' "$install_dir"
    printf '%s\n' '------------------------------------------------------------' 'Downloading...'
    if download_candidate "$asset" "$url"; then selected=1; break; fi
    printf '  %s is not published; trying the next compatible asset.\n' "$asset"
  done
  (( selected == 1 )) || fail "Mirror $target_version has no compatible $os/$arch binary"
  printf 'Validating...\n'
  install_candidate
  printf 'Saving Mirror schema: %s/.guiho/mirror/schema.json\n' "$HOME"
  "$destination" config schema --save --format json >/dev/null
  [[ "${MIRROR_NO_PATH_UPDATE:-0}" == '1' ]] || ensure_path
  install_agent_assets
  printf 'Run: mirror --version\n'
}

main "$@"
