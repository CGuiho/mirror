---
name: XDocs Scan Exclusion Configuration
purpose: Track the bounded repair of Mirror's invalid XDocs scan exclusions.
description: Removes stale path-shaped scan exclusions so XDocs v0.10.0 can validate the repository while preserving intended generated-directory coverage.
created: 2026-08-13
updated: 2026-08-13
owner: mirror-docs-todo
flags: [complete]
tags: [mirror, xdocs, configuration]
keywords: [scan.exclude, directory names, xdocs validation]
---

# XDocs Scan Exclusion Configuration

## Status

- Status: completed
- Plan unit: `XDOCS-EXCLUDE-01`
- Plan waiver: the installed XDocs error, v0.10.0 source validation, and current
  repository paths make this a question-sealed configuration correction; no
  architecture or separate implementation plan is required.

## Problem

`xdocs.yaml` contains path-shaped `scan.exclude` values even though XDocs
v0.10.0 accepts only non-empty directory names. Every XDocs command fails before
reading repository metadata with:

`scan.exclude entries must be non-empty directory names`

## Scoped Correction

- Remove `devops/build-binaries`: it names no directory and is a stale reference
  to the tracked source file `devops/build-binaries.go`.
- Remove `mirror/node_modules` and `mirror/bin`: the existing basename entries
  `node_modules` and `bin` already exclude those directories at any depth.
- Preserve all valid basename exclusions and `.gitignore` behavior.

## Acceptance

- `xdocs scan`, strict metadata, `xdocs tree`, and repository-wide
  `xdocs doctor --warnings-as-errors` reach metadata validation instead of the
  configuration error and finish successfully after any genuine metadata
  defects uncovered by the restored scan are repaired.
- Git-ignored generated/dependency directories remain excluded.
- Go formatting, tests, vet, configuration, help contracts, and schema parity
  remain green.
- The task records validation, Git delivery, and a no-release Mirror decision.

## Execution State

- Removed the three invalid path-shaped values from `xdocs.yaml`.
- Confirmed `devops/build-binaries` names no directory; the tracked source is
  `devops/build-binaries.go` and remains scanned/documented normally.
- Confirmed `node_modules` and `bin` already exclude matching directories at
  every depth, including `mirror/node_modules` and `mirror/bin`.
- Restored strict metadata validation, which exposed four issue-28 companion
  documents whose `created` fields used timestamps instead of XDocs' required
  `YYYY-MM-DD`; normalized those metadata dates without changing the precise
  timestamps preserved in `todo.md`.
- Initial restored XDocs validation passes: 228 files, 37 covered directories,
  no uncovered directories, valid hierarchy, and doctor with 0 errors and 0
  warnings.
- Mirror decision: no version bump or release for this configuration-only
  documentation tooling correction.
