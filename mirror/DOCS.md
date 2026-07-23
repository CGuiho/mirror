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

With no arguments, Mirror prints a deterministic welcome page containing the
product identity, purpose, platform, architecture, version, and help command:

```text
╔════════════════════════════════════════════════════╗
║  MIRROR                                            ║
║  Semantic project versioning                       ║
║  GUIHO                                             ║
╚════════════════════════════════════════════════════╝
```

When a newer stable version is cached, the welcome ends with an upgrade notice.

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
`schema/mirror.schema.json`. `mirror config schema --save` atomically and
idempotently saves that schema to `~/.guiho/mirror/schema.json`. Install,
upgrade, and init refresh this global copy. Generated configurations use the
portable HTTPS schema modeline because YAML language servers do not guarantee
shell-style `~` expansion and committed files must not contain a machine-local
absolute home path.

## Startup And Cache

Global data is stored under `~/.guiho/mirror/`. The foreground reads
`cache.json` before ordinary output. On the welcome page a cached update prints:

```text
⚠ New version available: v<version>
  Run mirror upgrade to update.
```

Network checks run in a hidden detached worker. The foreground awaits only the
local cache, lease, and process-spawn handoff; it never awaits the network
request. Before spawning, Mirror acquires
one atomic lease under `~/.guiho/mirror/.update-check.lock`; simultaneous
foreground invocations coalesce behind that lease instead of creating more
workers. A worker performs exactly one check, aborts after 15 seconds, releases
its owned lease in `finally`, and exits. A serialized recovery path reclaims
leases older than 30 seconds without allowing an old token to delete a newer
owner. Scheduling failures are isolated from the foreground command. Help and
version requests remain free of configuration, agent, update-network, Git, and
filesystem mutations.

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

The x64 default is `baseline`. `upgrade list` includes every stable and
prerelease version by default and supports `--page` and `--per-page`; the
legacy `--pre-releases` spelling remains accepted. Remote payloads and positive
integers are TypeBox-validated. Upgrade downloads, validates,
transactionally replaces, verifies, saves the global schema with the newly
installed binary, caches, refreshes both global skills, and
reconciles local instruction blocks.

## Installers And Npm Bootstrap

`install.sh` and `install.ps1` print target version, architecture, variant,
source URL, download progress, binary destination, both skill destinations,
instruction files, and final verification. Each installs the binary, configures
PATH when required, saves `~/.guiho/mirror/schema.json`, installs both global skill copies, and reconciles project
instructions. Downloaded `guiho-s-mirror.md` and `guiho-i-mirror.md` payloads
must be nonempty text with YAML frontmatter naming the expected resource.
Installers reject PE, NUL-containing, invalid UTF-8 on Windows, binary, or
identity-mismatched content before writing skills or instruction blocks.

The public installers are directly pipeable and do not depend on neighboring
checkout files:

```powershell
irm https://raw.githubusercontent.com/CGuiho/mirror/main/devops/install.ps1 | iex
```

```sh
curl -fsSL https://raw.githubusercontent.com/CGuiho/mirror/main/devops/install.sh | bash
```

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
guiho-s-mirror.md
guiho-i-mirror.md
```

GitHub workflow validation rejects missing, duplicate, legacy, or extra assets.
The workflow obtains this exact set from the same TypeScript manifest as the
build, requires exactly fourteen unique remote names, and uses the supported
single `--jq '.assets[].name'` GitHub CLI argument.

GitHub Release notes are generated from the exact `## [<version>]` changelog
section and stop at the next level-two heading. Missing or duplicate exact
sections fail the workflow. Reruns update the existing release description with
that same section instead of appending or publishing the full changelog.
