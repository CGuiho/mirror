#### &copy; 2026 [GUIHO](https://guiho.co) as represented by [Cristóvão GUIHO](https://guiho.co/cguiho) All Rights Reserved.

# GUIHO Mirror

Mirror is GUIHO's deterministic semantic-versioning CLI. The production
implementation is the Go module at this repository root. One Cobra tree owns
routing, help, aliases, and generated developer documentation; typed Go
structures and strict YAML decoding own configuration.

The former Bun/TypeScript package under `mirror/` is retained as historical
reference only. Go source, tests, installers, CI, and release workflows are the
delivery authority.

## Install

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/CGuiho/mirror/main/devops/install.ps1 | iex
```

macOS and Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/CGuiho/mirror/main/devops/install.sh | sh
```

The Unix installer is POSIX `sh` compatible and does not require Bash.

AI agents — give your agent this prompt:

```text
Install the GUIHO Mirror CLI by following its default install prompt
(guiho-i-mirror). Show it with `mirror agent prompt show guiho-i-mirror`, or
read it from
https://raw.githubusercontent.com/CGuiho/mirror/main/embed/prompts/guiho-i-mirror.md
before the CLI is installed. Install Mirror by following that prompt, then
report the installed version.
```

Verify the installation:

```text
mirror --version
```

Both installers map the host to an approved native asset, verify it against
`checksums.txt`, install the bundled skill into both global agent roots,
reconcile the managed instruction block without the prompt asset's YAML
frontmatter, and verify `mirror v<version>`.

By default both installers select the latest stable release. Pass an exact
version instead with `-Version` or `MIRROR_VERSION` in PowerShell and
`--version` in `sh`; an optional `mirror/v` or `v` prefix is accepted, for
example `4.1.0-alpha.1`. A channel selects the highest published release whose
first prerelease identifier matches: use `-Channel` / `--channel`, where
`stable` means the newest release without a prerelease component. Exact
version and channel selection are mutually exclusive.

## Quick Start

```text
mirror init
mirror config check
mirror version current
mirror version plan patch
```

Configuration is `mirror.yaml` only. Resolution order is an explicit
`--config`, `<cwd>/mirror.yaml`, then `~/.guiho/mirror/mirror.yaml`; Mirror does
not search parent directories.

Running plain `mirror` first idempotently verifies `guiho-s-mirror` in both
global agent roots and reconciles the bounded instruction block in the current
repository before printing its normal banner. If both `AGENTS.md` and
`CLAUDE.md` exist, both are updated; if neither exists, `AGENTS.md` is created.
The managed body begins with `## GUIHO Mirror Instruction Block`; descriptor
frontmatter remains only in the standalone prompt asset.

Agent mutations are explicit:

```text
mirror agent skill install
mirror agent instruction apply
mirror agent prompt list
```

`mirror init` defaults to Git as the version source and only Git as the output,
tag template `v{version}`, release commits enabled, and release-ref pushes
enabled. Interactive option 1 and both `[Y/n]` prompts show those defaults;
explicit answers and flags override them.

For a new Git-only repository with no version tags, start with an exact version,
for example `mirror version plan 0.0.1` and `mirror version apply 0.0.1 --yes`.
Mirror renders the configured canonical tag and pushes only that exact ref.
Relative targets are rejected until the initial exact version exists.

Inspect the complete generated interface with `mirror --help-tree` or
`mirror --help-docs`. Use `--format json` for machine-readable output.

## Hooks

`mirror.yaml` can attach AI-agent instructions and executable commands to the
version lifecycle:

```yaml
hooks:
  "before:apply":
    instructions:
      - Review the release plan and confirm the changelog is complete.
    commands:
      - go test -count=1 ./...
  "on:push-error":
    commands:
      - ./devops/report-release-failure.sh
```

Mirror-aware agents follow instructions at the agent-controlled everything,
plan, and apply boundaries. The Go CLI executes commands around plan, apply,
the write batch, commit, tag, push, and their errors. Read-only commands and
`version apply --dry-run` never execute command hooks.

Command hooks are repository-controlled code and require a separate trust
choice from `--yes`: pass `--run-hooks` to execute them or `--skip-hooks` to
apply without them. Hook output is captured in structured results and cannot
corrupt `--format json` stdout.

## Upgrade

```text
mirror upgrade check
mirror upgrade list
mirror upgrade
```

Upgrades select the exact current-platform asset, stream bounded download
progress, verify SHA-256 and the candidate executable, perform transactional
replacement, and retain a backup for rollback. Windows completes replacement
out of process and reports the completion journal on the next start.

## Development

```text
gofmt -l .
go test -count=1 ./...
go vet ./...
go run . --help-tree
go run ./devops/build-binaries.go --version 0.0.0-dev --commit local --build-date 2026-01-01T00:00:00Z
go run ./devops/verify-release-assets --dir bin
```

The approved release set is exactly 11 assets: 8 native binaries, the
`guiho-s-mirror.zip` skill bundle, `guiho-i-mirror.md`, and `checksums.txt`.
Building does not authorize a version bump, tag, push, publication, or release.

See [mirror/DOCS.md](mirror/DOCS.md) for the full behavior contract and
[TECHNICAL.md](TECHNICAL.md) for architecture.
