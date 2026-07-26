---
name: guiho-s-mirror
description: Use whenever planning, applying, validating, or troubleshooting semantic project versioning with GUIHO Mirror.
purpose: Guide safe Mirror-managed semantic version planning and application.
created: 2026-07-18
owner: mirror-embed-skill-guiho-s-mirror
flags: []
tags:
  - mirror
  - skill
keywords:
  - semantic versioning
  - mirror.yaml
metadata:
  version: "1.0.0"
---

# GUIHO Mirror

Use Mirror instead of manually editing version fields or creating release tags.

## Required Workflow

1. Run plain `mirror` in the repository to idempotently verify the global skill
   and the managed project instruction block, then read `mirror.yaml`.
2. Run the repository typecheck and test commands.
3. Run the repository's Go validation (`gofmt`, `go test`, and `go vet`) and
   `mirror config check`.
4. Run `mirror version plan <target>` and inspect every planned mutation.
5. Update the configured changelog only when `agents.write_changelog` is not `false`; use `agents.changelog_path` or `CHANGELOG.md`.
6. Commit release preparation before `mirror version apply <target> --yes`.
7. Apply only when version, commit, tag, and push effects are authorized.

Supported targets are `major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, `prerelease`, and exact semantic versions.

For a new Git-only repository with no supported version tag, use an exact
initial version such as `0.0.1`. Mirror will plan and apply the configured
canonical tag without a manual seed tag. Do not use a relative bump until the
initial tag exists.

## Configuration

Mirror accepts YAML only and resolves configuration in this order:

1. `--config <path>`;
2. `<cwd>/mirror.yaml`;
3. `~/.guiho/mirror/mirror.yaml`.

It does not search parent directories.

`mirror init` offers `v{version}` as option 1 and the default. It defaults both
release commits and pushing release refs to yes. Explicit prompt answers or
`--tag-template`, `--commit=false`, and `--push=false` remain authoritative.

## Release Boundary

Mirror's canonical release tags are `mirror/v<semver>`. A release contains
exactly eight native executables, `guiho-s-mirror.zip`, `guiho-i-mirror.md`,
and `checksums.txt`. Planning and building do not authorize `version apply`, a
commit, tag, push, publication, or GitHub release. Obtain explicit approval for
those effects.

The production CLI is the repository-root Go/Cobra module. Do not use the
archived Bun/TypeScript package as versioning or release authority.
