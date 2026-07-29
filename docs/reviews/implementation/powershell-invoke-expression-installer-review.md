---
name: PowerShell Invoke-Expression Installer Implementation Review
purpose: Review the issue 19 fix against the standalone Windows installer and delivery contracts.
description: Local review of null-boundary validation, stage-aware failures, rollback preservation, and Invoke-Expression coverage.
created: 2026-07-28
owner: mirror-docs-reviews-implementation
flags: [accepted-local]
tags: [mirror, review, windows]
keywords: [Invoke-Expression, null safety, installer stages, rollback]
---

# PowerShell Invoke-Expression Installer Implementation Review

## Verdict

Accepted for pull-request handoff. No blocking local finding remains. Hosted
Windows CI is still required before merge, and release publication is outside
this task.

## Scope reviewed

- [Task specification](../../todo/powershell-invoke-expression-installer.md)
- [GitHub issue #19](https://github.com/CGuiho/mirror/issues/19)
- `devops/install.ps1`
- `devops/build-binaries_test.go`
- `.github/workflows/ci.yml`
- affected XDocs descriptors and validation evidence

## Findings

### Closed

- Nullable environment, architecture, release, checksum, prompt, and command
  output values are converted and validated before instance string methods
  execute.
- The public installer records the active stage and wraps unhandled failures
  with that stage, replacing anonymous `InvokeMethodOnNull` handoff.
- The existing binary verification, rollback, and temporary cleanup boundaries
  remain in place.
- A controlled blank architecture fails before target creation and reports
  `architecture detection`.
- Windows CI now pipes the complete installer source through
  `Invoke-Expression`, installs twice from verified offline assets, and checks
  idempotent skill and instruction outcomes.
- The first success-path run caught and led to removal of an ambiguous
  cast-around-`if` construct before delivery.

### Residual

- The original report does not include the affected PowerShell version or the
  exact nullable value. An isolated Windows PowerShell 5.1 run against public
  v4.0.0 succeeds, so the original environment remains unreproduced.
- Hosted Windows CI must confirm the workflow syntax and runner behavior.
- XDocs v0.9.0 rejects pre-existing path-shaped `scan.exclude` entries before
  metadata validation. This installer PR does not mix in that unrelated
  configuration repair.

## Release boundary

A compatible patch release is appropriate after review and merge, but no
version application, tag, release, or publication is authorized in this pull
request task.
