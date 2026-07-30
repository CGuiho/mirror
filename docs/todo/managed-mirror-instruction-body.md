---
name: Managed Mirror Instruction Body
purpose: Define the bounded correction that excludes release metadata from managed instruction blocks.
description: Tracks frontmatter stripping, heading level, idempotent replacement, installer parity, and regression coverage.
created: 2026-07-30
updated: 2026-07-30
owner: mirror-docs-todo
flags: []
tags:
  - mirror
  - agents
  - instructions
keywords:
  - managed block
  - YAML frontmatter
  - instruction prompt
---

# Managed Mirror Instruction Body

## Todo Index

- Task: `Managed Mirror Instruction Body`
- Status: testing
- Index: [todo.md](../../todo.md)

## Plan Unit

- Unit: `MIB-01`
- Dedicated architecture and implementation-plan documents are unnecessary
  because this is a bounded rendering correction within the approved managed
  instruction lifecycle.
- Existing authority: the embedded `guiho-i-mirror.md` release asset,
  `pkg/maintenance`, both public installers, and their existing idempotency
  contracts.

## Required Outcome

- Keep valid `guiho-i-mirror` YAML frontmatter in the embedded and released
  Markdown asset so release validation and `agent prompt show` retain metadata.
- Strip exactly one leading YAML frontmatter document before writing a managed
  project instruction block.
- Begin the inserted body with `## GUIHO Mirror Instruction Block`.
- Apply the same rendering contract to plain Mirror bootstrap, explicit agent
  instruction commands, and both public installers.
- Replace existing managed blocks idempotently without changing surrounding
  project content.

## Acceptance Signals

- The first line after the begin marker is
  `## GUIHO Mirror Instruction Block`.
- No `---`, `name: guiho-i-mirror`, or other descriptor metadata appears
  between the managed markers.
- The standalone release asset still begins with valid YAML frontmatter and
  passes the exact release verifier.
- Go tests cover runtime reconciliation, root bootstrap, and installer source
  contracts.
- Complete Go tests, vet, release build/verifier, and offline installer
  acceptance pass.

## Scope

### In scope

- Embedded prompt heading.
- Go managed-instruction rendering.
- Unix and PowerShell installer managed-block rendering.
- CI and focused regression coverage.
- Documentation and validation evidence.

### Out of scope

- Changing any repository `AGENTS.md`.
- Removing metadata from the standalone prompt asset.
- Release publication, tagging, or semantic-version application.
- Repairing unrelated XDocs configuration.

## Lifecycle

- Current phase: testing (`MIB-01`).
- Mirror decision: no release action is authorized; delivery ends at the
  fork-based upstream pull request.

## Implementation Milestone

- `EmbeddedInstructionBody` validates and removes exactly one leading
  frontmatter document before Go reconciliation or instruction display.
- `mirror agent prompt show` remains the raw metadata-bearing asset, while
  `mirror agent instruction show` emits only the managed body.
- PowerShell and Bash installers validate the raw asset and strip frontmatter
  only when writing a managed block.
- PowerShell preserves the target file's LF or CRLF convention.
- Existing contaminated blocks are replaced idempotently while unmanaged
  content remains intact.
- The released prompt body now begins with
  `## GUIHO Mirror Instruction Block`.

## Evidence

- Review:
  [Managed Mirror Instruction Body Review](../reviews/implementation/managed-mirror-instruction-body-review.md)
- Validation:
  [Managed Mirror Instruction Body Validation](../validation/managed-mirror-instruction-body.md)
- XDocs metadata execution is blocked by the repository's pre-existing
  `scan.exclude` path entries; descriptor coverage was updated manually.
