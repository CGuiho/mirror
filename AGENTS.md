---
name: Mirror Agent Instructions
purpose: Define engineering and release boundaries for the production Mirror CLI.
description: Repository instructions for Go/Cobra Mirror work.
created: 2026-07-26
owner: mirror
flags: []
tags: [mirror, agents, go]
keywords: [cli engineering, validation, release boundary]
---

## Agent

Always read `C:\GUIHO\superiority\agents\guiho-a-0001-swe.AGENTS.md`.
Stop if it cannot be found.

## Required CLI Engineering

- Use `guiho-a-0001-swe` as the lifecycle controller for Mirror architecture,
  planning, implementation, review, validation, and release preparation.
- Load and follow `guiho-s-0035-cli-engineer-go` whenever creating, changing,
  reviewing, testing, packaging, installing, or releasing the Mirror CLI.
- Use `guiho-s-xdocs` for structured documentation and `guiho-s-mirror` for
  semantic-version planning or release work.
- Mirror is pre-1.0. Prefer the approved Go/Cobra contract over compatibility
  with the archived Bun/TypeScript implementation.

# Repository Notes

- The production Go module lives at the repository root. `main.go` is the thin
  executable entrypoint; `cmd/` owns the single Cobra command tree; `pkg/` owns
  domain behavior; `embed/` owns bundled agent resources.
- The legacy `mirror/` Bun package is historical reference only. It is not a CI,
  build, installer, publishing, or release authority.
- Configuration is YAML only and strictly decoded into typed Go structures.
- Use Go, Cobra, and the standard library. Do not add Viper or a second command
  parser. Builds are static (`CGO_ENABLED=0`).
- Generated outputs in `bin/` are ignored and must not be hand-edited.

## Commands

- Format check: `gofmt -l .`
- Test: `go test -count=1 ./...`
- Vet: `go vet ./...`
- Build the exact release set: `go run ./devops/build-binaries.go --version <version> --commit <sha> --build-date <RFC3339>`
- Verify release assets: `go run ./devops/verify-release-assets --dir bin`
- Configuration check: `go run . config check`
- Command contract: `go run . --help-tree` and `go run . --help-docs`

## CLI Behavior

- Canonical groups are `init`, `config`, `version`, `agent`, `upgrade`, and
  `uninstall`.
- Release targets are `major`, `premajor`, `minor`, `preminor`, `patch`,
  `prepatch`, `prerelease`, or exact SemVer.
- Read `mirror.yaml`; never restore TOML fallback or parent-directory search.
- Ordinary config/version commands never mutate agent resources. Use explicit
  singular `mirror agent ...` commands.
- Plain argument-free `mirror` is the intentional exception: it idempotently
  bootstraps global skills and current-repository managed instructions before
  printing the banner. It must not perform version or release effects.
- `mirror init` defaults to `v{version}`, release commits enabled, and release
  pushes enabled; explicit interactive selections and flags are authoritative.
- Test version-application paths only in disposable fixture repositories.
- A Git-only repository with no version tags may plan/apply an exact initial
  SemVer; relative targets must fail until that canonical seed exists.
- Exit codes are stable: 0 success, 1 general, 2 usage, 3 configuration,
  4 network, 5 integrity, and 130 interruption.

## Delivery Contract

- `pkg/release` owns the exact matrix: 8 native executables, one skill ZIP, one
  instruction prompt, and one checksum manifest (11 assets total).
- Canonical release tags are `mirror/v<semver>` and native asset names use
  `mirror-<goos>-<arch>` with `.exe` on Windows.
- CI and publication are Go-only. Publication remains separately authorized;
  never bump, tag, push, publish, or create a release without explicit approval.
- Installers and upgrades must verify SHA-256 before replacement, preserve a
  rollback path, and reconcile the embedded skill/instruction resources only
  after a successful binary transition.

## Documentation Discipline

- `README.md` is the user entrypoint and `mirror/DOCS.md` is the full behavior
  contract. Update both when user-visible behavior or delivery changes.
- Keep `TECHNICAL.md`, the Go RFC, implementation plan, review, validation, TODO,
  XDocs descriptors, and embedded skill consistent with shipped behavior.
- Historical Bun documents may remain as evidence but must not be presented as
  current authority.

## Semantic Project Versioning

Invoke `guiho-s-mirror` whenever the user requests a bump, tag, release, plan,
initialization, configuration, or semantic-version troubleshooting. Inspect
`mirror.yaml` first. Respect `agents.write_changelog` and `agents.changelog_path`.
`version apply` may commit and push in this repository, so do not run it during
ordinary implementation or validation.

## GUIHO Project

- Repository: `C:\GUIHO\mirror`
- Parent: `C:\GUIHO\guiho`
- Purpose: deterministic semantic project versioning and release workflows.
- Parent instructions: `../guiho/AGENTS.md`
- Parent backlog: `../guiho/TODO.md`
- Local backlog: `TODO.md`
- Keep component work local and cross-component coordination in the parent.
- Do not publish, deploy, migrate, rotate secrets, or mutate production without
  explicit approval.

<!-- BEGIN MIRROR — DO NOT EDIT THIS SECTION -->
---
name: guiho-i-mirror
description: Mirror agent instruction block.
purpose: Provide the canonical managed project instruction for Mirror versioning.
created: 2026-07-18
owner: mirror-embed-prompts
flags: []
tags: [mirror, instruction, agents]
keywords: [version plan, version apply]
---

# GUIHO Mirror Instruction Block

Run plain `mirror` once in a repository to verify the global Mirror skill and
this bounded instruction block. Repeated runs are idempotent.

Use `mirror version plan <target>` and `mirror version apply <target>` for semantic versioning.
`mirror init` defaults to `v{version}` tags and enables release commits and
pushes; explicit interactive or flag selections remain authoritative.
<!-- END MIRROR -->
