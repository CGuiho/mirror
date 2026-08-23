---
name: Windows Upgrade Bridge and Stable Launcher Validation
purpose: Record local and native evidence for the synchronous upgrade repair.
description: Captures Go quality, released-v4.2.4 bridge, native launcher, installer, recovery output, release matrix, RunX, and XDocs results.
created: 2026-08-23
owner: mirror-docs-validation
flags: [validation, hosted-ci-pending]
tags: [mirror, validation, upgrade, windows]
keywords: [v4.2.4 bridge, native Windows, stable launcher, immutable payload, recovery output]
---

# Windows Upgrade Bridge and Stable Launcher Validation

## Result

Local implementation validation passed. Hosted CI and independent PR gates are
pending. No production installation, tag, release, deployment, or promotion was
performed.

## Root-Cause Proof

Released tag `mirror/v4.2.4` points to `375ce8e`. Its
`VerifyExecutable` requires exactly `mirror v<target>`. Released v4.2.5 emits
raw `<target>`. Its helper therefore stages v4.2.5, rejects its output, restores
`.old`, and does so after the parent reported deferred success.

## Evidence

| Check | Result |
| --- | --- |
| `gofmt -l .` | Passed; no files listed. |
| `go mod tidy` clean comparison | Passed; `go.mod` and `go.sum` unchanged. |
| `go vet ./...` | Passed. |
| `go test -count=1 ./...` | Passed, including launcher and native executable integration. |
| Native legacy-parent unit proof | Passed on Windows; helper process ancestry plus decorated `.old` was detected. |
| Exact released v4.2.4 helper proof | Passed: downloaded `mirror-windows-amd64.exe` from `mirror/v4.2.4`, ran its real `upgrade __replace-windows` helper against the new candidate, received helper exit 0, then ordinary launcher `--version` returned raw `4.2.6`. |
| Exact bridge installed state | Passed: `current.json` active `4.2.6`; immutable `versions/4.2.6/mirror.exe` present; subsequent launcher call removed stale `.old`. |
| Native stable upgrade integration | Passed: built 4.2.6 and 4.2.7 binaries, installed 4.2.6 launcher/payload, synchronously upgraded to 4.2.7, verified active/previous pointers and retained previous immutable payload. |
| Delegated exit | Passed: launcher returned child usage exit code 2 exactly. |
| Hidden self-test | Passed directly and through the installed launcher. |
| Windows offline installer | Passed with isolated home/project: launcher, payload, `current.json`, skills, instruction, raw launcher version, and delegated exit verified. |
| `sh -n`, `dash -n`, `bash -n` | Passed for `devops/install.sh`. |
| PowerShell AST parser | Passed for `devops/install.ps1`. |
| Deliberate unresolved exact upgrade | Passed: exit 4; stdout contained exactly two identical Windows reinstall blocks; stderr contained only the catalog error; first block preceded network and final block followed the diagnostic in main execution order. |
| Exact release build | Passed: eight native executables plus three support assets. |
| Release asset verifier | Passed: 11 assets and 10 checksum entries. |
| Native Windows release smoke | Passed: raw `4.2.6`, hidden self-test, and usage exit 2. |
| `runx check --format json` | Passed with v2 catalog and seven commands. |
| `runx list --format json` | Passed. |
| `runx run --dry-run mirror-test-stable-upgrade` | Passed; exact native proof command shown without execution. |
| XDocs strict metadata | Passed repository-wide. |
| `xdocs tree` | Passed; launcher and updater are connected. |
| `xdocs doctor .` | Passed with zero errors and zero warnings. |
| `go test -race` | Skipped: the required project environment sets `CGO_ENABLED=0`; Go rejects `-race` without cgo. Ordinary and native process tests passed. |

## Remaining Gates

- Hosted GitHub Actions matrix.
- Independent implementation review bound to the exact PR head.
- Integration decision and post-merge Mirror patch/bridge release decision.
