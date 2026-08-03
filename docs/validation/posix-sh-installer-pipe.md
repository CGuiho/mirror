---
name: POSIX sh Public Installer Pipe Validation
purpose: Preserve reproducible evidence for the GitHub issue 22 installer fix.
description: Validation report for POSIX syntax, streamed offline installation, and unchanged Mirror delivery gates.
created: 2026-08-03
updated: 2026-08-03
owner: mirror-docs-validation
flags: [local-complete, hosted-complete, release-ready, xdocs-workaround]
tags: [mirror, validation, installer]
keywords: [posix sh, dash, curl pipe, exact assets]
---

# POSIX sh Public Installer Pipe Validation

## Local Evidence

| Gate | Outcome |
| --- | --- |
| Reproduction analysis | Confirmed: documented `sh` rejects Bash `pipefail`; curl 23 follows the closed downstream pipe. |
| POSIX syntax | Passed with Git for Windows `dash -n devops/install.sh`; Bash parsing also passed. |
| Streamed regression | Passed twice through `dash -s -- --version 0.0.0-test` with disposable checksummed assets. |
| Idempotency | Passed: exact binary version, both skill roots, one managed block, and no prompt frontmatter after the second run. |
| Format and module graph | Passed: `gofmt -l .` returned no paths and `go mod tidy` left `go.mod` and `go.sum` unchanged. |
| Full Go validation | Passed: `go test -count=1 ./...` and `go vet ./...`. |
| Release assets | Passed: eight static binaries, skill ZIP, instruction prompt, and checksum manifest; verifier reported 11 assets and 10 checksums. |
| CLI contracts | Passed: configuration check, command tree, and generated Markdown help. |
| PowerShell parser | Passed; the unrelated Windows installer remains syntactically valid. |
| Patch hygiene | Passed: `git diff --check`. |

The exact-set verifier implements `--directory`; the repository instruction's
`--dir` spelling is a separate pre-existing documentation mismatch and is not
changed in this issue.

## XDocs Validation

XDocs v0.9.0 rejects path-shaped entries in the repository's existing
`scan.exclude`. An equivalent temporary configuration using directory names is
used for metadata, tree, and doctor validation without changing `xdocs.yaml`.
Strict metadata passed for every touched scope, the complete tree rendered, and
root doctor reported zero errors and zero warnings.

## Hosted and Release Gates

- Pull request [#23](https://github.com/CGuiho/mirror/pull/23) run
  [30804069515](https://github.com/CGuiho/mirror/actions/runs/30804069515)
  passed all eight jobs.
- The Go quality and exact-assets job passed the complete twice-run offline
  `sh` stream, full Go validation, and the exact 11-asset verifier.
- The Windows installer job and all six Linux, Darwin, and Windows native smoke
  jobs passed.
- No version bump, tag, release, or publication was performed.
