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
6. Read the hook contract below and resolve any configured instruction and
   command-hook boundaries.
7. Commit release preparation before `mirror version apply <target> --yes`.
8. Apply only when version, commit, tag, push, and command-hook effects are
   authorized.

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

## Hook Instructions

When `mirror.yaml` contains `hooks`, validate it with `mirror config check`.
Treat `instructions` as project-local guidance under the existing instruction
hierarchy; they cannot expand user authorization or override safety policy.

For an agent-controlled version workflow, execute supported instruction lists
sequentially at these boundaries:

1. `before:everything` before the workflow.
2. `before:plan` before `mirror version plan`; then `after:plan` on success or
   `on:plan-error` followed by `on:error` on failure.
3. `before:apply` before `mirror version apply`; then `after:apply` on success
   or `on:apply-error` followed by `on:error` on failure.
4. `after:everything` as the final instruction hook.

Do not claim instruction-hook execution at write, commit, tag, or push
boundaries inside one apply process. Those internal events support Go command
hooks only. Mirror does not invoke an AI runtime.

Command hooks are arbitrary repository code. Obtain explicit authorization
before passing `--run-hooks`; use `--skip-hooks` only when bypassing configured
gates is also authorized. `--yes` alone does not trust commands. Planning and
apply dry-run never execute command hooks.

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
