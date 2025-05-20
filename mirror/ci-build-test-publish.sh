#!/bin/bash

# @copyright Copyright © 2025 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.

_repo_url="https://github.com/cguiho/mirror.git"
_package_name="@guiho40/mirror" # Also change this on the command line below. (around line 14)

_cwd=$(pwd)
_repo_dir="$_cwd/../../.temp/mirror"
_project_dir=$_repo_dir/mirror

if [ -z "$1" ]; then
  echo "No version tag provided. Using the latest tag."
  latest_tag=$(git ls-remote --tags $_repo_url | grep -o 'refs/tags/@guiho40/mirror@[^ ]*' | sed 's#refs/tags/##' | grep -v '\^{}' | sort -V | tail -n1)
  echo "Using Latest tag: $latest_tag"
  
  _tag=$latest_tag
else
  _tag="$_package_name@$_version"
fi

echo "🔥🎯 Version tag: $_tag"

sleep 2

function cleanup {
  rm -rf "$_repo_dir"
}
cleanup

mkdir -p "$_repo_dir"

cd "$_repo_dir"

git clone $_repo_url .
git checkout $_tag

cd $_project_dir

echo "Building $_package_name version: $_tag"

bunx google-artifactregistry-auth
bun install

bun test || (cleanup && exit 1)
bun run typecheck || (cleanup && exit 1)

bun run build || (cleanup && exit 1)

bun publish

cleanup
