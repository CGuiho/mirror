---
name: PowerShell Invoke-Expression Installer Validation
purpose: Preserve reproducible local evidence for the GitHub issue 19 fix.
description: Validation report for null-safe stage diagnostics and the public PowerShell installer execution path.
created: 2026-07-28
updated: 2026-08-03
owner: mirror-docs-validation
flags: [local-complete, hosted-complete, release-ready, xdocs-limitation]
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
| Hosted pre-refresh CI | Passed all eight jobs in run [30534110081](https://github.com/CGuiho/mirror/actions/runs/30534110081). |

## XDocs version note

During the pull request, these required commands were attempted with XDocs
v0.9.0:

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
`devops/build-binaries` and `mirror/node_modules`. During the 4.0.1 release
audit, the installed XDocs v0.7.2 CLI accepted the configuration and passed
strict root metadata, the complete tree, and root doctor with zero errors and
zero warnings. Compatibility with the stricter v0.9.0 configuration validator
remains a separate maintenance concern and is not bundled into this installer
fix.

## 4.0.1 release-audit refresh

| Gate | Outcome |
| --- | --- |
| Live release gap | Passed: `mirror/v4.0.0` resolves to `890e096c226bf7c5557cc24874bfa4a73a8b859b`, while merged PR #20 resolves to `c49eccf095d0a0eba47903be37b0603bb53e24f8` outside that tag. |
| Format and module graph | Passed: `gofmt -l .` returned no paths; `go mod tidy` left `go.mod` and `go.sum` unchanged. |
| Full Go validation | Passed: `go test -count=1 ./...` and `go vet ./...`. |
| Release candidate | Passed: eight static binaries plus skill ZIP, instruction Markdown, and checksum manifest; the verifier reported exactly 11 assets and 10 checksums. |
| Windows native smoke | Passed: the candidate reported `mirror v4.0.1` and exposed `guiho-i-mirror`. |
| Windows installer | Passed: controlled pre-install failure plus two complete offline `Invoke-Expression` installations with exact version, dual-root skill, one instruction block, and idempotent plain bootstrap checks. |
| CLI contracts | Passed: configuration check, command tree, and generated Markdown help. |
| XDocs | Passed with installed XDocs v0.7.2: 36 valid descriptors, complete tree, doctor valid with zero errors and zero warnings. |
| Patch hygiene | Passed: `git diff --check`. |

The Darwin, Linux, Windows ARM64, and Linux ARMv6/ARMv7 candidates are local
cross-build evidence only. The tag-triggered hosted workflow owns matching
native-runner evidence where runners exist.

## Hosted and release gates

- Pull request
  [#20](https://github.com/CGuiho/mirror/pull/20) merged into `main` as
  `c49eccf095d0a0eba47903be37b0603bb53e24f8`.
- Final pull-request CI run
  [30370284376](https://github.com/CGuiho/mirror/actions/runs/30370284376)
  completed successfully for head
  `b2355af2ab20bf803cdbbbd00222c41b14c39810`.
- Merged-main CI run
  [30465213620](https://github.com/CGuiho/mirror/actions/runs/30465213620)
  completed successfully for the merge commit.
- Issue [#19](https://github.com/CGuiho/mirror/issues/19) is closed as
  completed.
- Follow-up pull request
  [#21](https://github.com/CGuiho/mirror/pull/21) carries the architecture-source
  fallback and managed-instruction body correction. Its pre-refresh hosted run
  [30534110081](https://github.com/CGuiho/mirror/actions/runs/30534110081)
  passed all eight jobs; the merge-resolution commit requires a fresh run.
- The prior public release remains stable `mirror/v4.0.0`; live ancestry proves
  the merge is not contained in that tag.
- Mirror decision: a patch is correct because the change is a compatible
  installer fix. The authorized target is `mirror/v4.0.1`; release workflow,
  asset, checksum, and downloaded-native-binary verification remain required
  after the tag is applied.
- No version bump, tag, release, or publication was performed by this pull
  request update.
