#!/bin/sh
set -eu

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

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version) VERSION="${2:?--version requires a value}"; shift 2 ;;
    --install-dir) INSTALL_DIR="${2:?--install-dir requires a value}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown installer argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

detect_asset() {
  detected_asset_os="${MIRROR_TEST_OS:-$(uname -s)}"
  detected_asset_arch="${MIRROR_TEST_ARCH:-$(uname -m)}"
  detected_asset_os="$(printf '%s' "$detected_asset_os" | tr '[:upper:]' '[:lower:]')"
  detected_asset_arch="$(printf '%s' "$detected_asset_arch" | tr '[:upper:]' '[:lower:]')"
  case "$detected_asset_os:$detected_asset_arch" in
    linux:x86_64|linux:amd64) printf 'mirror-linux-amd64\n' ;;
    linux:aarch64|linux:arm64) printf 'mirror-linux-arm64\n' ;;
    linux:armv7l|linux:armv7) printf 'mirror-linux-armv7\n' ;;
    linux:armv6l|linux:armv6) printf 'mirror-linux-armv6\n' ;;
    darwin:x86_64|darwin:amd64) printf 'mirror-darwin-amd64\n' ;;
    darwin:arm64|darwin:aarch64) printf 'mirror-darwin-arm64\n' ;;
    *) printf 'Unsupported Mirror installer target: %s/%s\n' "$detected_asset_os" "$detected_asset_arch" >&2; return 1 ;;
  esac
}

resolve_version() {
  resolve_requested="$1"
  resolve_requested="${resolve_requested#mirror/v}"
  resolve_requested="${resolve_requested#v}"
  if [ "$resolve_requested" != latest ]; then
    printf '%s\n' "$resolve_requested"
    return
  fi
  if [ -n "${MIRROR_ASSET_DIR:-}" ]; then
    printf 'An exact --version is required with MIRROR_ASSET_DIR.\n' >&2
    return 1
  fi
  resolve_release_json="$(curl --fail --silent --show-error --location \
    --proto '=https' --tlsv1.2 \
    "https://api.github.com/repos/${REPO}/releases/latest")"
  resolve_tag="$(printf '%s\n' "$resolve_release_json" \
    | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    | head -n 1)"
  case "$resolve_tag" in
    mirror/v*) printf '%s\n' "${resolve_tag#mirror/v}" ;;
    *) printf 'Latest release tag is not canonical: %s\n' "$resolve_tag" >&2; return 1 ;;
  esac
}

asset_base_url() {
  asset_base_version="$1"
  if [ -n "${MIRROR_DOWNLOAD_BASE_URL:-}" ]; then
    printf '%s\n' "${MIRROR_DOWNLOAD_BASE_URL%/}"
  else
    printf 'https://github.com/%s/releases/download/mirror%%2Fv%s\n' "$REPO" "$asset_base_version"
  fi
}

download_asset() {
  download_name="$1"
  download_destination="$2"
  download_base="$3"
  if [ -n "${MIRROR_ASSET_DIR:-}" ]; then
    cp "${MIRROR_ASSET_DIR%/}/$download_name" "$download_destination"
    return
  fi
  printf 'Downloading %s\n' "$download_base/$download_name"
  curl --fail --location --progress-bar --proto '=https' --tlsv1.2 "$download_base/$download_name" --output "$download_destination"
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
  verify_manifest="$1"
  verify_name="$2"
  verify_path="$3"
  verify_expected="$(awk -v name="$verify_name" '$2 == name || $2 == "*" name {print tolower($1)}' "$verify_manifest")"
  if ! printf '%s\n' "$verify_expected" | LC_ALL=C grep -Eq '^[0-9a-f]{64}$'; then
    printf 'Missing checksum for %s\n' "$verify_name" >&2
    return 1
  fi
  verify_actual="$(sha256_file "$verify_path")"
  if [ "$verify_actual" != "$verify_expected" ]; then
    printf 'Checksum mismatch for %s\n' "$verify_name" >&2
    return 1
  fi
  printf 'Verified SHA-256: %s\n' "$verify_name"
}

verify_markdown() {
  verify_markdown_path="$1"
  verify_markdown_name="$2"
  [ -s "$verify_markdown_path" ] || return 1
  LC_ALL=C grep -a -q '^---$' "$verify_markdown_path" || return 1
  LC_ALL=C grep -a -q "^name:[[:space:]]*$verify_markdown_name[[:space:]]*$" "$verify_markdown_path" || return 1
  LC_ALL=C tr -d '\000' < "$verify_markdown_path" | cmp -s "$verify_markdown_path" - || return 1
}

install_skill() {
  skill_source="$1"
  skill_destination="$2"
  skill_parent="$(dirname "$skill_destination")"
  mkdir -p "$skill_parent"
  skill_stage="$(mktemp -d "$skill_parent/.mirror-skill-new.XXXXXX")"
  skill_backup="$skill_parent/.mirror-skill-backup.$$"
  install -m 0644 "$skill_source" "$skill_stage/SKILL.md"
  rm -rf "$skill_backup"
  if [ -e "$skill_destination" ]; then mv "$skill_destination" "$skill_backup"; fi
  if ! mv "$skill_stage" "$skill_destination"; then
    if [ -e "$skill_backup" ]; then mv "$skill_backup" "$skill_destination"; fi
    return 1
  fi
  rm -rf "$skill_backup"
  printf 'Installed skill: %s\n' "$skill_destination"
}

write_instruction_body() {
  instruction_body_prompt="$1"
  awk '
    {
      sub(/\r$/, "")
    }
    NR == 1 {
      if ($0 != "---") exit 1
      in_frontmatter = 1
      next
    }
    in_frontmatter && $0 == "---" {
      in_frontmatter = 0
      next
    }
    in_frontmatter {
      next
    }
    !started && $0 == "" {
      next
    }
    {
      print
      started = 1
    }
    END {
      if (in_frontmatter || !started) exit 1
    }
  ' "$instruction_body_prompt"
}

write_instruction_file() {
  instruction_path="$1"
  instruction_prompt="$2"
  instruction_parent="$(dirname "$instruction_path")"
  mkdir -p "$instruction_parent"
  instruction_temporary="$(mktemp "$instruction_parent/.mirror-instruction.XXXXXX")"
  if [ -f "$instruction_path" ]; then
    awk -v begin="$BEGIN_MARKER" -v end="$END_MARKER" '
      $0 == begin {inside=1; next}
      $0 == end {inside=0; next}
      !inside {print}
    ' "$instruction_path" > "$instruction_temporary"
  fi
  if [ -s "$instruction_temporary" ]; then printf '\n' >> "$instruction_temporary"; fi
  printf '%s\n' "$BEGIN_MARKER" >> "$instruction_temporary"
  write_instruction_body "$instruction_prompt" >> "$instruction_temporary"
  printf '%s\n' "$END_MARKER" >> "$instruction_temporary"
  chmod 0644 "$instruction_temporary"
  mv "$instruction_temporary" "$instruction_path"
  printf 'Updated instruction block: %s\n' "$instruction_path"
}

install_instructions() {
  instructions_prompt="$1"
  instructions_found=0
  if [ -f AGENTS.md ]; then
    write_instruction_file "$PWD/AGENTS.md" "$instructions_prompt"
    instructions_found=1
  fi
  if [ -f CLAUDE.md ]; then
    write_instruction_file "$PWD/CLAUDE.md" "$instructions_prompt"
    instructions_found=1
  fi
  if [ "$instructions_found" -eq 0 ]; then
    write_instruction_file "$PWD/AGENTS.md" "$instructions_prompt"
  fi
}

configure_path() {
  [ "${MIRROR_SKIP_PATH_UPDATE:-0}" = 1 ] && return
  case ":$PATH:" in *":$INSTALL_DIR:"*) return ;; esac
  path_profile="$MIRROR_HOME/.profile"
  printf '\nexport PATH="%s:$PATH"\n' "$INSTALL_DIR" >> "$path_profile"
  printf 'Added %s to PATH in %s\n' "$INSTALL_DIR" "$path_profile"
}

if [ "${MIRROR_INSTALLER_SOURCE_ONLY:-0}" = 1 ]; then
  return 0 2>/dev/null || exit 0
fi

command -v curl >/dev/null 2>&1 || { printf 'curl is required.\n' >&2; exit 1; }
command -v unzip >/dev/null 2>&1 || { printf 'unzip is required.\n' >&2; exit 1; }

ASSET="$(detect_asset)"
RESOLVED_VERSION="$(resolve_version "$VERSION")"
BASE_URL="$(asset_base_url "$RESOLVED_VERSION")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' 0

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
[ -e "$DESTINATION" ] && mv "$DESTINATION" "$BACKUP"
if ! install -m 0755 "$TMP/$ASSET" "$DESTINATION"; then
  [ -e "$BACKUP" ] && mv "$BACKUP" "$DESTINATION"
  exit 1
fi
if [ "$(MIRROR_DISABLE_UPDATE_CHECK=1 "$DESTINATION" --version)" != "mirror v$RESOLVED_VERSION" ]; then
  rm -f "$DESTINATION"
  [ -e "$BACKUP" ] && mv "$BACKUP" "$DESTINATION"
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
