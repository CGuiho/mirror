---
name: POSIX sh Public Installer Pipe
purpose: Define the repair for the documented Unix installer stream in GitHub issue 22.
description: Tracks POSIX shell compatibility, streamed offline regression coverage, and preservation of installer integrity boundaries.
created: 2026-08-03
updated: 2026-08-03
owner: mirror-docs-todo
flags: [testing]
tags: [mirror, installer, posix]
keywords: [curl pipe, dash, sh, checksum, rollback]
---

# POSIX sh Public Installer Pipe

## Todo Index

- Task: `POSIX sh Public Installer Pipe`
- Status: testing
- Index: [TODO.md](../../todo.md)
- External: [CGuiho/mirror#22](https://github.com/CGuiho/mirror/issues/22)
- Pull request: [CGuiho/mirror#23](https://github.com/CGuiho/mirror/pull/23)

## Plan Unit

- Unit: `POSIX-SH-22`
- A separate architecture or implementation-plan document is unnecessary for
  this bounded correction to the existing standalone installer contract.
- Authority: the documented `README.md` command, `devops/install.sh`, its Go
  contract tests, the Linux CI job, and the exact release-asset manifest.

## Reproduction

The documented command fails when `/bin/sh` is `dash`:

```sh
curl -fsSL https://raw.githubusercontent.com/CGuiho/mirror/main/devops/install.sh | sh
```

```text
sh: 2: set: Illegal option -o pipefail
curl: (23) Failure writing output to destination
```

The curl failure is secondary: `sh` exits on the Bash-only option and closes
the stream. The script also contained Bash conditionals, local variables,
arrays, arithmetic conditions, and process substitution, so removing only
`pipefail` would not satisfy the public contract.

## Scope

### In scope

- Convert the production Linux/macOS installer to valid POSIX `sh`.
- Preserve release resolution failure handling without relying on pipe status.
- Preserve SHA-256 verification, candidate-version validation, rollback,
  temporary cleanup, dual-root skills, managed instructions, and PATH setup.
- Parse under `dash`, `sh`, and Bash.
- Stream the complete offline installer through `sh -s` twice in CI and retain
  Bash source-only target mapping coverage.
- Add a Go regression that performs the twice-run stream against disposable
  verified assets.

### Out of scope

- Windows installer behavior.
- Archived Bun/TypeScript installer behavior.
- XDocs configuration compatibility repair.
- Version application, tagging, release creation, or publication.

## Acceptance Signals

- The documented `curl ... | sh` entrypoint no longer uses Bash-only syntax.
- A real `dash` accepts the script and completes two offline streamed installs.
- The twice-run fixture retains one managed instruction block and both skill
  copies, and the installed binary reports the exact requested version.
- Full Go tests, vet, exact 11-asset build/verifier, configuration, generated
  help, installer syntax, and diff hygiene pass.
- Hosted Linux CI executes the public shell path and the complete native matrix
  remains green.

## Lifecycle

- Current phase: ready for merge; local and hosted validation are complete.
- No release effect is authorized by this task.

## Delivery

- Branch: `codex/fix-posix-sh-installer`
- Pull request: [CGuiho/mirror#23](https://github.com/CGuiho/mirror/pull/23)
- Hosted CI:
  [run 30804069515](https://github.com/CGuiho/mirror/actions/runs/30804069515)
  passed all eight jobs.
