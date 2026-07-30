---
name: Managed Mirror Instruction Body Validation
purpose: Preserve reproducible evidence for metadata-free managed instruction rendering.
description: Validation report for raw prompt identity, stripped managed bodies, installer parity, newline preservation, idempotency, and exact release assets.
created: 2026-07-30
updated: 2026-07-30
owner: mirror-docs-validation
flags: [local-complete, xdocs-blocked]
tags:
  - mirror
  - validation
  - agents
keywords:
  - managed instruction
  - YAML frontmatter
  - Invoke-Expression
  - release assets
---

# Managed Mirror Instruction Body Validation

## Local Evidence

| Gate | Outcome |
| --- | --- |
| Focused regressions | Passed: `go test -count=1 ./pkg/maintenance ./cmd ./devops`. |
| Complete Go suite | Passed: `go test -count=1 ./...`. |
| Static analysis | Passed: `go vet ./...`. |
| Formatting and patch hygiene | Passed: `gofmt -l .` returned no paths and `git diff --check` passed. |
| PowerShell syntax | Passed with the Windows PowerShell 5.1 parser. |
| Bash syntax and writer | `bash -n devops/install.sh` passed; the sourced writer ran twice in a disposable fixture, remained byte-for-byte idempotent, began with the level-two heading, excluded prompt identity metadata, and put the end marker directly after the final body line. |
| Raw prompt contract | Rebuilt native Windows `agent prompt show` begins with `---` and `name: guiho-i-mirror`. |
| Instruction show contract | Rebuilt native Windows `agent instruction show` begins with `## GUIHO Mirror Instruction Block` and contains no frontmatter. |
| Native bootstrap | Rebuilt Windows binary created a body-only managed block in a disposable repository. |
| PowerShell renderer newline contract | Regression passes with a pre-existing CRLF target and rejects lone LF output. |
| Offline PowerShell installer | Passed twice through `Invoke-Expression` using verified local assets, blank runtime architecture sources, and a legacy metadata-bearing block; preserved user content, produced one body-only block, and the second run was byte-for-byte idempotent. |
| Exact release set | Builder and verifier passed with eight native executables, one skill ZIP, the raw prompt asset, and one checksum manifest; 11 assets and 10 checksum entries. |
| Configuration and help | `go run . config check`, `go run . --help-tree`, and `go run . --help-docs` passed. |
| Repository instruction safety | `git diff --name-only` contains no `AGENTS.md`. |

## XDocs Limitation

Strict metadata, tree, and doctor commands were attempted for every changed
subject. They stop before reading metadata with:

```text
scan.exclude entries must be non-empty directory names
```

The unrelated `xdocs.yaml` repair is not bundled into this correction. Changed
documents retain complete frontmatter and are indexed in their companion
descriptors.

## Hosted Gate

- The Linux workflow now checks native bootstrap and the full offline Bash
  installer for the exact first body line and absence of prompt identity
  metadata.
- The Windows workflow checks blank AMD64 and ARM64 fallback sources, the
  unsupported-architecture failure, two full `Invoke-Expression` installs, and
  the body-only managed block.
- No version bump, tag, release, or publication was performed.
