---
name: Mirror RFC 0034 CLI Compliance Validation
purpose: Record evidence for the RFC 0034 completion and release-readiness gates.
description: Records typecheck, tests, CLI contract, distribution, xdocs, and release-readiness evidence.
created: 2026-07-18
owner: mirror-docs-validation
flags:
  - validated
  - final
  - external-release-pending
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

The complete local MR-16 gate passed for `3.5.2`, but its publish workflow later
failed in the exact-asset verifier because `gh release view --jq` was passed
two arguments (`-r` and the filter). The correction uses the supported single
filter form, exact `.md` agent filenames, one authoritative fourteen-name
manifest, explicit uniqueness/no-extra checks, exact-version changelog release
notes, and installer Markdown validation. A new tag run is required to prove
the corrected public release path; the protected `production` environment
remains an external gate.

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
| Corrected release workflow full package gate | Passed: typecheck, 42 tests, 0 failures, 216 assertions, and exact 12-native/14-total build |
| Exact changelog-section extraction | Passed: exact/prefix/final/prerelease/missing/duplicate boundaries |
| Agent Markdown payload validation | Passed: PE/NUL payload rejected before skill/instruction writes |

## Public Release Gate

Public release availability was checked independently after the local gate:

| Check | Result |
| --- | --- |
| Local `main`, `origin/main`, and `@guiho/mirror@3.5.2` tag immediately after version apply | Passed: all resolved to `9132782d84de12416c3c605243800df16f68052b` |
| GitHub publish workflow for `@guiho/mirror@3.5.2` | Failed: run [29663073275](https://github.com/CGuiho/mirror/actions/runs/29663073275), job `88128892604`, exposed the invalid two-argument `gh --jq` call after the environment gate |
| Latest public GitHub Release | `@guiho/mirror@3.4.2`, with the legacy twelve binary assets |
| Live `mirror upgrade --dry-run --format json` | Correctly routes to upgrade resolution, then reports `UPGRADE_ASSET_UNAVAILABLE` because public `3.4.2` has no RFC-named compatible asset |
| Live `mirror upgrade --version 3.5.2 --dry-run --format json` | Correctly preserves the nested exact-version value, then reports `UPGRADE_RESOLUTION_FAILED` with GitHub `404 Not Found` because no public `3.5.2` release exists |

These are external publication results, not source-test failures. They prevent
calling `3.5.2` publicly installable or upgradeable until the environment gate
is approved and the exact fourteen assets are present.

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

Strict metadata validation passed for the changed `docs/todo`,
`docs/reviews/implementation`, and `docs/validation` scopes. The repository-wide
`xdocs doctor --format json` result remains valid with zero errors and eight
warnings: the root agent, changelog, TODO, two older design documents, and legal
file do not have companion frontmatter, while two generated overview documents
use non-date `created` values. These warnings predate this correction and do not
break descriptor or tree integrity; they are reported here rather than
misrepresented as a warning-free whole-repository check.

## Readiness

Validated for source compliance; the corrected release workflow is locally
ready for a new tag run. Public distribution and the live published-binary
checks required to close issues #9 and #10 are not yet complete. Package
publication and production-environment approval remain outside this task.
