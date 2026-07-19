---
name: Mirror Upgrade Reliability Final Implementation Review
purpose: Review GitHub issues 9 and 10 against their complete acceptance contracts before release and closure.
description: Maps the verified implementation, tests, CI evidence, and remaining published-binary gate for Mirror self-upgrade and recovery reliability.
created: 2026-07-19
owner: mirror-docs-reviews-implementation
flags:
  - accepted-source
  - external-release-pending
tags:
  - review
  - cli
  - reliability
keywords:
  - GitHub issue 9
  - GitHub issue 10
  - Windows replacement
  - recovery command
  - published binary
---

# Mirror Upgrade Reliability Final Implementation Review

## Verdict

Source implementation, automated tests, and CI are accepted. GitHub issues
[#9](https://github.com/CGuiho/mirror/issues/9) and
[#10](https://github.com/CGuiho/mirror/issues/10) must remain open until the
new release is published and the design's live older-to-newer binary checks
pass. Local or CI evidence alone is not the approved closure gate.

The corrective tag is `@guiho/mirror@3.5.3` at
`d8513748fb8d41f3118f94309e19c3fbca4ada2f`. Its
[publish run](https://github.com/CGuiho/mirror/actions/runs/29668661444) is
waiting for the protected `production` environment.

## Issue 9 Acceptance

| Criterion | Evidence | Status |
| --- | --- | --- |
| Canonical Windows executable is replaced before success | Native fixture replaces a running `mirror.exe`, then launches the canonical path and reads the target version. | passed |
| Only backup deletion may be deferred | The verified result has `cleanupPending`; replacement and verification never depend on the cleanup helper. | passed |
| Swap or verification failure rolls back | Canonical mismatch restores and verifies the prior executable; failed artifacts are preserved. | passed |
| Locked file or denied sharing fails without false success | A real Windows `FileStream` denying delete sharing causes `UPGRADE_RENAME_CURRENT_FAILED`, no rollback attempt, and leaves the old version active. | passed |
| Plan and phases are flushed in order | Delayed-body subprocess sees plan and `Downloading...` before the body; replacement and verification follow in order. | passed |
| Complete release catalog | Pagination is exhausted, SemVer-sorted newest first, and retains channels, dates, current/latest markers, malformed-tag warnings, and compatible-asset status. | passed |
| Structured output matches human state | JSON regressions assert plan, ordered events, recovery, exact errors, and one parseable document. | passed |
| Published binary upgrades a known older installation | Requires the new GitHub Release and protected production workflow. | pending |

## Issue 10 Acceptance

| Criterion | Evidence | Status |
| --- | --- | --- |
| Exact-version recovery after success | Delayed successful upgrade prints the pinned target installer command. | passed |
| Recovery after failure | Invalid download produces both structured recovery and the visible pinned install/process-stop block. | passed |
| Recovery when already current | Text and JSON output pin the installed exact version and include the stop command. | passed |
| Stable and prerelease targets | Recovery generation covers both; the printed prerelease command is executed against an isolated installer fixture. | passed |
| Installer exact-version contract | PowerShell and POSIX installers resolve the canonical tag/asset, verify temporary and installed versions, and roll back on mismatch or timeout. | passed |
| Agent asset safety | Installers require the exact `.md` assets and reject empty, PE/NUL/binary, invalid-text, or wrong-frontmatter content before agent writes. | passed |
| Published recovery command installs the released target | Requires the new public release assets. | pending |

## Verification

- `bun run typecheck`: passed.
- `bun test --timeout 15000`: 43 tests, 0 failures, 241 assertions.
- `bun run build`: 12 native binaries and 14 total assets.
- CI run
  [29668516605](https://github.com/CGuiho/mirror/actions/runs/29668516605):
  both `test` and `windows-self-upgrade` passed.

## Closure Gate

After the patch release is public:

1. upgrade an isolated known-older Windows canonical installation;
2. launch the canonical path again and confirm the new exact version;
3. confirm `upgrade list` contains the release with correct metadata;
4. execute the printed exact-version recovery command in an isolated directory;
5. add factual evidence to each issue and close it only if all checks pass.
