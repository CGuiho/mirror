---
name: Mirror v4.1.0 Hooks Validation
purpose: Preserve reproducible implementation evidence for GitHub issue 24.
description: Validation report for typed hook configuration, lifecycle execution, trust, reporting, exact assets, and agent boundaries.
created: 2026-08-04
updated: 2026-08-04
owner: mirror-docs-validation
flags: [local-complete, hosted-pending, xdocs-workaround]
tags: [mirror, validation, hooks]
keywords: [mirror.yaml, lifecycle hooks, command trust, json output]
---

# Mirror v4.1.0 Hooks Validation

## Local Evidence

| Gate | Outcome |
| --- | --- |
| Typed configuration | Passed canonical definitions, explicit compatibility aliases, unknown-event rejection, duplicate normalization rejection, and schema assertions. |
| Lifecycle ordering | Passed success, nested error, best-effort error, unconditional finalizer, write-batch, and partial-push regressions. |
| Trust and side effects | Passed explicit run, explicit skip, non-interactive fail-closed, dry-run, and pre-hook confirmation coverage. |
| Context and reporting | Passed private cleanup, Windows atomic replacement, environment, stdout/stderr capture, child exit, cancellation, result, and JSON-purity coverage. |
| Format and patch hygiene | Passed: `gofmt -l .` returned no paths and `git diff --check` returned no findings. |
| Full Go validation | Passed: `go test -count=1 ./...` and `go vet ./...`. |
| CLI contracts | Passed: `go run . config check`, `go run . --help-tree`, and `go run . --help-docs`. |
| Release assets | Passed: eight static executables, one skill ZIP, one instruction prompt, and one checksum manifest; verifier reported 11 assets and 10 checksums. |
| Semantic-version boundary | `go run . version plan 4.1.0` resolved `4.0.1 -> 4.1.0`; no apply, commit, tag, push, or release followed. |

The release verifier currently implements `--directory`; the repository
instruction's `--dir` spelling is a pre-existing documentation mismatch and is
outside issue 24.

## XDocs Validation

XDocs v0.9.0 rejects path-shaped values in the repository's existing
`scan.exclude`. An equivalent temporary configuration using directory names is
used for strict metadata, tree, and doctor checks without changing
`xdocs.yaml`.

## Hosted Gate

Pull-request checks and maintainer review are pending publication. This record
does not claim a release or public installation result.
