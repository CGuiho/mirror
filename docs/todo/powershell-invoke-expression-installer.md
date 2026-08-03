---
name: PowerShell Invoke-Expression Installer Hardening
purpose: Define the bounded fix and validation contract for GitHub issue 19.
description: Tracks null-safe installer inputs, stage-aware errors, transactional failure behavior, and real Invoke-Expression regression coverage.
created: 2026-07-28
updated: 2026-08-03
owner: mirror-docs-todo
flags: [testing]
tags:
  - mirror
  - installer
  - windows
keywords:
  - Invoke-Expression
  - null-valued expression
  - transactional installation
---

# PowerShell Invoke-Expression Installer Hardening

## Todo Index

- Task: `PowerShell Invoke-Expression Installer Hardening`
- Status: completed
- Index: [TODO.md](../../TODO.md)
- External:
  [CGuiho/mirror#19](https://github.com/CGuiho/mirror/issues/19)
- Pull request:
  [CGuiho/mirror#20](https://github.com/CGuiho/mirror/pull/20)

## Plan Unit

- Unit: `PSI-19`
- Dedicated architecture and implementation-plan documents are unnecessary
  because this is a bounded correction to the approved standalone installer
  contract.
- Existing authority:
  `devops/install.ps1`, the Go release asset manifest, the Windows installer CI
  job, and the public installer validation records.

### Follow-up unit

- Unit: `PSI-19-F1`
- Trigger: post-merge reproduction on 2026-07-30 from Git Bash into Windows
  PowerShell.
- Dedicated architecture and implementation-plan documents remain unnecessary
  because this is a bounded correction to architecture-source precedence.
- Required outcome: ignore blank architecture candidates, fall back through
  Windows processor environment variables and runtime architecture, and keep
  explicit unsupported-architecture diagnostics.

## Reproduction Evidence

- The reported public command fails in an affected Windows PowerShell
  environment with `InvokeMethodOnNull`.
- An isolated Windows PowerShell 5.1 execution on 2026-07-28 successfully
  downloaded, verified, installed, and cleaned up Mirror v4.0.0.
- The defect is therefore environment-sensitive, while the absence of
  null-boundary guards and stage-aware errors is deterministic.
- Current Windows CI executes the installer as a file with an exact offline
  version and does not pipe the installer source through `Invoke-Expression`.
- After PR #20 merged, the exact public command failed from
  `C:\cguiho\meudon-laboratory-manager` with:

  ```text
  Mirror installer failed during architecture detection: Windows architecture is missing or empty.
  ```

- Persistent process, user, and machine `MIRROR_TEST_ARCH` values are absent,
  confirming that the failure is not a stale test override.

## Scope

### In scope

- Validate nullable installer inputs before invoking string methods.
- Report the exact installer stage when an operation fails.
- Preserve binary rollback and temporary cleanup behavior.
- Exercise the full offline installer twice through `Invoke-Expression` in
  Windows CI.
- Assert a controlled null/invalid input produces an actionable stage error
  without installing a binary.

### Out of scope

- Release publication or version application.
- Agent instruction changes outside the installer's existing explicit
  behavior.
- Unrelated XDocs configuration repair.

## Acceptance Signals

- The public script has no unguarded method call on nullable environment,
  release, checksum, prompt, or command-output values.
- A controlled architecture-resolution failure names the architecture stage.
- The offline Windows installer succeeds twice through `Invoke-Expression`.
- Failed pre-install validation leaves no installed candidate or partial agent
  resource transition.
- `gofmt -l .`, `go test -count=1 ./...`, `go vet ./...`, focused Windows
  PowerShell checks, and the exact release build/verifier contract pass.

## Lifecycle

- Current phase: testing (`PSI-19-F1`).
- Initial phase: `PSI-19` completed after pull-request and merged-main CI
  succeeded; the architecture-source follow-up remains in testing until its
  refreshed merge commit passes hosted CI.
- Plan waiver: a separate plan is unnecessary for the bounded `PSI-19` unit.
- XDocs note: PR validation with XDocs v0.9.0 rejected the repository's
  pre-existing path-shaped `scan.exclude` entries. The installed v0.7.2 CLI
  passes strict metadata, tree, and doctor during the release audit; the
  version-specific configuration compatibility remains separate from this
  installer unit.
- Mirror decision: the merged compatible fix is selected for the separately
  authorized `mirror/v4.0.1` patch release.

## Implementation Milestone

- Added required-text validation for environment, architecture, release,
  checksum, prompt, and installed-version values before string methods run.
- Added one top-level installer stage boundary while preserving nested binary
  rollback and temporary cleanup.
- Updated Windows CI to run the complete offline installer twice through
  `Invoke-Expression`.
- Added a Windows Go regression proving an invalid architecture identifies the
  architecture stage and creates no install directory.
- Focused parser, Go contract, and PowerShell failure-path checks pass.

## Delivery

- Fork: `cguiho-itron/mirror`
- Branch: `codex/fix-powershell-installer-null`
- Implementation commit: `14511a680632d20f8def3da95c0d76b875e94d4f`
- Evidence commit: `779a0ea33e00b4696b9f564217ff2fb3c0aa93db`
- Pull request:
  [CGuiho/mirror#20](https://github.com/CGuiho/mirror/pull/20)
- Merge commit: `c49eccf095d0a0eba47903be37b0603bb53e24f8`.
- Final pull-request CI run
  [30370284376](https://github.com/CGuiho/mirror/actions/runs/30370284376)
  and merged-main CI run
  [30465213620](https://github.com/CGuiho/mirror/actions/runs/30465213620)
  completed successfully.
- Issue [#19](https://github.com/CGuiho/mirror/issues/19) is closed as
  completed.

## Follow-up implementation milestone

- Blank `MIRROR_TEST_ARCH` and runtime architecture candidates are ignored.
- Detection falls through runtime OS architecture,
  `PROCESSOR_ARCHITEW6432`, process `PROCESSOR_ARCHITECTURE`, and machine
  `PROCESSOR_ARCHITECTURE`.
- Focused Windows tests force the runtime sources blank and verify both AMD64
  and ARM64 processor fallbacks.
- The controlled failure regression now uses an explicit unsupported value,
  preserving stage diagnostics without treating whitespace as fatal.
- Full Go tests, vet, the exact 11-asset build/verifier, command contracts, and
  two offline `Invoke-Expression` installs with blank runtime sources pass.
- Delivery branch: `codex/fix-powershell-architecture-fallback` on
  `cguiho-itron/mirror`; pull request
  [#21](https://github.com/CGuiho/mirror/pull/21).
- Hosted CI run
  [30534110081](https://github.com/CGuiho/mirror/actions/runs/30534110081)
  passed all eight jobs before the `main` refresh. The merge-resolution commit
  must pass the refreshed hosted gate before merge.
