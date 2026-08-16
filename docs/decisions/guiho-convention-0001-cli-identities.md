---
name: GUIHO Convention 0001 Mirror Identities
purpose: Record the Commander-confirmed CLI home, main skill, and main prompt identities.
description: Accepts the Mirror identities used by the Convention 0001 architecture, implementation plan, manifests, installation layout, and agent artifacts.
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
  - guiho-p-mirror
  - Commander confirmation
---

# GUIHO Convention 0001 Mirror Identities

## Status

**Accepted by the Commander-in-Chief on 2026-08-16.** Convention 0001 forbids
inferring these identifiers; this explicit acceptance closes that gate.

## Accepted Decision

| Identity | Accepted value | Consequence |
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

## Authority

The Commander accepted all three values together with the reviewed
architecture and digest-bound plan. Any later identity change reopens the
architecture, plan, release count/names, tests, schemas/examples, docs, and
TODO acceptance signals before implementation may continue.

## Consequences

- The current manifest design has 25 assets: eight payloads, eight launchers,
  seven neutral content assets, the manifest, and checksums. This count is
  derived from the manifest rather than a separately fixed contract.
- The CLI home, manifest canonical paths, installer output, PATH migration,
  uninstall ownership, embedded skill guidance, README commands, and recovery
  blocks use these exact identities.
- Renaming later is an explicit installation migration, not an alias inferred
  at runtime.
