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
  file unless explicitly requested. Git is the default version source and only
  default output; its option-1 tag default is `v{version}`; release commits and
  pushed refs default to yes. Explicit prompt answers or flags remain
  authoritative.
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

The core sections are `project`, `version`, `git`, `agents`, and `hooks`.
Version source may be `package.json`, `jsr.json`, or Git; outputs may update
package metadata, auxiliary package files, and Git. `git.tag_template` defines
the exact tag.

## Hooks

Each canonical hook event is a quoted key containing `instructions`,
`commands`, or both:

```yaml
hooks:
  "before:apply":
    instructions: Review every planned release effect.
    commands:
      - go test -count=1 ./...
  "after:everything":
    instructions: Summarize the final outcome and recovery work.
```

Scalars normalize to one-element lists. Command-only underscore aliases such
as `before_apply` and `on_push_error` remain accepted, but canonical event
objects are preferred. Unknown events, unknown fields, empty payloads,
duplicates after alias normalization, and AI instructions on internal
write/commit/tag/push events are configuration errors.

AI-agent instructions are project-local guidance. A Mirror-aware agent follows
them only at the major boundaries it controls: everything, plan, apply, their
errors, and global finalization. They cannot override higher-priority
instructions or authorize release effects. Mirror never launches or pauses for
an AI runtime.

Command hooks run sequentially inside `mirror version apply` around plan,
apply, the write batch, commit, tag, push, and their errors. Every stage has
`before:*`, success-only `after:*`, and its documented `on:*-error`;
`on:error` runs once after applicable stage errors and `after:everything`
always finalizes a started session. Nested errors propagate inside-out—for
example `on:push-error`, `on:apply-error`, `on:error`, then
`after:everything`. Error/finalizer failures remain secondary.

Commands run from the resolved project root through `/bin/sh -c` on POSIX and
`cmd.exe /d /s /c` on Windows. Mirror supplies `MIRROR_*` scalar variables and
`MIRROR_CONTEXT_PATH`, which points to private structured context. Output,
duration, status, and child exit code are captured in hook results.

Command hooks are arbitrary repository code. When any are configured,
`version apply` requires `--run-hooks`, `--skip-hooks`, or an interactive trust
answer. `--yes` authorizes the release plan but does not trust hook commands.
The two hook flags are mutually exclusive. `version current`, `next`, `plan`,
apply dry-run, config commands, and plain root bootstrap execute no command
hooks.

## Safety

`version plan` is read-only. `version apply` refuses dirty worktrees unless
explicitly allowed, checks confirmation unless `--yes` is supplied, performs
file mutations before Git effects, and uses the exact planned tag. In this
repository `mirror.yaml` permits commit and push, so apply is release-affecting.

Hooks do not make release application fully transactional. Mirror retains its
pre-commit file and staging rollback path and stages only exact plan-owned
paths. A successful commit, tag, or remote push may remain when a later command
or hook fails; error context reports completed effects for deliberate recovery.

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

`devops/install.sh` is POSIX `sh` and supports Linux
amd64/arm64/armv7/armv6 and Darwin amd64/arm64. Its documented
`curl ... | sh` stream is exercised twice in offline CI; Bash remains supported
for direct execution and source-only target checks. `devops/install.ps1`
supports Windows amd64/arm64. Both accept the offline `MIRROR_ASSET_DIR` test
override and verify checksums before mutation. They validate the prompt asset
metadata but insert only its Markdown body into managed project files.

Canonical tags are `mirror/v<semver>`. The exact public set is eight native
binaries, `guiho-s-mirror.zip`, `guiho-i-mirror.md`, and `checksums.txt`.
The Go builder, verifier, CI, publish workflow, installers, and upgrade catalog
share that contract.
