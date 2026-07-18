---
name: Mirror CLI Documentation
purpose: Define the complete runtime, commands, YAML, agent, upgrade, installer, bootstrap, exit, and asset contracts.
description: Canonical documentation for the RFC 0034-compliant Mirror CLI.
created: 2026-07-18
owner: mirror-mirror
flags: []
tags:
  - mirror
  - documentation
keywords:
  - RFC 0034
  - mirror.yaml
  - fourteen assets
---

# Mirror CLI Documentation

## Runtime Contract

Mirror uses Bun, strict ESM TypeScript, raw Citty, and TypeBox. Core CLI modules
use Bun APIs and do not import Node filesystem, path, OS, or child-process
built-ins. The Node-only npm bootstrap is isolated at
`scripts/mirror-bin.mjs`.

With no arguments:

```text
Hello Windows - mirror v<version>
```

Only `-h` and root `-v` are short aliases. Every command scope supports
`--help`, `--help-tree`, `--help-tree-depth <positive-integer>`, and
`--help-docs`.

## Command Catalog

```text
mirror
├── init
├── config
│   ├── show
│   ├── check
│   └── schema
├── version
│   ├── current
│   ├── next <target>
│   ├── plan <target>
│   └── apply <target>
├── agent
│   ├── skill
│   │   ├── install
│   │   ├── uninstall
│   │   ├── update
│   │   ├── list
│   │   └── show <id>
│   ├── instruction
│   │   ├── apply
│   │   ├── remove
│   │   ├── update
│   │   └── show
│   └── prompt
│       ├── list
│       └── show <id>
├── upgrade
│   ├── check
│   └── list
└── uninstall
```

Targets are `major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`,
`prerelease`, or exact SemVer.

`version plan` is read-only. `version apply` owns version-file, Git commit, tag,
and push mutations according to reviewed configuration and flags.

## YAML Configuration

Mirror accepts YAML only. Resolution order:

1. `--config <path>`;
2. `<effective-cwd>/mirror.yaml`;
3. `~/.guiho/mirror/mirror.yaml`.

Every loaded file prints:

```text
configuration file loaded: <absolute-path>
```

Example:

```yaml
schema: 1
project:
  name_source: package.json
version:
  scheme: semver
  source: package.json
  output: [package.json, git]
  prerelease_id: alpha
package:
  path: package.json
  auxiliary_paths: []
jsr:
  path: jsr.json
git:
  tag_template: "{name}@{version}"
  commit: true
  push: false
  allow_dirty: false
agents:
  write_changelog: true
  changelog_path: CHANGELOG.md
```

`mirror init` creates or reconciles `mirror.yaml`. `config schema --format
json` prints the JSON Schema generated from the same TypeBox source shipped as
`schema/mirror.schema.json`.

## Startup And Cache

Global data is stored under `~/.guiho/mirror/`. The foreground reads
`cache.json` before ordinary output. When an update is cached it prints:

```text
New version available. Run this command to upgrade: mirror upgrade
```

Network checks run in a hidden detached worker. Help and version requests remain
free of configuration, agent, update-network, Git, and filesystem mutations.

## Agent Resources

Skill install/update/uninstall defaults to global scope and always targets:

```text
~/.agents/skills/guiho-s-mirror
~/.claude/skills/guiho-s-mirror
```

`--local` selects the equivalent project-local paths. Updates and uninstall also
remove the legacy skill name.

Instruction actions resolve project-local `AGENTS.md` and `CLAUDE.md`: use the
one that exists, use both when both exist, or create `AGENTS.md` when neither
exists. The idempotent block is:

```text
<!-- BEGIN MIRROR — DO NOT EDIT THIS SECTION -->
...
<!-- END MIRROR -->
```

Prompt `list --names` emits names only. Prompt `show <id>` emits the raw body.
Ordinary config/version commands never mutate agent resources.

## Upgrade And Uninstall

`mirror upgrade` supports:

- `--version <version>`;
- `--arch <x64|arm64>`;
- `--variant <baseline|default|modern>`;
- `--dry-run`;
- `--format <text|json>`.

The x64 default is `baseline`. `upgrade list` defaults to stable releases and
supports `--page`, `--per-page`, and `--pre-releases`. Remote payloads and
positive integers are TypeBox-validated. Upgrade downloads, validates,
transactionally replaces, verifies, caches, refreshes both global skills, and
reconciles local instruction blocks.

## Installers And Npm Bootstrap

`install.sh` and `install.ps1` print target version, architecture, variant,
source URL, download progress, binary destination, both skill destinations,
instruction files, and final verification. Each installs the binary, configures
PATH when required, installs both global skill copies, and reconciles project
instructions.

The npm `bin` points to `scripts/mirror-bin.mjs`. The Node ESM bootstrap detects
platform/architecture, defaults x64 to baseline, caches the package-version
native binary under `~/.guiho/mirror/npm/`, forwards arguments, stdio, and
environment, and preserves the native exit code.

## Exit Codes

- `0`: success
- `1`: unexpected or operational failure
- `2`: command usage or runtime value validation failure
- `3`: configuration resolution or decoding failure
- `4`: remote release or network failure
- `5`: installation, upgrade, or filesystem mutation failure
- `130`: interruption

## Exact Release Assets

```text
mirror-linux-arm64
mirror-linux-x64
mirror-linux-x64-baseline
mirror-linux-x64-modern
mirror-darwin-arm64
mirror-darwin-x64
mirror-darwin-x64-baseline
mirror-darwin-x64-modern
mirror-windows-arm64.exe
mirror-windows-x64.exe
mirror-windows-x64-baseline.exe
mirror-windows-x64-modern.exe
guiho-s-mirror
guiho-i-mirror
```

GitHub workflow validation rejects missing, duplicate, legacy, or extra assets.
