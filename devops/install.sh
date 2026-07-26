#!/usr/bin/env bash
set -euo pipefail

REPO="${MIRROR_REPO:-CGuiho/mirror}"
VERSION="${MIRROR_VERSION:-latest}"
MIRROR_HOME="${MIRROR_HOME_DIR:-$HOME}"
INSTALL_DIR="${MIRROR_INSTALL_DIR:-$MIRROR_HOME/.local/bin}"
BEGIN_MARKER='<!-- BEGIN MIRROR — DO NOT EDIT THIS SECTION -->'
END_MARKER='<!-- END MIRROR -->'

usage() {
  cat <<'EOF'
Install GUIHO Mirror from the canonical Go release.

Usage: install.sh [--version <semver>] [--install-dir <path>]

Environment:
  MIRROR_REPO               GitHub repository (default: CGuiho/mirror)
  MIRROR_VERSION            Exact version or latest
  MIRROR_INSTALL_DIR        Binary installation directory
  MIRROR_DOWNLOAD_BASE_URL  Override the release-asset base URL
  MIRROR_ASSET_DIR          Read already-downloaded assets from this directory
  MIRROR_TEST_OS            Override OS detection for isolated tests
  MIRROR_TEST_ARCH          Override architecture detection for isolated tests
  MIRROR_SKIP_PATH_UPDATE   Set to 1 to avoid shell profile mutation
EOF
}

while (($#)); do
  case "$1" in
    --version) VERSION="${2:?--version requires a value}"; shift 2 ;;
    --install-dir) INSTALL_DIR="${2:?--install-dir requires a value}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown installer argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

detect_asset() {
  local detected_os detected_arch
  detected_os="${MIRROR_TEST_OS:-$(uname -s)}"
  detected_arch="${MIRROR_TEST_ARCH:-$(uname -m)}"
  detected_os="$(printf '%s' "$detected_os" | tr '[:upper:]' '[:lower:]')"
  detected_arch="$(printf '%s' "$detected_arch" | tr '[:upper:]' '[:lower:]')"
  case "$detected_os:$detected_arch" in
    linux:x86_64|linux:amd64) printf 'mirror-linux-amd64\n' ;;
    linux:aarch64|linux:arm64) printf 'mirror-linux-arm64\n' ;;
    linux:armv7l|linux:armv7) printf 'mirror-linux-armv7\n' ;;
    linux:armv6l|linux:armv6) printf 'mirror-linux-armv6\n' ;;
    darwin:x86_64|darwin:amd64) printf 'mirror-darwin-amd64\n' ;;
    darwin:arm64|darwin:aarch64) printf 'mirror-darwin-arm64\n' ;;
    *) printf 'Unsupported Mirror installer target: %s/%s\n' "$detected_os" "$detected_arch" >&2; return 1 ;;
  esac
}

resolve_version() {
  local requested="$1" tag
  requested="${requested#mirror/v}"
  requested="${requested#v}"
  if [[ "$requested" != latest ]]; then
    printf '%s\n' "$requested"
    return
  fi
  if [[ -n "${MIRROR_ASSET_DIR:-}" ]]; then
    printf 'An exact --version is required with MIRROR_ASSET_DIR.\n' >&2
    return 1
  fi
  tag="$(curl --fail --silent --show-error --location \
    --proto '=https' --tlsv1.2 \
    "https://api.github.com/repos/${REPO}/releases/latest" \
    | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    | head -n 1)"
  case "$tag" in
    mirror/v*) printf '%s\n' "${tag#mirror/v}" ;;
    *) printf 'Latest release tag is not canonical: %s\n' "$tag" >&2; return 1 ;;
  esac
}

asset_base_url() {
  local version="$1"
  if [[ -n "${MIRROR_DOWNLOAD_BASE_URL:-}" ]]; then
    printf '%s\n' "${MIRROR_DOWNLOAD_BASE_URL%/}"
  else
    printf 'https://github.com/%s/releases/download/mirror%%2Fv%s\n' "$REPO" "$version"
  fi
}

download_asset() {
  local name="$1" destination="$2" base="$3"
  if [[ -n "${MIRROR_ASSET_DIR:-}" ]]; then
    cp "${MIRROR_ASSET_DIR%/}/$name" "$destination"
    return
  fi
  printf 'Downloading %s\n' "$base/$name"
  curl --fail --location --progress-bar --proto '=https' --tlsv1.2 "$base/$name" --output "$destination"
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    printf 'sha256sum or shasum is required.\n' >&2
    return 1
  fi
}

verify_asset() {
  local manifest="$1" name="$2" path="$3" expected actual
  expected="$(awk -v name="$name" '$2 == name || $2 == "*" name {print tolower($1)}' "$manifest")"
  [[ "$expected" =~ ^[0-9a-f]{64}$ ]] || { printf 'Missing checksum for %s\n' "$name" >&2; return 1; }
  actual="$(sha256_file "$path")"
  [[ "$actual" == "$expected" ]] || { printf 'Checksum mismatch for %s\n' "$name" >&2; return 1; }
  printf 'Verified SHA-256: %s\n' "$name"
}

verify_markdown() {
  local path="$1" name="$2"
  [[ -s "$path" ]] || return 1
  LC_ALL=C grep -a -q '^---$' "$path"
  LC_ALL=C grep -a -q "^name:[[:space:]]*$name[[:space:]]*$" "$path"
  cmp -s "$path" <(LC_ALL=C tr -d '\000' < "$path")
}

install_skill() {
  local source="$1" destination="$2" parent stage backup
  parent="$(dirname "$destination")"
  mkdir -p "$parent"
  stage="$(mktemp -d "$parent/.mirror-skill-new.XXXXXX")"
  backup="$parent/.mirror-skill-backup.$$"
  install -m 0644 "$source" "$stage/SKILL.md"
  rm -rf "$backup"
  if [[ -e "$destination" ]]; then mv "$destination" "$backup"; fi
  if ! mv "$stage" "$destination"; then
    [[ -e "$backup" ]] && mv "$backup" "$destination"
    return 1
  fi
  rm -rf "$backup"
  printf 'Installed skill: %s\n' "$destination"
}

write_instruction_file() {
  local path="$1" prompt="$2" parent temporary
  parent="$(dirname "$path")"
  mkdir -p "$parent"
  temporary="$(mktemp "$parent/.mirror-instruction.XXXXXX")"
  if [[ -f "$path" ]]; then
    awk -v begin="$BEGIN_MARKER" -v end="$END_MARKER" '
      $0 == begin {inside=1; next}
      $0 == end {inside=0; next}
      !inside {print}
    ' "$path" > "$temporary"
  fi
  if [[ -s "$temporary" ]]; then printf '\n' >> "$temporary"; fi
  printf '%s\n' "$BEGIN_MARKER" >> "$temporary"
  cat "$prompt" >> "$temporary"
  printf '\n%s\n' "$END_MARKER" >> "$temporary"
  chmod 0644 "$temporary"
  mv "$temporary" "$path"
  printf 'Updated instruction block: %s\n' "$path"
}

install_instructions() {
  local prompt="$1" targets=()
  [[ -f AGENTS.md ]] && targets+=("$PWD/AGENTS.md")
  [[ -f CLAUDE.md ]] && targets+=("$PWD/CLAUDE.md")
  ((${#targets[@]})) || targets+=("$PWD/AGENTS.md")
  local target
  for target in "${targets[@]}"; do write_instruction_file "$target" "$prompt"; done
}

configure_path() {
  [[ "${MIRROR_SKIP_PATH_UPDATE:-0}" == 1 ]] && return
  case ":$PATH:" in *":$INSTALL_DIR:"*) return ;; esac
  local profile="$MIRROR_HOME/.profile"
  printf '\nexport PATH="%s:$PATH"\n' "$INSTALL_DIR" >> "$profile"
  printf 'Added %s to PATH in %s\n' "$INSTALL_DIR" "$profile"
}

if [[ "${MIRROR_INSTALLER_SOURCE_ONLY:-0}" == 1 ]]; then
  return 0 2>/dev/null || exit 0
fi

command -v curl >/dev/null 2>&1 || { printf 'curl is required.\n' >&2; exit 1; }
command -v unzip >/dev/null 2>&1 || { printf 'unzip is required.\n' >&2; exit 1; }

ASSET="$(detect_asset)"
RESOLVED_VERSION="$(resolve_version "$VERSION")"
BASE_URL="$(asset_base_url "$RESOLVED_VERSION")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

printf 'Installing GUIHO Mirror\nVersion: %s\nTarget: %s\nSource: %s\n' "$RESOLVED_VERSION" "$ASSET" "$BASE_URL"
download_asset checksums.txt "$TMP/checksums.txt" "$BASE_URL"
download_asset "$ASSET" "$TMP/$ASSET" "$BASE_URL"
download_asset guiho-s-mirror.zip "$TMP/guiho-s-mirror.zip" "$BASE_URL"
download_asset guiho-i-mirror.md "$TMP/guiho-i-mirror.md" "$BASE_URL"
verify_asset "$TMP/checksums.txt" "$ASSET" "$TMP/$ASSET"
verify_asset "$TMP/checksums.txt" guiho-s-mirror.zip "$TMP/guiho-s-mirror.zip"
verify_asset "$TMP/checksums.txt" guiho-i-mirror.md "$TMP/guiho-i-mirror.md"

unzip -p "$TMP/guiho-s-mirror.zip" guiho-s-mirror/SKILL.md > "$TMP/SKILL.md"
verify_markdown "$TMP/SKILL.md" guiho-s-mirror || { printf 'Invalid Mirror skill archive.\n' >&2; exit 1; }
verify_markdown "$TMP/guiho-i-mirror.md" guiho-i-mirror || { printf 'Invalid Mirror instruction asset.\n' >&2; exit 1; }

mkdir -p "$INSTALL_DIR"
DESTINATION="$INSTALL_DIR/mirror"
BACKUP="$DESTINATION.mirror-backup"
rm -f "$BACKUP"
[[ -e "$DESTINATION" ]] && mv "$DESTINATION" "$BACKUP"
if ! install -m 0755 "$TMP/$ASSET" "$DESTINATION"; then
  [[ -e "$BACKUP" ]] && mv "$BACKUP" "$DESTINATION"
  exit 1
fi
if [[ "$(MIRROR_DISABLE_UPDATE_CHECK=1 "$DESTINATION" --version)" != "mirror v$RESOLVED_VERSION" ]]; then
  rm -f "$DESTINATION"
  [[ -e "$BACKUP" ]] && mv "$BACKUP" "$DESTINATION"
  printf 'Installed binary version verification failed.\n' >&2
  exit 1
fi
rm -f "$BACKUP"
printf 'Installed binary: %s\n' "$DESTINATION"

install_skill "$TMP/SKILL.md" "$MIRROR_HOME/.agents/skills/guiho-s-mirror"
install_skill "$TMP/SKILL.md" "$MIRROR_HOME/.claude/skills/guiho-s-mirror"
install_instructions "$TMP/guiho-i-mirror.md"
configure_path
printf 'Mirror installation complete: %s\n' "$(MIRROR_DISABLE_UPDATE_CHECK=1 "$DESTINATION" --version)"
