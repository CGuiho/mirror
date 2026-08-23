---
name: Windows Upgrade Bridge and Stable Launcher Implementation Review
purpose: Review the upgrade repair against the observed v4.2.4 rollback and accepted stable-launcher architecture.
description: Reviews bridge isolation, pointer safety, immutable activation, recovery output, installer migration, and residual transition risk.
created: 2026-08-23
owner: mirror-docs-reviews-implementation
flags: [implementation-review, independent-review-pending]
tags: [mirror, upgrade, launcher, windows]
keywords: [v4.2.4 verifier, current.json, synchronous upgrade, recovery command]
---

# Windows Upgrade Bridge and Stable Launcher Implementation Review

## Verdict

Ready for independent PR review. The implementation corrects the demonstrated
root cause and replaces ordinary stable-layout live replacement with synchronous
pointer activation. No production installation, tag, or release was mutated.

## Reviewed Contract

- The v4.2.4 helper expects `mirror v<target>` and rolls back a raw-SemVer
  candidate after the parent has already returned.
- Ordinary `--version` must remain raw SemVer.
- The shared-bin process must be stable and delegate to an immutable active
  payload with exact streams, arguments, and exit code.
- Upgrade success requires candidate checksum, raw version, self-test,
  activation, launcher version, and launcher self-test verification.
- Failure after pointer activation restores the previous pointer.
- Human upgrade output begins and ends with one complete platform installer
  command; unresolved default selection must not pin the current version.

## Findings

### Accepted

1. `pkg/launcher` strictly decodes the pointer, rejects unknown fields,
   absolute paths, traversal, and paths outside `versions/`, and hashes the
   selected payload before start.
2. The canonical binary bootstraps itself into an immutable payload only when
   `current.json` is absent. Invalid existing state fails closed.
3. Launcher fallback occurs only when the active payload cannot be verified or
   started, never after an application process starts and exits nonzero.
4. `pkg/updater` verifies the staged candidate before installation, atomically
   activates the immutable target, verifies through the launcher, and restores
   the previous state on version or self-test failure.
5. Windows bridge behavior requires both a `.mirror-upgrade-helper-*.exe`
   parent and an adjacent `.old` executable whose own version output is
   decorated. v4.2.5 helpers, ordinary shells, and normal launcher calls retain
   raw output.
6. A direct legacy Windows transition is no longer reported as success. The
   command returns an installation failure with the full recovery command while
   allowing the compatibility helper to finish after process exit.
7. Installer scripts create the version payload, launcher, and pointer and
   verify through the launcher before deleting backups.

### Residual Risk

- The first transition from a locked direct Windows executable is inherently
  asynchronous because the already-running old binary must exit. The bridge
  makes it compatible and prevents false success; external installer-driven
  repair remains the deterministic synchronous migration path.
- Complete `artifacts.json` ownership and full agent/schema transaction work
  from C0001-04 through C0001-08 remains outside this emergency slice.
- Independent agent 0049 review and hosted CI are required before integration.
