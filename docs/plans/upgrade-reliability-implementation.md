---
name: Mirror Upgrade Reliability Implementation Plan
purpose: Sequence the implementation of GitHub issues 9 and 10 without changing the approved upgrade architecture.
description: Executable work units for typed upgrade contracts, release discovery, transactional replacement, recovery commands, installer hardening, tests, documentation, and validation.
created: 2026-07-15
flags:
  - approved
  - implementation-ready
tags:
  - planning
  - cli
  - reliability
keywords:
  - mirror upgrade
  - upgrade list
  - Windows replacement
  - recovery command
  - GitHub issue 9
  - GitHub issue 10
owner: mirror-docs-plans
---

# Mirror Upgrade Reliability Implementation Plan

## Source Contract

This plan executes the approved [upgrade reliability design](../superpowers/specs/2026-07-15-upgrade-reliability-design.md) for Mirror issues [#9](https://github.com/CGuiho/mirror/issues/9) and [#10](https://github.com/CGuiho/mirror/issues/10). It preserves Citty as the only CLI router, Bun as the runtime/toolchain, and `semver` as the semantic-version implementation.

The work stays on `codex/upgrade-reliability`, preserves the existing local Citty migration and `3.5.0-alpha.0` history, and does not bump, tag, publish, push, or close issues.

## Unit M1 - Typed Upgrade and Catalog Contracts

- Goal: define the shared plan, event, recovery, result, catalog, warning, and failure contracts required by both text and JSON presentation.
- Owner: Mirror package (`mirror/source/types.ts`).
- Dependencies: approved design only.
- Expected files: `mirror/source/types.ts`, `mirror/source/source.xdocs.md`, colocated tests.
- Data impact: no persisted schema changes; update-cache writes remain backward compatible.
- Auth/permission impact: none.
- Cache impact: establish result fields that distinguish verified installation from cache/cleanup warnings.
- Docs/XDocs impact: document public type responsibilities in the source descriptor.
- Checks: `bun run typecheck`; focused Bun tests.
- Acceptance: outcomes, phase status, recovery source, release records, catalog envelope, and stable failure codes are explicit and cannot represent scheduled replacement success.
- Stop condition: if the approved contract cannot describe an observed failure without ad hoc fields, revise this plan before proceeding.

## Unit M2 - Release Resolution and Complete Catalog

- Goal: share GitHub release normalization and asset selection between planning and `upgrade list`, exhaust pagination, and use `semver.rcompare`.
- Owner: `mirror/source/self-management.ts`.
- Dependencies: M1.
- Expected files: `mirror/source/self-management.ts`, `mirror/source/self-management.spec.ts`, `mirror/source/source.xdocs.md`.
- Data impact: catalog JSON schema version 1 only.
- Auth/permission impact: anonymous GitHub API access with existing user agent; no token requirement.
- Cache impact: no catalog cache mutation.
- Docs/XDocs impact: source descriptor and later user docs.
- Checks: fixture responses for multiple pages, drafts, malformed tags, prereleases, missing compatible assets, and later-page failure.
- Acceptance: every successfully retrieved page is represented; results are newest SemVer first; current/latest-stable/channel/date/URL/compatibility/asset fields are correct; incomplete pagination fails rather than claiming completeness.
- Stop condition: do not infer completeness from a partial response without a terminal pagination signal.

## Unit M3 - Observable Upgrade Planning and Recovery

- Goal: split resolution from execution so the CLI can print the heading immediately and the resolved plan plus `Downloading...` before waiting for the asset body.
- Owner: `mirror/source/self-management.ts`, `mirror/source/cli.ts`.
- Dependencies: M1-M2.
- Expected files: domain, CLI, types, focused tests.
- Data impact: JSON returns one final document containing plan, ordered events, result, recovery, warnings, and error when applicable.
- Auth/permission impact: none beyond release/download network access.
- Cache impact: no successful update cache before canonical verification.
- Docs/XDocs impact: source descriptor and help metadata.
- Checks: delayed-body local fixture; JSON parse tests; success/failure/up-to-date/dry-run recovery tests.
- Acceptance: text output is flushed in plan/download/validate/replace/verify order; JSON stdout contains no progress prose; every bare upgrade outcome includes the exact-version installer command and a separate safe process-stop command.
- Stop condition: if target resolution fails, recovery pins the installed current version and is labeled `fallback-current`; never invent a target.

## Unit M4 - Verified Transactional Replacement

- Goal: validate the temporary executable, rename the canonical binary to a same-directory backup, install the temporary binary at the canonical path, launch that exact path with `--version`, and roll back on failure.
- Owner: `mirror/source/self-management.ts`, with narrow checked-process support in `mirror/source/runtime.ts` only if reusable.
- Dependencies: M1-M3.
- Expected files: domain, runtime if needed, colocated tests.
- Data impact: atomic update-cache commit after canonical verification only.
- Auth/permission impact: filesystem rename/write/execute permissions at the installed path.
- Cache impact: verified target state is committed atomically; cache/cleanup failures are warnings after a valid installation.
- Docs/XDocs impact: source descriptor.
- Checks: success, rename failure, install failure, version mismatch, successful rollback, rollback failure, cache failure, cleanup deferral, and real Windows canonical-path subprocess behavior.
- Acceptance: success is impossible until a fresh canonical process reports the target; the previous binary is restored and verified after mutation failures; only old-backup deletion may be deferred.
- Stop condition: preserve the only known-good artifact on rollback failure and return a distinct nonzero failure.

## Unit M5 - Citty Presentation and `upgrade list`

- Goal: render human progress and the complete release table while retaining Citty routing and separating global `--version` from scoped `upgrade --version`.
- Owner: `mirror/source/cli.ts`, `mirror/source/help.ts` if help metadata requires it.
- Dependencies: M1-M4.
- Expected files: CLI/help, existing CLI spec and focused self-management spec.
- Data impact: text and JSON share domain envelopes.
- Auth/permission impact: none.
- Cache impact: presentation does not mutate cache.
- Docs/XDocs impact: source descriptor.
- Checks: command routing, `-v`/`--version`, `upgrade --version`, ordered text, aligned table, empty catalog, verbose asset, JSON success/error.
- Acceptance: list contains all releases newest first and clearly labels stable, alpha, beta, rc, current, latest stable, date, URL/asset availability as specified.
- Stop condition: do not add a handwritten token parser or alternate execution router.

## Unit M6 - Canonical Installer Hardening

- Goal: make `mirror/install.ps1` and `mirror/install.sh` exact-version, transactional, verified installers and reduce `devops/install.*` to thin checkout delegates.
- Owner: package installers and root devops wrappers.
- Dependencies: M2 shared naming contract and M4 transaction invariants.
- Expected files: `mirror/install.ps1`, `mirror/install.sh`, `devops/install.ps1`, `devops/install.sh`, installer tests/smoke harness, package/devops descriptors.
- Data impact: none.
- Auth/permission impact: destination directory write/execute and PATH updates; no privilege escalation.
- Cache impact: none.
- Docs/XDocs impact: package/devops descriptors and user docs.
- Checks: exact stable/prerelease normalization; selected plan printed before download; HTTP-only candidate fallback; native format and temporary/canonical version checks; rollback on mismatch; copy-paste recovery command smoke.
- Acceptance: filesystem and verification failures are never mislabeled as unavailable assets; `Installed` appears only after canonical verification; wrappers carry no independent asset/replacement algorithm.
- Stop condition: reject unvalidated version interpolation or any replacement path that can destroy the only previous executable.

## Unit M7 - Windows CI and Regression Coverage

- Goal: prove the Windows rename-and-swap contract using native fixture executables while retaining the existing Linux release gate.
- Owner: `.github/workflows/ci.yml` and package tests.
- Dependencies: M1-M6.
- Expected files: CI workflow and colocated/fixture tests.
- Data impact: none.
- Auth/permission impact: standard GitHub Actions permissions only.
- Cache impact: test-isolated directories.
- Docs/XDocs impact: root/source descriptors only when significant files change.
- Checks: `windows-latest` builds old and target fixtures, runs old from canonical path, upgrades from a local release fixture, then launches canonical path and observes target; also exercises rollback and cleanup boundaries.
- Acceptance: the CI job fails on a downloaded-but-not-replaced binary and on false success before fresh canonical verification.
- Stop condition: mock-only Windows coverage is not sufficient.

## Unit M8 - Documentation, TODO, and Validation

- Goal: make shipped docs/help/skills match behavior and record validation evidence.
- Owner: root/package docs and XDocs tree.
- Dependencies: M1-M7 complete.
- Expected files: `mirror/DOCS.md`, root/package `README.md`, bundled skill, `todo.md`, task spec/implementation note, `docs/validation/upgrade-reliability.md`, affected descriptors.
- Data impact: none.
- Auth/permission impact: none.
- Cache impact: document actual semantics only.
- Docs/XDocs impact: full behavior, recovery, catalog schema, installers, and operational guarantees.
- Checks: `xdocs meta . --documents --strict --format json`, `xdocs doctor --warnings-as-errors`, `xdocs tree`.
- Acceptance: docs contain no scheduled-replacement success claim; issue links and validation evidence are durable; TODO moves to completed only after all local gates pass.
- Stop condition: keep TODO in `testing` and record exact blockers if any required local gate cannot run.

## Validation Gate

Run from `mirror/` unless noted:

1. `bun run typecheck`
2. `bun test`
3. `bun run build`
4. `bun run binary`
5. `bun run binaries` only if present; otherwise record that the single build script already emits the configured matrix.
6. Focused PowerShell and POSIX installer/recovery smoke checks in isolated directories.
7. From the repository root: `xdocs meta . --documents --strict --format json`, `xdocs doctor --warnings-as-errors`, and `xdocs tree`.
8. Inspect `git diff --check` and final scoped status.

No version apply, tag, publication, push, issue closure, or live installation into the user's real binary path is part of this plan.

## First Executable Unit

Begin with M1, then M2. The type contracts are the dependency boundary for the catalog, transactional executor, CLI, installers, and tests.

## References

- [Approved design](../superpowers/specs/2026-07-15-upgrade-reliability-design.md)
- [Task specification](../todo/upgrade-reliability.md)
- [Plan review](../reviews/plans/upgrade-reliability-implementation-review.md)
- [Mirror TODO](../../todo.md)
