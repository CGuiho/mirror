---
name: Windows Upgrade Bridge and Stable Launcher
purpose: Eliminate the v4.2.4 to v4.2.5 verification rollback and replace live self-overwrite with synchronous immutable-payload activation.
description: Tracks the legacy verifier bridge, stable launcher, current pointer, installer migration, recovery output, tests, and delivery evidence.
created: 2026-08-23
owner: mirror-docs-todo
flags: [in-progress, breaking-install-layout]
tags: [mirror, upgrade, windows, launcher]
keywords: [v4.2.4 bridge, raw semver, current.json, immutable payload, synchronous upgrade]
---

# Windows Upgrade Bridge and Stable Launcher

## Status

Testing (`2026-08-23`).

## Failure Being Corrected

The released v4.2.4 Windows helper requires candidate `--version` output
`mirror v<target>`. The released v4.2.5 candidate correctly emits raw
`<target>`. The helper therefore activates v4.2.5, rejects it, restores the
v4.2.4 `.old`, and does so after the parent has already reported `scheduled`
success. Version output also bypasses the completion journal.

## Executing Plan Unit

Emergency bridge implementation of accepted Convention 0001 units C0001-05
through C0001-07, limited to the minimum complete upgrade path:

1. one binary acts as stable launcher only at the canonical shared-bin path;
2. immutable payloads live under `~/.guiho/mirror/versions/<version>/`;
3. strictly decoded `current.json` selects active and previous payloads;
4. fresh/legacy canonical binaries bootstrap the immutable layout;
5. v4.2.4 helper verification receives decorated output only when the verified
   parent executable is `.mirror-upgrade-helper-*.exe` on Windows;
6. installed-layout upgrades verify a staged payload, install it immutably,
   atomically switch the pointer, verify through the launcher, and roll back the
   pointer synchronously on failure;
7. installers create/repair the launcher and immutable payload layout;
8. recovery output is platform-specific, first before network work, and final
   for every terminal outcome, exact-version pinned after resolution.

## Lifecycle Deviations

The repository previously shipped partial Convention 0001 changes out of unit
order. C0001-04 through C0001-06 are not fully integrated. The human explicitly
ordered immediate implementation after a production-visible v4.2.4 rollback.
This unit therefore implements the smallest accepted stable-launcher slice and
records remaining complete-manifest/agent-transaction work instead of retaining
the known-broken detached helper as normal upgrade authority.

Upstream brainstorm, requirements, and new architecture phases are waived:
the accepted Convention 0001 architecture and C0001-05 through C0001-07 plan
already define the required design.

## Acceptance

- Exact source-level regression proves the v4.2.4 decorated verifier mismatch.
- Canonical launcher forwards all arguments/streams and exact child exit code.
- Pointer parsing rejects unknown fields, absolute paths, traversal, and paths
  outside the versions root.
- Stable-layout upgrades never return `scheduled` and never replace the running
  payload or launcher.
- Activation verification failure restores the previous pointer.
- Windows bridge compatibility is isolated to the legacy helper parent and
  ordinary `-v/--version` remains raw SemVer.
- Windows and POSIX installers create the stable launcher, immutable payload,
  and pointer and verify through the launcher.
- Recovery output is the first and final human block using exactly one
  platform-specific complete README installer command.
- Go format, vet, tests, cross-builds, installer syntax, XDocs, and CI pass.

## Evidence

- Implementation review:
  [windows-upgrade-bridge-stable-launcher.md](../reviews/implementation/windows-upgrade-bridge-stable-launcher.md)
- Validation:
  [windows-upgrade-bridge-stable-launcher.md](../validation/windows-upgrade-bridge-stable-launcher.md)
- Exact released v4.2.4 helper bridge: passed on native Windows.
- Native 4.2.6 to 4.2.7 stable-layout synchronous transition: passed.
- Hosted CI and independent PR review: pending.

## Mirror Decision

Pending hosted validation and integration. This is a patch-compatible operational
repair, but release compatibility may require a bridge patch followed by a
normal patch. No tag or release is authorized by implementation alone.
