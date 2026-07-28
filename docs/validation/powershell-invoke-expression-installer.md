---
name: PowerShell Invoke-Expression Installer Validation
purpose: Preserve reproducible local evidence for the GitHub issue 19 fix.
description: Validation report for null-safe stage diagnostics and the public PowerShell installer execution path.
created: 2026-07-28
owner: mirror-docs-validation
flags: [local-complete, xdocs-blocked]
tags: [mirror, validation, windows]
keywords: [Invoke-Expression, go test, exact assets, installer]
---

# PowerShell Invoke-Expression Installer Validation

## Local evidence

| Gate | Outcome |
| --- | --- |
| Public v4.0.0 reproduction control | Passed in an isolated Windows PowerShell 5.1 home/project/install root; the environment-sensitive original null was not reproduced. |
| PowerShell parser | Passed with the Windows PowerShell 5.1 language parser. |
| Controlled failure | Passed through `Invoke-Expression`; a blank architecture reports `Mirror installer failed during architecture detection` and creates no install directory. |
| Focused Go test | Passed: `go test -count=1 ./devops`. |
| Format | Passed: `gofmt -l .` returned no paths. |
| Full tests | Passed: `go test -count=1 ./...`. |
| Static analysis | Passed: `go vet ./...`. |
| Release build | Completed the eight static native targets, skill ZIP, instruction prompt, and checksum manifest for 11 assets. |
| Exact-set verifier | Passed with `go run ./devops/verify-release-assets --directory bin`; 11 expected assets and 10 checksum entries. |
| Offline PowerShell installer | Passed twice through `Get-Content -Raw devops/install.ps1 \| Invoke-Expression`; both runs verified three artifacts, installed the exact binary, installed both skill copies, and retained exactly one instruction block. |
| Configuration | Passed: `go run . config check`. |
| Command contracts | Passed: `go run . --help-tree` and `go run . --help-docs`. |
| Patch hygiene | Passed: `git diff --check`. |

## XDocs limitation

The required commands were attempted:

```text
xdocs meta devops --documents --strict
xdocs tree
xdocs doctor devops
```

All exit with code 3 before reading metadata:

```text
scan.exclude entries must be non-empty directory names
```

The repository's pre-existing `xdocs.yaml` uses path-shaped exclusions such as
`devops/build-binaries` and `mirror/node_modules`. Correcting that unrelated
configuration is deferred rather than bundled into the installer PR.

## Hosted and release gates

- The pull request's Windows job must run the modified offline
  `Invoke-Expression` test.
- No version bump, tag, release, or publication was performed.
- Mirror decision: recommend a patch only after review and merge.
