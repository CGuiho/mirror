---
name: Migrate Mirror To Full RFC 0034 Compliance
purpose: Define the required scope, breaking-change boundary, and acceptance signals for the Mirror RFC 0034 migration.
description: Captures what must be true when Mirror adopts TypeBox, YAML, the exact agent namespace, standardized distribution, and the complete GUIHO CLI contract.
created: 2026-07-18
flags:
  - approved
  - breaking-change
tags:
  - todo
  - cli
  - migration
keywords:
  - mirror
  - RFC 0034
  - mirror.yaml
  - agent namespace
  - fourteen release assets
owner: mirror-docs-todo
---

# Migrate Mirror To Full RFC 0034 Compliance

## Summary

Make Mirror fully compliant with GUIHO RFC 0034 through an approved breaking
migration. Mirror does not need to preserve TOML configuration, arbitrary short
aliases, plural agent commands, automatic agent writes, legacy asset names, or
its Bun-dependent npm launcher.

## Todo Index

- Task: `RFC 0034 CLI Compliance Migration`
- Status: completed
- Index: [todo.md](../../todo.md)

## Outcome

Mirror uses Bun, strict TypeScript ESM, raw Citty, and TypeBox; reads only
`mirror.yaml` through the RFC precedence rules; implements exact startup,
Developer Context help, agent, upgrade, installer, output, npm bootstrap, and
storage behavior; and builds and stages exactly the twelve `mirror-*` native
binaries plus `guiho-s-mirror.md` and `guiho-i-mirror.md` for the GitHub release
workflow.

## Scope

### In scope

- TypeBox schemas for configuration, package/JSR data, cache, release APIs,
  flags, agent resources, hooks, and stable output.
- breaking migration from `mirror.config.toml` to `mirror.yaml`.
- final Citty command tree and removal of `-dy`/`-y`.
- standardized startup cache and detached worker.
- complete help/tree/depth/docs modes.
- complete singular agent skill/instruction/prompt namespaces.
- removal of implicit agent mutation from ordinary commands.
- verified upgrade, pagination, post-upgrade agent reconciliation.
- direct installers, Node-compatible npm bootstrap, exact fourteen assets.
- canonical docs, bundled skill, schema reference, CI, tests, TODO, and xdocs.

### Out of scope

- Editing every downstream GUIHO consumer repository in this task.
- Preserving a legacy TOML reader or dual configuration.
- Publishing or live installation. Versioning, tagging, and Git ref pushes
  received separate authorization after this plan was approved.
- Approving the GitHub `production` environment or creating the public GitHub
  Release. Until that external gate completes, public upgrade and installer
  resolution for the new version is expected to remain unavailable.
- Changing Mirror's semantic-version calculation beyond what RFC validation
  and output discipline require.

## Acceptance Signals

- `@sinclair/typebox` is a runtime dependency and all structured boundaries are
  decoded.
- `mirror.config.toml` is absent from the shipping contract; `mirror.yaml`
  resolves by explicit path, cwd, then standardized global path.
- No arguments prints exactly `Hello Windows - mirror v<version>`.
- Cache lives at `~/.guiho/mirror/cache.json` and foreground startup never
  waits for network access.
- Only `-h` and root `-v` exist.
- Every command scope provides help, Unicode tree help, validated tree depth,
  and redirect-safe Markdown docs from the Citty tree.
- Full singular `agent` commands operate on both skill directories and zero,
  one, or both instruction files idempotently.
- Ordinary init/config/version commands do not install skills or edit
  instruction files.
- Upgrade pagination, pre-release filtering, progress, rollback, cache commit,
  and agent reconciliation pass.
- npm bootstrap and both installers work in environments without Bun already
  installed.
- Exactly fourteen RFC-named assets are built and selected; no
  `guiho-mirror-*` or `macos` assets remain.
- Release descriptions contain only the exact version's changelog section, and
  installer agent assets are validated as the expected Markdown resources
  before installation.
- Full local checks, xdocs validation, implementation review, and validation
  report pass.

## Dependencies And Context

- [Executable migration plan](../plans/rfc-0034-cli-compliance-migration.md)
- The coordinating agent is `guiho-a-0001-swe`; the mandatory CLI specialist is
  the `guiho-s-0034-cli-engineer` skill.
- Existing upgrade transaction and agent instruction discovery are useful
  implementation inputs, but their public interfaces do not override RFC 0034.
- Downstream TOML users require a separately authorized migration wave.

## Watch-outs

- Mirror is self-hosting; preserve a validated path for planning/applying the
  eventual release after the new YAML implementation is ready.
- Do not let normal version operations mutate global skills or parent
  instruction files.
- Do not mix Git/upgrade progress with JSON stdout.
- Do not weaken release commit/tag/push safety while moving CLI validation.
- Tests must isolate Git repositories, home directories, instruction files,
  global skill targets, network responses, caches, and executable replacement.

## Before Starting

- Read both repository roots' instructions, the task spec, and the full plan.
- Load every required agent/skill named in the plan.
- Re-run the TOML consumer and current-agent behavior inventories.
- Confirm a clean or fully understood worktree and baseline checks.

## While Working

- Execute one numbered plan unit at a time.
- Treat breaking changes as approved and avoid compatibility layers.
- Keep the bundled skill, schema reference, DOCS, tests, TODO, and descriptors
  aligned with each completed unit.
- Stop before remote/version/release/global-install mutations.

## After Finishing

- Produce an implementation review and validation report.
- Mark the TODO `completed` after every completion-gate check passes.
- Produce the downstream `mirror.yaml` migration handoff.
- Use the separately authorized Mirror-managed version application; do not
  publish the package.

## Related Files

- [Implementation plan](../plans/rfc-0034-cli-compliance-migration.md) -
  Ordered execution units and verification gates.
- [Upgrade reliability plan](../plans/upgrade-reliability-implementation.md) -
  Existing verified replacement behavior to preserve and extend.
- [Contextual help design](../cli-contextual-help-design.md) - Existing help
  behavior that the generated RFC help system supersedes where conflicting.
- [Plan review](../reviews/plans/rfc-0034-cli-compliance-migration-review.md) -
  Ready-for-execution review of self-hosting, sequencing, and release gates.
- [Implementation record](./rfc-0034-cli-compliance-migration-implementation.md) -
  Completed units, changed surfaces, and release handoff.
- [Implementation review](../reviews/implementation/rfc-0034-cli-compliance-migration-review.md) -
  Acceptance review against the approved plan.
- [Validation report](../validation/rfc-0034-cli-compliance-migration.md) -
  Commands, behavior checks, build evidence, and readiness.
- [Downstream handoff](../validation/rfc-0034-downstream-handoff.md) -
  Repositories that still require YAML migration.

## References

- [todo.md](../../todo.md)
- [AGENTS.md](../../AGENTS.md)
