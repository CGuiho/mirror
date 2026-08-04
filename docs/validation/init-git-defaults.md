---
name: Mirror Init Git Defaults Validation
purpose: Preserve reproducible evidence for the GitHub issue 26 init-default fix.
description: Validation report for Git-first mirror init defaults, explicit source overrides, prompt defaults, and release readiness.
created: 2026-08-05
updated: 2026-08-05
owner: mirror-docs-validation
flags: [local-complete, xdocs-blocked]
tags: [mirror, validation, init]
keywords: [mirror init, git default, Y/n, issue 26]
---

# Mirror Init Git Defaults Validation

## Local Evidence

| Gate | Outcome |
| --- | --- |
| Issue reproduction | Covered by regression: `mirror init` in a directory with `package.json` now still generates Git source/output. |
| Explicit overrides | Passed: `--source package.json` still generates package source/output plus Git output. |
| Prompt defaults | Passed: init tests still assert `Create release commits? [Y/n]` and `Push release refs? [Y/n]`. |
| Focused tests | Passed: `go test -count=1 ./cmd -run "TestInit"`. |
| Full Go validation | Passed: `go test -count=1 ./...` with Git-for-Windows `sh.exe` available for POSIX installer tests. |
| Vet | Passed: `go vet ./...`. |
| Configuration | Passed: `go run . config check`. |
| CLI contracts | Passed: `go run . --help-docs` and `go run . --help-tree`; init help reports `--source ... default git`. |
| Module graph | Passed: `go mod tidy` made no changes. |

## XDocs Validation

`xdocs meta docs/todo --documents --strict`, `xdocs tree`, and
`xdocs doctor docs/todo` are blocked by the repository's existing
`xdocs.yaml` `scan.exclude` shape: `scan.exclude entries must be non-empty
directory names`. This is the same pre-existing repository XDocs blocker
recorded by earlier validation reports and is not introduced by the init fix.

## Release Boundary

The issue fix is ready for a requested `prerelease` Mirror bump from the current
alpha prerelease. Publication remains the repository's tag-triggered workflow.
