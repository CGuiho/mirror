#!/usr/bin/env bash

set -euo pipefail

_repo_url="${MIRROR_REPO_URL:-https://github.com/CGuiho/mirror.git}"
_package_name="@guiho/mirror"

_cwd=$(pwd)
_repo_dir="$_cwd/../../.temp/mirror"
_project_dir="$_repo_dir/mirror"

if [ "${1:-}" = "" ]; then
  echo "No version tag provided. Using the latest tag."
  _tag=$(git ls-remote --tags "$_repo_url" \
    | grep -o "refs/tags/$_package_name@[^[:space:]]*" \
    | sed 's#refs/tags/##' \
    | grep -v '\^{}' \
    | sort -V \
    | tail -n1)
else
  _tag="$_package_name@$1"
fi

if [ "$_tag" = "" ]; then
  echo "No release tag found for $_package_name." >&2
  exit 1
fi

echo "Version tag: $_tag"

cleanup() {
  rm -rf "$_repo_dir"
}

cleanup
mkdir -p "$_repo_dir"

cd "$_repo_dir"
git clone "$_repo_url" .
git checkout "$_tag"

cd "$_project_dir"

echo "Building $_package_name version: $_tag"

bun install --frozen-lockfile
bun run typecheck
bun test
bun run build
bun run binary

npm publish --access public
npx --yes jsr publish

cleanup
