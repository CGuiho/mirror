---
name: Mirror 3.6.0 Schema And YAML Plan
purpose: Execute approved Mirror issues 14 and 15 plus the cross-CLI welcome and update lifecycle.
description: Ordered implementation, documentation, validation, release, and issue-closure plan for Mirror 3.6.0.
created: 2026-07-22
owner: mirror-docs-plans
flags:
  - approved
  - completed
tags:
  - mirror
  - planning
  - cli
keywords:
  - Mirror 3.6.0
  - issue 14
  - issue 15
  - schema persistence
  - welcome page
---

# Mirror 3.6.0 Schema And YAML Plan

## Units

1. Persist the TypeBox-derived schema atomically under the Mirror global home.
2. Expose explicit schema save behavior through Citty and structured output.
3. Refresh the schema during init, install, and transactional self-upgrade.
4. Use a portable schema association and verify npm schema equivalence.
5. Remove the obsolete configuration filename and TOML-looking CLI output.
6. Replace the one-line greeting with the deterministic cross-CLI welcome.
7. Await only local update-worker scheduling and retain bounded detached network work.
8. Update package docs, repository docs, TODO, XDocs metadata, tests, and CI smoke checks.
9. Run review, typecheck, tests, builds, exact-asset validation, and installer smoke tests.
10. Prepare Mirror `3.6.0`, publish exactly fourteen assets, validate publicly,
    attach evidence to issues 14 and 15, and close them.

## Constraints

- Bun, TypeScript, raw Citty, and TypeBox remain authoritative.
- No compatibility reader or dual configuration filename is introduced.
- No machine-specific path is committed.
- Release descriptions contain only the `3.6.0` changelog section.
- The protected publishing environment remains unless separately authorized
  after its future release-control risk is acknowledged.
