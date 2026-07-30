---
name: PowerShell Invoke-Expression Installer Validation
purpose: Preserve reproducible local evidence for the GitHub issue 19 fix.
description: Validation report for null-safe stage diagnostics and the public PowerShell installer execution path.
created: 2026-07-28
updated: 2026-07-30
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
| Controlled failure | Passed through `Invoke-Expression`; an explicit unsupported architecture reports the exact `architecture detection` failure and creates no install directory. |
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

## Follow-up Evidence

| Gate | Outcome |
| --- | --- |
| Reported post-merge failure | Confirmed from Git Bash into Windows PowerShell: runtime architecture was reported missing or empty. |
| Blank architecture sources | Focused Windows tests force blank test/runtime/WOW64 values and pass with both AMD64 and ARM64 processor fallbacks. |
| Full offline fallback | Passed twice through `Invoke-Expression` with blank test/runtime/WOW64 sources and `PROCESSOR_ARCHITECTURE=AMD64`. |
| Complete regression | Full Go tests, vet, parser, Bash syntax, exact 11-asset build/verifier, configuration, generated help, and diff hygiene pass after the follow-up. |

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

- Pull request
  [#20](https://github.com/CGuiho/mirror/pull/20) merged the initial stage-aware
  correction. The architecture-source follow-up is prepared on
  `codex/fix-powershell-architecture-fallback`.
- CI run
  [30370046395](https://github.com/CGuiho/mirror/actions/runs/30370046395)
  ended as `action_required` with no jobs because the forked workflow requires
  upstream approval.
- After creation and approval, the follow-up pull request's Windows job must run the modified offline
  `Invoke-Expression` test.
- No version bump, tag, release, or publication was performed.
- Mirror decision: recommend a patch only after review and merge.
