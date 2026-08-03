---
name: PowerShell Invoke-Expression Installer Implementation Review
purpose: Review the issue 19 fix against the standalone Windows installer and delivery contracts.
description: Local review of null-boundary validation, stage-aware failures, rollback preservation, and Invoke-Expression coverage.
created: 2026-07-28
updated: 2026-08-03
owner: mirror-docs-reviews-implementation
flags: [accepted-release]
tags: [mirror, review, windows]
keywords: [Invoke-Expression, null safety, installer stages, rollback]
---

# PowerShell Invoke-Expression Installer Implementation Review

## Verdict

Accepted for release. No blocking implementation finding remains. Pull request
#20 and merged-main CI both passed before this compatible fix was selected for
the authorized 4.0.1 patch release.

## Scope reviewed

- [Task specification](../../todo/powershell-invoke-expression-installer.md)
- [GitHub issue #19](https://github.com/CGuiho/mirror/issues/19)
- `devops/install.ps1`
- `devops/build-binaries_test.go`
- `.github/workflows/ci.yml`
- affected XDocs descriptors and validation evidence

## Findings

### Follow-up accepted

- The 2026-07-30 reproduction identifies the remaining defect: the merged
  detector had only one production architecture source after a blank test
  override and treated whitespace as a deliberate failure.
- The follow-up ignores blank candidates and preserves explicit test overrides
  only when nonblank.
- Runtime OS architecture remains preferred. WOW64 native architecture,
  process architecture, and machine architecture provide ordered fallbacks for
  Windows PowerShell hosts where runtime architecture is unavailable.
- AMD64 and ARM64 processor fallback tests pass in Windows PowerShell.
- Unsupported architecture still fails at `architecture detection` before any
  install target is created.

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
- XDocs v0.9.0 rejected pre-existing path-shaped `scan.exclude` entries during
  PR validation. The installed v0.7.2 CLI passes strict metadata, tree, and
  doctor during release preparation; cross-version configuration compatibility
  remains separate from this installer review.

## Release boundary

The pull-request task did not authorize publication. The subsequent release
audit separately authorized a compatible 4.0.1 patch release after live
evidence proved the merge was outside the 4.0.0 tag.
