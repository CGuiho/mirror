---
name: Mirror RFC 0034 CLI Compliance Validation
purpose: Record evidence for the RFC 0034 completion and release-readiness gates.
description: Records typecheck, tests, CLI contract, distribution, xdocs, and release-readiness evidence.
created: 2026-07-18
owner: mirror-docs-validation
flags:
  - validated
  - final
tags:
  - validation
  - cli
  - rfc-0034
keywords:
  - Mirror CLI
  - release readiness
  - fourteen assets
---

# Mirror RFC 0034 CLI Compliance Validation

## Summary

The complete MR-16 gate passed. Mirror `3.5.1` is the final separately
authorized patch after correcting version-sensitive release assertions.

## Scope

TypeScript, tests, startup/help/config/agent/upgrade behavior, installers, Node
bootstrap, native builds, exact release assets, prohibited imports, xdocs, and
Git hygiene.

## Commands Run

| Check | Result |
| --- | --- |
| `bun run typecheck` | Passed |
| RFC CLI suite | Passed: 16 tests |
| Installer and self-upgrade suites | Passed: 20 tests |
| Full `bun test --timeout 15000` | Passed: 37 tests, 0 failures, 208 assertions |
| `bun run build` | Passed: local executable, 12 native binaries, 14 total release assets |
| `bun run binary` | Passed separately with the same exact matrix |
| Compiled native smoke | Passed: exact version, no-argument banner, prompt listing, and Unicode tree |
| Node-only packed bootstrap | Passed from a real `bun pm pack` tarball with Bun absent from `PATH` |
| Test-isolation assertion | Passed: `mirror/undefined` was not recreated after the complete suite |
| Strict xdocs changed scopes | Passed with zero errors and zero warnings |
| `xdocs tree` | Passed |
| `git diff --check` | Passed |

## Manual Checks

- The exact final Citty catalog is present.
- Only `-h` and root `-v` are short aliases.
- Core source contains no banned Node imports.
- The native matrix declares 12 unique RFC filenames and two agent artifacts.
- Downstream TOML consumers are recorded separately and were not edited.
- `mirror version plan minor --format json` resolved `3.5.0-alpha.0` to
  `3.5.0`; the post-version assertion correction is finalized by the
  Mirror-managed `3.5.1` patch.
- Subprocess-level live smokes prove that latest and exact-current upgrade
  dry-runs produce JSON envelopes, nested `upgrade --version` is not intercepted
  by the root version flag, cached notices precede the no-argument banner, and
  prompt name mode prints only `guiho-i-mirror`.

## XDocs Baseline Note

Strict metadata validation passed for every changed source, script, schema,
prompt, skill, TODO, review, and validation scope. The broader `mirror/`
metadata scan still reports the pre-existing legal file `mirror/LICENSE.md`
because it intentionally has no YAML frontmatter; the legal text was not
modified for this CLI migration.

## Readiness

Validated. The user separately authorized versioning and Git ref pushes.
Package publication and manual GitHub release creation remain outside this
implementation task.
