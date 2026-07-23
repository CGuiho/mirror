---
name: Mirror 3.6.0 Schema And YAML Validation
purpose: Record reproducible verification evidence for issues 14 and 15.
description: Commands, results, blocked checks, and release readiness for the Mirror 3.6.0 delivery.
created: 2026-07-22
owner: mirror-docs-validation
flags:
  - validated
tags:
  - mirror
  - validation
keywords:
  - issue 14
  - issue 15
  - Mirror 3.6.0
---

# Mirror 3.6.0 Schema And YAML Validation

## Current Results

| Check | Result |
| --- | --- |
| `bun run typecheck` | Passed. |
| Focused CLI and self-management tests | Passed: 34 tests, 0 failures. |
| `bun test` | Passed: 52 tests, 0 failures. |
| `bun run build` | Passed: 12 native binaries and 14 total release assets verified. |
| Native Windows schema save | Passed with an isolated home; valid `schema.json` created. |
| Native Windows welcome | Passed; deterministic product/platform/version output. |
| Packaged-schema equivalence | Passed in the CLI test suite against the TypeBox renderer. |
| XDocs strict metadata/tree/doctor | Passed: 10 docs descriptors, source descriptor, 0 doctor errors/warnings. |
| Obsolete configuration filename scan | Passed: zero matches after migration. |
| Publish workflow | Passed: [run 29968065755](https://github.com/CGuiho/mirror/actions/runs/29968065755). |
| Public Linux installer | Passed in the publish workflow against `3.6.1`. |
| Public Windows installer | Passed with Mirror `3.6.1`, global schema, and both skill targets verified. |
| Public release | Passed: exactly 14 assets and only the `3.6.1` changelog section in release notes. |
| GitHub issues | Issues 14 and 15 received evidence comments and are closed. |

The `3.6.0` publish workflow failed before asset publication because the
package POSIX installer referenced a function-local variable after its scope.
The correction uses `${install_dir}/mirror` and will ship as `3.6.1` without
rewriting the failed tag.

## Blocked Change

Removing `environment: production` from
`.github/workflows/publish.yml` was rejected because it persistently weakens the
authorization boundary for every future release. The gate remains unchanged;
no indirect bypass was attempted.

## Readiness

Mirror `3.6.1` is publicly accepted and the two issues are complete. The
protected production environment remains enabled; this release received a
one-time deployment approval.
