---
name: GUIHO Convention 0001 Mirror Identities
purpose: Record the confirmed CLI home, main skill, and canonical prompt identities for Mirror.
description: Defines the human-confirmed Mirror identities required by GUIHO Conventions 0001 and 0002.
created: 2026-08-16
owner: mirror-docs-decisions
flags:
  - accepted
tags:
  - mirror
  - decision
  - identities
keywords:
  - CLI home
  - guiho-s-mirror
  - guiho-p-mirror-install
  - guiho-p-mirror-uninstall
  - human confirmation
---

# GUIHO Convention 0001 Mirror Identities

## Status

**Accepted.** On 2026-08-23 the human explicitly confirmed the canonical
installation and uninstallation prompt IDs after directing the implementation
to apply GUIHO Conventions 0001 and 0002.

## Decision

| Identity | Confirmed value | Consequence |
| --- | --- | --- |
| CLI home name | `mirror` | Canonical home is `$HOME/.guiho/mirror/`. |
| Main skill ID | `guiho-s-mirror` | Release and installed skill asset is `guiho-s-mirror.zip`. |
| Installation prompt ID | `guiho-p-mirror-install` | Canonical prompt file is `guiho-p-mirror-install.md`. |
| Uninstallation prompt ID | `guiho-p-mirror-uninstall` | Canonical prompt file is `guiho-p-mirror-uninstall.md`. |

The managed instruction ID remains `guiho-i-mirror`; it is an instruction
artifact and is not exposed through the prompt command tree.

## Rationale

`mirror` is the public command and current project identity.
`guiho-s-mirror` is the existing installed skill identity referenced by the
repository. The prompt IDs use the mandatory `guiho-p-` artifact prefix and
make each one-time lifecycle operation explicit without conflating either
prompt with the permanent managed instruction.

## Gate

The identity gate is satisfied. Any later rename is a breaking artifact
identity change and requires coordinated updates to all references, registries,
manifests, installers, documentation, and consumers.

## Consequences

- The current manifest design has 25 assets: eight payloads, eight launchers,
  seven neutral content assets, the manifest, and checksums. This count is
  derived from the manifest rather than a separately fixed contract.
- The CLI home, manifest canonical paths, installer output, PATH migration,
  uninstall ownership, embedded skill guidance, README commands, and recovery
  blocks use these exact identities.
- Renaming later is an explicit installation migration, not an alias inferred
  at runtime.
