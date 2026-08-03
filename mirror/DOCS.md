---
name: GUIHO Mirror CLI Documentation
purpose: Define the complete user-facing contract of the production Mirror CLI.
description: Canonical behavior documentation for the Go/Cobra Mirror CLI.
created: 2026-07-18
owner: mirror-mirror
flags: []
tags: [mirror, cli, go, cobra]
keywords: [semantic versioning, strict yaml, upgrades, agent resources]
---

# GUIHO Mirror CLI

The production Mirror executable is built from the Go module at the repository
root. The directory containing this document also holds the archived
Bun/TypeScript predecessor; it is not a build, CI, installer, or publication
authority.

## Global Interface

All commands accept `--cwd`, `--config`, `--format text|json`, `--color`,
`--verbose`, `--help-tree`, `--help-tree-depth`, and `--help-docs` where
applicable. Only the root owns `-v|--version`; `-h|--help` is the only short help
flag. Generated tree and Markdown help are derived from the same Cobra tree as
runtime routing.

Stable exit codes are 0 success, 1 general failure, 2 usage, 3 configuration,
4 network, 5 integrity, and 130 interruption.

## Commands

- Plain argument-free `mirror` first verifies the global skill in both agent
  roots and reconciles managed instructions in the current repository, then
  prints its banner. Selection is both existing instruction files, the one that
  exists, or a new `AGENTS.md`; unchanged resources are not rewritten and
  malformed markers fail without altering unmanaged content. The block contains
  only the prompt Markdown body, beginning with
  `## GUIHO Mirror Instruction Block`; release-asset frontmatter is excluded.
- `mirror init` creates a YAML configuration without overwriting an existing
  file unless explicitly requested. Its option-1 tag default is `v{version}`;
  release commits and pushed refs default to yes. Explicit prompt answers or
  flags remain authoritative.
- `mirror config check|show|schema` validates, displays, or emits the strict
  configuration contract. `schema --save` writes the global schema.
- `mirror version current|next|plan|apply` reads, calculates, plans, or applies
  semantic-version changes. Targets are the seven SemVer increments or an exact
  SemVer. Apply honors configured file outputs, changelog, commit, tag, and push
  effects; inspect the plan first.
- `mirror agent skill list|show|install|update|uninstall` manages the embedded
  `guiho-s-mirror` bundle in both supported agent roots.
- `mirror agent instruction show|apply|update|remove` manages one idempotent,
  marker-delimited, metadata-free instruction body in `AGENTS.md` and
  `CLAUDE.md`.
- `mirror agent prompt list|show` exposes raw bundled prompts, including release
  metadata, without mutation.
- `mirror upgrade check|list`, bare `mirror upgrade`, exact `--version`,
  `--dry-run`, and `upgrade rollback` provide the native maintenance lifecycle.
- `mirror uninstall` previews with `--dry-run` and removes the executable plus
  global resources unless `--keep-agent-resources` is set.

## Configuration

Mirror accepts `mirror.yaml` only and rejects duplicate, unknown, malformed, or
semantically invalid fields. Resolution order is:

1. `--config <path>`;
2. `<effective-cwd>/mirror.yaml`;
3. `~/.guiho/mirror/mirror.yaml`.

No parent-directory search or TOML fallback occurs. A loaded path is reported
on stderr so stdout remains safe for JSON and redirected help.

The core sections are `project`, `version`, `git`, and `agents`. Version source
may be `package.json`, `jsr.json`, or Git; outputs may update package metadata,
auxiliary package files, and Git. `git.tag_template` defines the exact tag.

## Safety

`version plan` is read-only. `version apply` refuses dirty worktrees unless
explicitly allowed, checks confirmation unless `--yes` is supplied, performs
file mutations before Git effects, and uses the exact planned tag. In this
repository `mirror.yaml` permits commit and push, so apply is release-affecting.

When a Git-only source/output repository has no canonical or supported legacy
version tags, an exact target creates an explicit initial plan with no synthetic
current version. Relative increments fail with guidance to choose an exact
SemVer. Apply creates and, when configured, pushes only the canonical planned
tag; no manual seed tag is required.

Upgrade downloads have total and no-progress deadlines. Mirror verifies the
checksum and candidate version before replacement, preserves a backup, and
reconciles the new executable's embedded skill/instructions only after success.
Windows replacement is delegated to a hidden worker because the running binary
cannot replace itself directly.

## Installation and Delivery

`devops/install.sh` supports Linux amd64/arm64/armv7/armv6 and Darwin
amd64/arm64. `devops/install.ps1` supports Windows amd64/arm64. Both accept the
offline `MIRROR_ASSET_DIR` test override and verify checksums before mutation.
They validate the prompt asset metadata but insert only its Markdown body into
managed project files.

Canonical tags are `mirror/v<semver>`. The exact public set is eight native
binaries, `guiho-s-mirror.zip`, `guiho-i-mirror.md`, and `checksums.txt`.
The Go builder, verifier, CI, publish workflow, installers, and upgrade catalog
share that contract.
