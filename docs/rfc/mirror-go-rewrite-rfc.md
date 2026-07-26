---
name: Mirror Go Production Migration RFC
purpose: Define the accepted production architecture and delivery contract for Mirror in Go.
description: Authoritative RFC for the completed Go/Cobra migration.
created: 2026-07-25
updated: 2026-07-26
owner: mirror-docs-rfc
flags: [accepted, implemented]
tags: [mirror, go, cobra, migration]
keywords: [strict yaml, embedded skills, transactional upgrade, eleven assets]
---

# Mirror Go Production Migration RFC

## Status

Accepted and implemented locally. Publication is intentionally out of scope and
requires separate approval.

## Decision

Mirror's repository-root Go module is the production implementation. Cobra is
the only command parser/router/help authority. Strict typed decoding through
`go.yaml.in/yaml/v3` is the configuration authority. Viper is not used. The
legacy Bun/TypeScript implementation under `mirror/` is historical evidence and
must not drive CI, installation, publishing, or releases.

This decision supersedes the Bun implementation contract in the earlier RFC
0034 migration plan while preserving the compatible user concepts: YAML-only
configuration, deterministic help, explicit agent mutations, semantic-version
planning, verified upgrades, native installation, and safe release effects.

## Architecture

- `main.go`: thin entrypoint and linker build metadata.
- `cmd/`: one freshly constructed Cobra command tree and presentation layer.
- `pkg/config`: strict YAML decoding, validation, and schema.
- `pkg/versioning` and `pkg/semver`: version sources, plans, adapters, and Git
  effects.
- `pkg/update` and `pkg/updater`: bounded catalog checks, guarded workers,
  verified transactional replacement, recovery journal, and rollback.
- `pkg/maintenance`: embedded skill, prompt, and managed instruction lifecycle.
- `pkg/release`: authoritative target and asset manifest.
- `embed/`: canonical resources compiled into every executable.
- `devops/`: Go builder/verifier and standalone verified installers.

## CLI Contract

The canonical groups are `init`, `config`, `version`, `agent`, `upgrade`, and
`uninstall`. Generated `--help-tree` and `--help-docs` traverse the live Cobra
tree. Only `-h` and root `-v` are short flags. JSON output is structured and
stdout-safe; diagnostics use stderr. Stable exit codes distinguish usage,
configuration, network, integrity, interruption, and general failures.

## Configuration and Version Safety

Mirror resolves an explicit config, the effective working directory, then the
global Mirror directory. It accepts YAML only, rejects unknown/duplicate fields,
and does not search parents. `version plan` is read-only. `version apply`
requires confirmation unless bypassed, enforces dirty-tree policy, and performs
only the configured file, changelog, commit, tag, and push effects.

Git-only projects may have no version tags immediately after initialization.
In that state Mirror accepts only an exact initial SemVer, marks the plan as
initial, renders the configured canonical tag, and applies/pushes only that tag.
Relative targets are rejected rather than inferring a baseline.

## Maintenance Contract

All executables embed the canonical `guiho-s-mirror` bundle, instruction
template, and prompts. Agent mutations occur only through explicit `agent`
commands, argument-free root bootstrap, installer completion, successful
upgrade completion, or uninstall. Root bootstrap is idempotent, rejects
malformed markers, and is isolated from version/release effects.

Generated init configuration defaults to `v{version}`, `git.commit: true`, and
`git.push: true`. Interactive option 1 and `[Y/n]` indicators expose those
defaults; explicit answers and flags remain authoritative.

Upgrade downloads are bounded and observable. The selected asset must match the
linker target, its SHA-256 must match the manifest, and the candidate must report
the exact requested version before replacement. Unix swaps transactionally and
then runs the new binary to reconcile resources. Windows delegates replacement
to a hidden worker and consumes a completion journal on the next start.

## Delivery Contract

Canonical tags are `mirror/v<semver>`. The exact release set is:

1. `mirror-linux-amd64`
2. `mirror-linux-arm64`
3. `mirror-linux-armv7`
4. `mirror-linux-armv6`
5. `mirror-darwin-amd64`
6. `mirror-darwin-arm64`
7. `mirror-windows-amd64.exe`
8. `mirror-windows-arm64.exe`
9. `guiho-s-mirror.zip`
10. `guiho-i-mirror.md`
11. `checksums.txt`

All binaries use `CGO_ENABLED=0`; AMD64 stays at v1 compatibility, ARM64 uses
v8.0, and Raspberry Pi ARMv6/ARMv7 targets remain distinct. One Go manifest is
consumed by build, verification, workflow tests, installers, and upgrades.

## Acceptance

- `gofmt -l .` is empty; `go mod tidy` is stable.
- `go test -count=1 ./...` and `go vet ./...` pass.
- help, config, exit-code, agent, worker, upgrade, rollback, installer, and
  matrix contracts have automated tests.
- a full cross-build contains exactly the 11 approved assets and passes the
  independent verifier.
- native Windows and PowerShell offline installer smokes pass locally; CI owns
  the remaining native platform smokes.
- CI and publication contain no Bun build/package authority and agree on
  `mirror/v*`.
- user docs, skill, TODO, XDocs, review, and validation records are reconciled.

No acceptance item authorizes a version bump, tag, push, publication, or public
release.
