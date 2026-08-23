---
name: Canonical Mirror Lifecycle Prompt Identities
purpose: Track correction of Mirror install and uninstall prompt identities under GUIHO Agent Artifacts Convention 0002.
description: Defines the confirmed prompt IDs, coordinated source and embedded-resource changes, validation, delivery, and local uninstall boundary.
created: 2026-08-23
owner: mirror-docs-todo
flags: []
tags: [mirror, prompts, convention-0002]
keywords: [guiho-p-mirror-install, guiho-p-mirror-uninstall, agent artifacts, uninstall]
---

# Canonical Mirror Lifecycle Prompt Identities

## Status

Completed on 2026-08-23.

## Confirmed Decision

The human explicitly confirmed these prompt IDs:

- `guiho-p-mirror-install`;
- `guiho-p-mirror-uninstall`.

The filename stem and YAML frontmatter `name` must exactly match each ID. Both
artifacts require a SemVer-compatible `metadata.version` and must be available
through `mirror agent prompt list|show`.

## Scope

- Rename the two repository prompt files and their frontmatter identities.
- Embed the canonical prompt files and expose only prompt-type IDs through the
  prompt command tree.
- Update README, XDocs descriptors, CI assertions, accepted identity decision,
  architecture, and plan references.
- Validate formatting, tests, vet, prompt output, strict XDocs metadata, tree,
  and doctor checks.
- Commit and push the validated correction.
- Follow `guiho-p-mirror-uninstall` to remove the locally installed Mirror CLI
  without deleting shared `.guiho` infrastructure or another CLI's artifacts.

## Plan

A dedicated multi-unit plan is unnecessary. The two conventions and the
human-confirmed IDs completely define this bounded identity correction; the
work is one coordinated compatibility unit.

## Validation Evidence

- `gofmt -l .`: clean.
- `go vet ./...`: passed.
- `go test -count=1 ./...`: passed.
- `mirror agent prompt list --names` from source: returned exactly
  `guiho-p-mirror-install` and `guiho-p-mirror-uninstall`.
- Both `agent prompt show` paths returned matching canonical `name` fields and
  `metadata.version: "1.0.0"`; `guiho-i-mirror` is no longer accepted as a
  prompt ID.
- XDocs strict metadata validation: passed repository-wide.
- `xdocs tree`: passed with the restored `agent/` descriptor.
- `xdocs doctor .`: valid with zero errors and zero warnings.
- Delivery: 24 smallest-coherent commits pushed to `origin/main` through
  `74fa638` before local uninstallation.
- Uninstall: installed Mirror `4.2.4` removed; executable, stale Mirror helper
  executables, CLI home, both global skill copies, current managed instruction
  block, and current project `mirror.yaml` removed. Shared `$HOME/.guiho/`,
  `$HOME/.guiho/bin/`, shared `PATH`, and `runx.exe` were preserved.

## Mirror Decision

Patch release deferred. The correction is compatible and belongs in a future
patch, but the user requested local Mirror uninstallation rather than another
version transition.
