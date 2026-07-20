---
name: Mirror Public Installers And Platform Greeting Validation
purpose: Record verification evidence for GitHub issues 12 and 13.
description: Tracks installer copying, focused regressions, repository checks, release checks, and public installation evidence.
created: 2026-07-20
owner: mirror-docs-validation
flags: []
tags:
  - mirror
  - validation
keywords:
  - installer
  - greeting
---

# Mirror Public Installers And Platform Greeting Validation

## Scope

- [Task specification](../todo/public-installers-and-platform-greeting.md)
- [GitHub issue #12](https://github.com/CGuiho/mirror/issues/12)
- [GitHub issue #13](https://github.com/CGuiho/mirror/issues/13)

## Implementation Evidence

- `devops/install.ps1` is an exact RunX PowerShell copy after mechanical
  RunX-to-Mirror identifier replacement.
- `devops/install.sh` is an exact XDocs Bash copy after mechanical
  XDocs-to-Mirror identifier replacement.
- `mirror/source/cli.ts` maps native platforms to `Windows`, `Linux`, and
  `macOS` for the no-argument greeting.
- `mirror/source/installer.spec.ts` rejects regression to a relative checkout
  wrapper and exercises the public curl-to-bash command on POSIX runners.

## Verification

### Local

- `bun run typecheck`: passed.
- `bun test`: passed, 45 tests and 247 expectations.
- `bun run build`: passed, 12 native binaries and 14 total release assets.
- `bash -n devops/install.sh`: passed with Git Bash.
- Focused public POSIX installer regression: passed.
- Restricted-policy `irm ... | iex` regression: passed.
- Isolated public 3.5.5 PowerShell installation: downloaded, installed, and
  verified successfully.
- Built Windows x64 baseline binary with no arguments: printed
  `Hello Windows - mirror v3.5.5`.
- XDocs strict metadata, tree, and repository doctor checks: passed.

### Release Gate

Mirror planned patch release `3.5.6`. CI, publication, public Linux/POSIX
installation, release assets, and issue closure remain release gates.
