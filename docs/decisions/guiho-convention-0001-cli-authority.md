---
name: GUIHO Convention 0001 CLI Authority
purpose: Record which CLI contract governs the breaking Mirror compliance migration.
description: Accepts GUIHO Convention 0001 as the current authority over obsolete repository and Go-skill delivery clauses while retaining compatible Go/Cobra constraints.
created: 2026-08-16
owner: mirror-docs-decisions
flags:
  - accepted
  - breaking-change
tags:
  - mirror
  - decision
  - convention-0001
keywords:
  - contract precedence
  - 11 assets
  - stable launcher
  - complete release
---

# GUIHO Convention 0001 CLI Authority

## Status

**Accepted.** The user identified GUIHO Convention 0001 as an established
convention, requested a complete compliance audit, and explicitly accepted
breaking changes for the cohesive implementation plan.

## Decision

The current
`C:\GUIHO\guiho\docs\conventions\guiho-convention-0001-cli.md` governs the
Mirror compliance migration.

Where the convention conflicts with older Mirror repository documents or the
currently installed Go CLI engineering skill/contract, the convention wins for
this migration. Compatible constraints remain in force: Go/Cobra, one command
tree, YAML-only strict decoding, no Viper, static builds, the eight payload
target matrix, stable exit codes, bounded agent-resource mutations, and
separately authorized release effects.

The following older clauses are superseded and must be updated rather than
preserved:

- exactly 11 release assets;
- direct installation of the application payload as the PATH command;
- application-payload self-replacement;
- detached/scheduled Windows upgrade completion;
- `update` as the public agent mutation verb;
- one project-only configuration/schema contract;
- installer reconciliation of only a partial release.

## Rationale

Those clauses directly contradict the convention's complete-release manifest,
stable-launcher, immutable-payload, synchronous-upgrade, dual-configuration,
and agent lifecycle requirements. Attempting to satisfy both would create two
incompatible authorities and an installation that could not be safely repaired
or uninstalled.

## Consequences

- Repository instructions, technical documents, embedded skills, build tools,
  workflows, and publication checks must converge on the new architecture.
- The shared `guiho-s-0035-cli-engineer-go` package in the Superiority
  repository needs a separately coordinated update, or an explicit temporary
  task-scoped precedence note must remain until it is updated.
- The parent GUIHO repository must track the cross-component convention/skill
  coordination; Mirror-local implementation remains in this repository.
- This decision does not authorize implementation, a version bump, tag, push,
  publication, production mutation, or removal of a user's installation.

If the canonical skill is not updated before C0001-00, the temporary exception
requires explicit human acceptance with these exact bounds:

- owner: `guiho-a-0001-swe`;
- scope: Mirror units C0001-00 through C0001-09 only;
- authority: Convention 0001 and this accepted Mirror decision;
- prohibited reuse: no other CLI or task;
- expiry: the earlier of canonical skill update or the start of C0001-09 final
  release-readiness validation; and
- closure evidence: updated Superiority skill path/version or digest recorded
  in the parent coordination TODO and final Mirror validation.

No agent may infer or silently apply this exception.

## Superseded Durable Records

The following records remain historical inputs but are not current authority
where they conflict with Convention 0001:

- `docs/decisions/global-schema-association.md`: preserve portable HTTPS and
  offline schema intent; supersede mutable branch URLs and the claim that the
  schema is not a release asset.
- `docs/superpowers/specs/2026-07-15-upgrade-reliability-design.md`: preserve
  exhaustive pagination, bounded streaming/progress, integrity, rollback, and
  recovery; supersede direct canonical-executable replacement.
- `docs/rfc/mirror-go-rewrite-rfc.md`: preserve Go/Cobra, strict YAML, domain
  separation, canonical tag shape, and eight payload targets; supersede the
  single-config/global fallback, scheduled Windows replacement, and 11-asset
  delivery model.
- `docs/decisions/streamed-upgrade-download.md`: preserve its bounded streaming
  principle; Bun-specific implementation and direct-swap statements are
  historical only.
- Current `AGENTS.md`, `TECHNICAL.md`, embedded skill, README, workflows, and
  release tools must be revised by the migration before final compliance.

No older record is deleted or rewritten to hide its historical context. Each
current entrypoint must link to this decision or the accepted replacement
architecture when ambiguity would otherwise remain.

## Rejected Alternatives

- **Preserve the 11-asset contract and claim partial compliance:** leaves the
  central ownership, launcher, schema, installer, upgrade, and uninstall
  violations unresolved.
- **Maintain a legacy and a convention-compliant installer indefinitely:**
  creates split ownership and ambiguous recovery semantics.
- **Treat the convention as documentation-only:** contradicts the requested
  repository-wide compliance outcome and cannot produce testable guarantees.
