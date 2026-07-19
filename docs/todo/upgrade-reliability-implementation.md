---
name: Mirror Upgrade Reliability Implementation
purpose: Preserve implementation decisions, progress, verification evidence, and handoff context for issues 9 and 10.
description: Records the transactional upgrade, complete catalog, recovery, installer, CI, documentation, and validation work performed from the approved plan.
created: 2026-07-15
flags:
  - testing
tags:
  - implementation
  - cli
  - reliability
keywords:
  - mirror upgrade
  - Windows replacement
  - recovery command
  - installer validation
owner: mirror-docs-todo
---

# Mirror Upgrade Reliability Implementation

## Summary

The implementation replaces scheduled Windows upgrade success with a verified rename-and-swap transaction, resolves and prints the upgrade plan before download, emits ordered phases, returns typed JSON envelopes, provides exact-version recovery after every bare attempt, and expands `upgrade list` into a complete paginated SemVer catalog.

Canonical PowerShell/POSIX installers now validate exact versions, replace through same-directory backups, verify the canonical destination, and roll back. `devops/install.*` are thin checkout delegates. Windows CI executes real native replacement, running-image cleanup, rollback, locked-share denial, and installer tests.

## Links

- [Task specification](./upgrade-reliability.md)
- [Approved design](../superpowers/specs/2026-07-15-upgrade-reliability-design.md)
- [Implementation plan](../plans/upgrade-reliability-implementation.md)
- [Plan review](../reviews/plans/upgrade-reliability-implementation-review.md)
- [Validation report](../validation/upgrade-reliability.md)

## Decisions Preserved

- Citty remains the only ordinary parser/router.
- `semver` owns validation, comparison, sorting, and prerelease classification.
- Release metadata selects an existing compatible asset before the body download.
- Only deletion of a noncanonical verified backup may be deferred.
- Cache writes occur atomically after canonical version verification.
- Resolution failure recovery pins the installed current version and labels it `fallback-current`.
- Canonical installers own installation behavior; devops scripts only delegate.

## Progress

- Completed plan/review/TODO/XDocs setup in commit `0a44279`.
- Completed typed contracts, release catalog, Citty progress/JSON/recovery, transactional replacement, rollback, and core native tests in commit `b436537`.
- Implemented canonical installers, installer subprocess tests, running-Windows-executable and locked-share regressions, Windows CI, help, docs, README, changelog, and bundled skill updates. Independent review added bounded probes, strict public JSON, canonical tag matching, HTTPS-only production downloads, rollback-safe POSIX control flow, expanded recovery/rollback fixtures, exact `.md` agent asset validation, and every-outcome recovery assertions.

## Verification Evidence

- `bun run typecheck`: passed at final source review.
- `bun test --timeout 15000`: 43 tests, 0 failed, 241 assertions.
- `bun run build`: passed with 12 native and 14 total release assets.
- PowerShell parser checks for canonical/devops scripts: passed.
- `bash -n mirror/install.sh` and `bash -n devops/install.sh`: passed.
- CI run [29668516605](https://github.com/CGuiho/mirror/actions/runs/29668516605): Linux/full-build and `windows-self-upgrade` jobs passed.
- The final review is [upgrade-reliability-final-review.md](../reviews/implementation/upgrade-reliability-final-review.md).

## Handoff

Keep the task in `testing` until the new release is public and the approved live older-to-newer upgrade plus printed recovery-command checks pass. Do not close issues #9 or #10 from source/CI evidence alone.
