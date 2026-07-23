---
name: GUIHO Mirror
purpose: Introduce the Mirror repository and route readers to the canonical package documentation.
description: Repository overview for the RFC 0034-compliant Mirror CLI.
created: 2026-07-18
owner: mirror
flags: []
tags:
  - mirror
  - cli
keywords:
  - semantic versioning
  - RFC 0034
---

# GUIHO Mirror

Mirror is GUIHO's deterministic semantic-versioning CLI. The Bun package and
native CLI live in [`mirror/`](mirror/); repository plans, reviews, validation,
and release automation live at the root.

Mirror uses Bun, strict ESM TypeScript, raw Citty, TypeBox, and YAML. The current
breaking CLI contract is documented in
[`mirror/DOCS.md`](mirror/DOCS.md). Start with:

## Install

PowerShell:

```powershell
irm https://raw.githubusercontent.com/CGuiho/mirror/main/devops/install.ps1 | iex
```

Linux and macOS:

```sh
curl -fsSL https://raw.githubusercontent.com/CGuiho/mirror/main/devops/install.sh | bash
```

The installer selects and verifies a native asset, installs `mirror` on PATH,
persists the configuration schema at `~/.guiho/mirror/schema.json`,
installs `guiho-s-mirror` into both global agent-tool directories, and
reconciles Mirror instructions in the current project.

## Quick Start

```text
mirror init
mirror config check
mirror version current
mirror version plan patch
```

Configuration is `mirror.yaml` only. Mirror resolves an explicit `--config`
path, then `<cwd>/mirror.yaml`, then `~/.guiho/mirror/mirror.yaml`.

Agent resources are explicit:

```text
mirror agent skill install
mirror agent instruction apply
mirror agent prompt list
```

Ordinary config and version commands do not install skills or edit instruction
files. Native releases contain exactly 12 platform binaries plus
`guiho-s-mirror.md` and `guiho-i-mirror.md`.

## Development

```text
cd mirror
bun install
bun run typecheck
bun test
bun run build
```

Do not publish packages or create GitHub releases from an unvalidated worktree.
