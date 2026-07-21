---
name: Mirror Background Update Worker CPU Safety Validation
purpose: Record verification evidence for Mirror's bounded background update worker.
description: Tracks concurrency, process-count, timeout, stale-lock, foreground-isolation, repository, CI, and release evidence.
created: 2026-07-21
owner: mirror-docs-validation
flags:
  - completed
tags:
  - mirror
  - validation
  - reliability
keywords:
  - CPU usage
  - worker process
  - lock coalescing
  - stale lease
---

# Mirror Background Update Worker CPU Safety Validation

## Scope

- [Task specification](../todo/background-update-worker-cpu-safety.md)
- Cross-repository incident reference: [XDocs issue #14](https://github.com/CGuiho/xdocs/issues/14)

## Implementation Evidence

- `source/self-management.ts` acquires an atomic `.update-check.lock` before
  spawning and passes its UUID lease token to the hidden worker.
- Lease state is TypeBox-decoded and records the token, owner PID, and creation
  time.
- A separate reclaim lock serializes stale recovery; both locks recover after
  the 30-second stale interval.
- Release checks the current stored token before every bounded removal attempt,
  so a resumed old owner cannot remove a newer lease.
- The worker aborts and rejects the entire network check after 15 seconds,
  releases its lease in `finally`, and does not enter ordinary command routing.
- The scheduler catches cache, source-checkout, lock, spawn, and cleanup errors
  and returns without changing foreground output or exit status.
- `source/runtime.ts` uses unique directory marker files, removing the shared
  `.keep` race found by the new concurrency tests.

## Verification

### Local

- `bun run typecheck`: passed.
- `bun test source/self-management.spec.ts`: passed, 16 tests and 67
  expectations.
- Real burst measurement: 32 concurrent foreground schedulers produced one
  compiled worker PID; that PID was present during its 750 ms task and absent
  after 1 second.
- Lock stress: 32 concurrent worker checks made one fetch; 32 concurrent stale
  reclaimers produced one replacement lease.
- Timeout regression: an abort-aware hanging fetch failed at the injected 25 ms
  bound and the next lease acquisition succeeded.
- `bun test`: passed, 50 tests and 265 expectations.
- `bun run build:native`: passed for all twelve native binaries and the exact
  fourteen RFC 0034 release assets.
- `xdocs meta docs/todo --strict`, `xdocs meta docs/validation --strict`, and
  `xdocs meta mirror/source --strict`: passed.
- `xdocs tree`: passed.
- `xdocs doctor`: valid with zero errors and seven pre-existing documentation
  warnings unrelated to this change.
- `mirror config check`: passed.
- `mirror version plan patch --format json`: selected `3.5.6` to `3.5.7` with
  tag `@guiho/mirror@3.5.7`.
- `git diff --check`: passed.

### Release Evidence

- `@guiho/mirror@3.5.7` Publish run `29864298845`: passed, including exact
  fourteen-asset verification.
- Main CI run `29864295877`: code, typecheck, tests, build, binary, and Windows
  installer/self-upgrade jobs passed; the public Linux installer step exposed
  a release-order race by receiving the previous `3.5.6` latest release before
  Publish completed.
- Corrective `3.5.8` moves the public Linux installer check after release
  creation in the Publish workflow.
- Corrected CI run `29864740860`: passed.
- Corrected Publish run `29864743740`: passed typecheck, full tests, build,
  exact fourteen-asset verification, and the post-publication Linux installer
  smoke test.
- Public Windows `3.5.8` baseline binary: reported exact version `3.5.8` and
  `Hello Windows - mirror v3.5.8`; a 32-command burst observed zero workers
  after the foreground commands and zero workers after 20 seconds.
- Cross-repository installer auditing then exposed a PowerShell UTF-8 managed
  marker defect. Corrective `3.5.9` uses strict UTF-8 without a BOM, repairs the
  legacy mojibaked marker, honors environment home overrides, and adds a
  twice-run Restricted-policy idempotence regression.

### Completed Release Gates

- Mirror `3.5.9` commit/tag `e7af65e`: pushed to `main` and origin.
- CI run `29865566934`: passed Linux typecheck, full tests, build, binary checks,
  and Windows typecheck, replacement, and installer tests.
- Publish run `29865570846`: passed typecheck, full tests, build, exact
  fourteen-asset verification, and public Linux installer verification.
- Public release: exact fourteen assets, including `guiho-s-mirror.md` and
  `guiho-i-mirror.md`; release body equals only the `3.5.9` changelog section.
- Public Windows installer: two consecutive `irm .../devops/install.ps1 | iex`
  runs installed and verified `3.5.9`, preserved `Café — Existing`, produced
  exactly one correct managed block, emitted no BOM or mojibake, and installed
  both skill copies under the isolated test home.

## Readiness

The bounded background worker, release ordering, exact release catalog, public
installers, UTF-8 managed-block reconciliation, and public native binary are
verified locally, in CI, and from the published `3.5.9` release.
