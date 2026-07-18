---
name: Mirror Upgrade Reliability Validation
purpose: Record reproducible verification evidence and remaining release gates for issues 9 and 10.
description: Tracks typecheck, Bun suites, real native replacement and rollback, installer syntax/subprocess checks, builds, and XDocs health.
created: 2026-07-15
flags:
  - testing
tags:
  - validation
  - cli
  - reliability
keywords:
  - mirror upgrade
  - native replacement
  - rollback
  - installer tests
  - xdocs doctor
owner: mirror-docs-validation
---

# Mirror Upgrade Reliability Validation

## Validated

| Gate | Result | Evidence |
| --- | --- | --- |
| TypeScript | passed | `bun run typecheck` completed without diagnostics after the core implementation. |
| Existing + core Bun suites | passed | 75 tests, 0 failures, 382 expectations across `guiho-mirror.spec.ts` and `self-management.spec.ts`. |
| Native canonical replacement | passed | A compiled target replaced the canonical fixture and a fresh `--version` reported the target before cache commit. |
| Native rollback | passed | A canonical-version mismatch restored the previous fixture and verified its original version. |
| Installer syntax | passed | Both PowerShell scripts parsed without errors; both POSIX scripts passed `bash -n`. |
| Review-fix typecheck | passed | Local `node_modules/.bin/tsc.exe -p . --noEmit` completed without diagnostics after JSON, timeout, catalog, installer, and test changes. |
| Review-fix installer syntax | passed | Canonical `mirror/install.ps1` passed the PowerShell parser and `mirror/install.sh` passed Git Bash `bash -n` after bounded verification and strict SemVer changes. |
| Final-review static gates | passed | TypeScript, PowerShell parser, Git Bash syntax, `git diff --check`, strict source metadata, and XDocs tree passed after rollback-safe POSIX verification, canonical tag matching, and explicit HTTP fixture isolation. |
| Plan/docs metadata | passed | Focused strict metadata and tree checks passed for the implementation plan, review, and TODO spec before implementation. |

## Pending Final Rerun

- `bun test source/self-management.spec.ts source/installer.spec.ts source/guiho-mirror.spec.ts` after adding Windows `Unblock-File` and the independent-review regressions (including actual printed recovery-command execution, PowerShell/POSIX 404 fallback, post-mutation timeout rollback, preserved artifacts, and rollback fields in JSON). The current sandbox returned `EPERM` while reading all three test files and `tsconfig.json`, before any test or assertion ran.
- `bun run typecheck` and full `bun test` after installer/CI/docs changes.
- `bun run build` and `bun run binary` (the single binary script emits the configured matrix; no separate `binaries` script exists).
- `xdocs meta . --documents --strict --format json`, `xdocs doctor --warnings-as-errors`, and `xdocs tree`.
- `git diff --check` and final scoped status.

The task remains `testing`; no version, tag, publication, push, or issue closure is claimed.

## References

- [Implementation note](../todo/upgrade-reliability-implementation.md)
- [Implementation plan](../plans/upgrade-reliability-implementation.md)
- [Approved design](../superpowers/specs/2026-07-15-upgrade-reliability-design.md)
