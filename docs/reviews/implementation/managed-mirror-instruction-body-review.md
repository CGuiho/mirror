---
name: Managed Mirror Instruction Body Implementation Review
purpose: Review metadata-free managed instruction rendering across the Go CLI and public installers.
description: Local review of prompt identity preservation, frontmatter stripping, newline handling, idempotency, and delivery boundaries.
created: 2026-07-30
updated: 2026-07-30
owner: mirror-docs-reviews-implementation
flags: [accepted-local]
tags:
  - mirror
  - review
  - agents
keywords:
  - managed instruction
  - YAML frontmatter
  - idempotency
---

# Managed Mirror Instruction Body Implementation Review

## Verdict

Accepted for pull-request handoff. No blocking local finding remains. Hosted
Linux and Windows CI are still required before merge; publication is outside
this task. An independent subagent review reported no blocking correctness or
security finding; its two minor parity/link findings were corrected and
regression-tested before handoff.

## Scope Reviewed

- [Task specification](../../todo/managed-mirror-instruction-body.md)
- `embed/prompts/guiho-i-mirror.md`
- `pkg/maintenance`
- `cmd/agent.go`
- `devops/install.ps1`
- `devops/install.sh`
- `.github/workflows/ci.yml`
- user-facing documentation, tests, and XDocs descriptors

## Findings

### Closed

- The prompt asset retains the required `guiho-i-mirror` frontmatter for
  identity validation, release verification, and raw prompt inspection.
- Go, PowerShell, and Bash strip only the leading frontmatter document at the
  managed-block rendering boundary.
- The managed body begins immediately after the begin marker with the requested
  `## GUIHO Mirror Instruction Block` heading.
- Plain bootstrap, explicit instruction mutation, and both installer paths use
  the same body-only contract.
- Existing marker-bounded content is replaced rather than appended, so a
  previously contaminated block is repaired on the next run.
- Go preserves host newline conventions; PowerShell now explicitly rewrites
  normalized body newlines to the target file's LF or CRLF convention.
- Validation and installer failures occur before replacing the project file.
- Go, PowerShell, and Bash put the end marker directly after the final body line
  with no installer-specific extra blank line.
- No repository `AGENTS.md` is modified.

### Residual

- The complete Bash installer cannot execute a Linux native asset from this
  Windows host. Bash syntax and body extraction pass locally; the existing
  Linux CI installer job now asserts the exact marker-to-heading transition and
  absence of frontmatter.
- XDocs v0.9.0 rejects pre-existing path-shaped `scan.exclude` entries before
  inspecting changed metadata.

## Release Boundary

The correction is compatible with a future patch release after review and
merge. This task does not authorize version application, tagging, release
creation, or publication.
