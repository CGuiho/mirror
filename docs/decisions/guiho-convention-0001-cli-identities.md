---
name: GUIHO Convention 0001 Mirror Identities
purpose: Record the proposed CLI home, main skill, and main prompt identities that require human confirmation.
description: Proposes names consistent with existing Mirror identity and GUIHO agent naming while keeping publication and installation blocked until explicitly confirmed.
created: 2026-08-16
owner: mirror-docs-decisions
flags:
  - proposed
  - approval-required
tags:
  - mirror
  - decision
  - identities
keywords:
  - CLI home
  - guiho-s-mirror
  - guiho-p-mirror
  - human confirmation
---

# GUIHO Convention 0001 Mirror Identities

## Status

**Proposed; human confirmation required.** Convention 0001 forbids inferring
these identifiers. Existing repository usage is supporting evidence, not a
substitute for confirmation.

## Proposed Decision

| Identity | Proposed value | Consequence |
| --- | --- | --- |
| CLI home name | `mirror` | Canonical home is `$HOME/.guiho/mirror/`. |
| Main skill ID | `guiho-s-mirror` | Release and installed skill asset is `guiho-s-mirror.zip`. |
| Main prompt ID | `guiho-p-mirror` | Release and installed setup prompt is `guiho-p-mirror.md`. |

The existing managed instruction ID remains `guiho-i-mirror`; it is an
instruction artifact and cannot substitute for the required main prompt.

## Rationale

`mirror` is the public command and current project identity.
`guiho-s-mirror` is the existing installed skill identity referenced by the
repository. `guiho-p-mirror` follows the established GUIHO prompt namespace
without conflating a setup prompt with the managed instruction resource.

## Gate

No implementation unit may publish a release manifest, install canonical
paths, create the new main prompt, or migrate user state until the human marks
this decision **Accepted** (or records different values). If a value changes,
the architecture, plan, release count/names, tests, schemas/examples, docs, and
TODO acceptance signals must be updated together before execution approval.

## Consequences If Accepted

- The current manifest design has 25 assets: eight payloads, eight launchers,
  seven neutral content assets, the manifest, and checksums. This count is
  derived from the manifest rather than a separately fixed contract.
- The CLI home, manifest canonical paths, installer output, PATH migration,
  uninstall ownership, embedded skill guidance, README commands, and recovery
  blocks use these exact identities.
- Renaming later is an explicit installation migration, not an alias inferred
  at runtime.
