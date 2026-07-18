---
name: Mirror RFC 0034 CLI Compliance Implementation
purpose: Preserve the implementation history and release handoff for MR-01 through MR-16.
description: Records execution of MR-01 through MR-16 for the breaking Mirror CLI migration.
created: 2026-07-18
owner: mirror-docs-todo
flags: []
tags:
  - implementation
  - cli
  - rfc-0034
keywords:
  - mirror.yaml
  - TypeBox
  - agent namespace
  - fourteen assets
---

# Mirror RFC 0034 CLI Compliance Implementation

## Status

Completed. Source, tests, distribution, canonical docs, downstream inventory,
review, and the full MR-16 gate are complete. The authorized Mirror-managed
`3.5.2` correction patch aligns the durable status and release-gate evidence
and is the final Git implementation handoff, not an open implementation unit.
Public release publication remains a separate external gate.

## Public Release Gate

The implementation task is completed because its approved scope ends at
release readiness and explicitly excludes publication and live installation.
The public distribution state is not complete:

- GitHub Actions run
  [29663073275](https://github.com/CGuiho/mirror/actions/runs/29663073275)
  for `@guiho/mirror@3.5.2` is waiting on the protected `production`
  environment.
- The latest public GitHub Release remains `@guiho/mirror@3.4.2`.
- A live `mirror upgrade --dry-run --format json` resolves that public release
  and reports `UPGRADE_ASSET_UNAVAILABLE` because it predates the RFC asset
  names.
- A live `mirror upgrade --version 3.5.2 --dry-run --format json` reaches the
  exact-version route correctly and reports `UPGRADE_RESOLUTION_FAILED` with
  GitHub `404 Not Found` because the `3.5.2` GitHub Release does not yet exist.

Do not describe `3.5.2` as publicly installable or upgradeable until the
production-environment gate completes and the release exposes the exact
fourteen assets.

## Implemented Units

- MR-01: preserved the verified version transaction and inventoried downstream
  TOML consumers before changing self-hosting.
- MR-02: added TypeBox runtime schemas and derived decoding for configuration,
  cache, release payloads, agent resources, CLI values, and JSON envelopes.
- MR-03: replaced package self-hosting and discovery with `mirror.yaml` only.
- MR-04: retained Bun-only core modules and isolated Node use to the npm
  bootstrap.
- MR-05: normalized the final raw Citty tree and removed non-RFC aliases.
- MR-06: standardized `.guiho/mirror` storage, cached notice order, detached
  work, and exact no-argument output.
- MR-07: derived Unicode tree and Markdown help from Citty definitions with
  positive depth validation.
- MR-08: implemented the complete singular skill, instruction, and prompt
  namespace with both agent tools and exact instruction markers.
- MR-09: normalized usage/configuration exit categories and text/JSON streams.
- MR-10: added stable-default release listing, pagination, prereleases, exact
  variants, verified cache writes, and agent reconciliation.
- MR-11: upgraded both direct installers to visible progress, both skill
  destinations, prompt/instruction reconciliation, PATH, and verification.
- MR-12: replaced the Bun launcher with a thin Node ESM native bootstrap.
- MR-13: renamed the 12 native assets, added two agent assets, and made workflow
  verification assert the exact 14 names.
- MR-14: updated canonical docs, bundled skill, TypeBox-generated schema, TODO,
  and xdocs.
- MR-15: recorded the downstream consumer handoff without editing consumers.
- MR-16: added the RFC CLI suite and preserved transactional installer and
  upgrade regression suites; final evidence is in the validation report.

## Breaking Changes

There is no TOML fallback, plural agent namespace, `--tool`, positional agent
scope, implicit agent mutation, legacy dry-run aliases, old release naming, or
Bun-dependent public npm launcher.

## References

- [Plan](../plans/rfc-0034-cli-compliance-migration.md)
- [Task specification](./rfc-0034-cli-compliance-migration.md)
- [Implementation review](../reviews/implementation/rfc-0034-cli-compliance-migration-review.md)
- [Validation](../validation/rfc-0034-cli-compliance-migration.md)
