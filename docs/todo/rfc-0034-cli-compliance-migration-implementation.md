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
`3.5.1` patch application contains the post-version test correction and is the
final Git handoff, not an open implementation unit.

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
