---
name: Mirror Go Production Migration Validation
purpose: Preserve reproducible local evidence for the production migration.
description: Validation report for the Go/Cobra runtime and delivery contract.
created: 2026-07-26
owner: mirror-docs-validation
flags: [local-complete]
tags: [mirror, validation, go]
keywords: [go test, go vet, exact assets, installer]
---

# Mirror Go Production Migration Validation

## Local evidence

| Gate | Outcome |
| --- | --- |
| Format and module graph | Passed: `gofmt -l .` empty and consecutive `go mod tidy` runs byte-stable. |
| Full tests | Passed: `go test -count=1 ./...`, including `cmd`, `devops`, and every `pkg` package. |
| Static analysis | Passed: `go vet ./...`. |
| Release build | Passed: all eight static targets plus skill ZIP, prompt, and checksums. |
| Exact-set verifier | Passed: exactly 11 expected names, skill ZIP layout, prompt, and SHA-256 manifest. |
| Windows native smoke | Passed: version, JSON build metadata, idempotent argument-free bootstrap, help tree, prompts, config check, exit codes, and out-of-process rollback journal. |
| PowerShell installer | Passed offline exact-asset installation, version verification, dual-root skill installation, and idempotent instruction markers. |
| Root bootstrap and init defaults | Automated tests cover neither/one/both instruction targets, CRLF preservation, malformed markers, idempotent skill/files, option 1, yes defaults, and explicit overrides. |
| Git tag transitions | Tests cover reachable legacy input to canonical output plus tagless exact initial plan/apply and safe relative-target rejection. |
| Workflow contract | Passed Go tests; both workflows parse as YAML and use Go gates plus `mirror/v*`. |

## Final reproducible gate

```text
gofmt -l .
go test -count=1 ./...
go vet ./...
go run ./devops/build-binaries.go --version <version> --commit <sha> --build-date <RFC3339>
go run ./devops/verify-release-assets --dir bin
go run . config check
go run . --help-tree
go run . --help-docs
git diff --check
```

Hosted CI remains responsible for Linux, Darwin, Windows ARM64, and POSIX
installer native execution. No version bump, tag, push, publication, or GitHub
release was performed during this validation.
