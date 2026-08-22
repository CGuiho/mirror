---
name: Issue 28 Instruction Hook Schema Parity Plan Review
purpose: Gate the issue 28 schema-parity plan for safe unattended execution.
description: Independently reviews traceability, schema proof, ownership, sequencing, lifecycle gates, XDocs handling, and release boundaries for the instruction-hook schema correction.
created: 2026-08-12
flags:
  - approved
  - ready-for-execution
tags:
  - review
  - planning
  - schema
  - hooks
keywords:
  - issue 28
  - plan review
  - mirror.schema.json
  - instruction hook objects
  - schema parity
owner: mirror-docs-reviews-plans
---

# Issue 28 Instruction Hook Schema Parity Plan Review

## Verdict

**Ready for execution.**

The plan is traceable to issue #28 and the accepted issue #24 hook contract,
keeps production Go/Cobra code authoritative, identifies a focused first unit,
and seals the work for unattended execution. It provides deterministic
generated-versus-committed parity, positive and negative hook-contract proof,
dedicated branch/worktree metadata, exact-head review and validation gates, and
separate raw-`main` and tag-pinned publication boundaries.

No product, architecture, release, production, environment, dependency, or
ownership question requires a human answer before execution.

## Findings

### Blocker

None.

### High

None.

### Medium

- **Validation-report ownership wording requires the plan's exact-head section
  to control.** S28-02 lists
  `docs/validation/issue-28-instruction-hook-schema-parity.md` as a conditional
  owned path, while the lifecycle gate correctly requires `0049` and `0050` to
  persist non-head-mutating PR evidence and `0052` to materialize immutable
  review/validation records on integrated `main`. The executor must not create
  or commit the `0050` validation report on the feature branch. S28-02 may
  record local command evidence in the task handoff/spec; `0050` owns the
  exact-head validation gate and `0052` owns repository materialization.
- **The initial lifecycle-state edit is outside S28-01's enumerated product
  paths.** S28-01 explicitly requires moving the task to `in progress`, while
  `todo.md` and the linked task spec are listed under S28-02. Treat the initial
  status/timestamp update as the narrow mandatory lifecycle exception before
  product edits. Do not redesign task content in S28-01; S28-02 retains
  ownership of the later testing and evidence updates.

These are non-blocking because the plan already fixes unit order to one branch
and worktree and its later lifecycle-gate section states the controlling
exact-head behavior unambiguously.

### Low

- If no existing JSON Schema instance validator is available, the structural
  regression tests must unmarshal and traverse the schema, not merely search
  strings. They must assert the relevant `properties`, `oneOf`/`anyOf`,
  `required`, `additionalProperties`, `minLength`, and `minItems` relationships
  for representative major events, internal events, and aliases. Runtime YAML
  fixtures remain a separate proof of parser parity. This satisfies the plan
  without adding a dependency; any weaker proof is a stop condition.

## Executability and Sequencing

- S28-01 is one focused implementation unit: add the exact artifact-parity
  regression and hook-matrix assertions, mechanically refresh the committed
  schema, and prove deterministic regeneration.
- S28-02 correctly follows S28-01 on the same branch because its metadata and
  full validation describe the exact artifact produced by S28-01.
- Ownership excludes `xdocs.yaml`, the archived Bun/TypeScript implementation,
  release workflows, and already-correct user documentation unless concrete
  task-scoped evidence requires escalation.
- The overlap stop, recorded execution base, dedicated branch, isolated
  worktree, PR target, question ledger, requeue conditions, and single-PR
  integration order are sufficient for unattended execution.

## Acceptance and Recurrence Gate

The planned byte-for-byte test between `pkg/config.JSONSchema()` plus its one
trailing newline and `mirror/schema/mirror.schema.json` is the required
recurrence control. The additional structural matrix covers the defect rather
than only detecting file drift:

- canonical major events accept command strings, non-empty command lists, and
  objects with non-empty `instructions`, `commands`, or both;
- internal events and compatibility aliases remain command-only;
- event and object property sets are closed;
- empty values, unknown events/fields, internal instructions, and alias
  instructions are rejected by the encoded schema contract;
- runtime fixtures independently confirm the Go loader accepts the issue #28
  reproduction and rejects its unsupported counterparts.

The plan correctly adds no runtime dependency by default. A newly required
schema library or generator change requeues the work instead of expanding the
unit silently.

## Documentation and XDocs

The task spec, TODO entry, implementation plan, and descriptor maps are
aligned. README and `mirror/DOCS.md` already describe the accepted hook object
contract and therefore should remain untouched. The only planned behavior-
adjacent documentation correction is the inaccurate TypeBox authority text in
`mirror/schema/schema.xdocs.md`.

Installed XDocs v0.10.0 rejects the existing slash-delimited `scan.exclude`
entries before evaluating the touched scope. The plan handles this honestly:
reproduce and record the existing failure, do not change `xdocs.yaml`, and
manually verify frontmatter, document maps, and parent/child links. A new error
in a touched descriptor remains blocking.

## Git, Review, Validation, and Integration Gates

- Execute from the then-current approved `origin/main` commit on
  `codex/issue-28-instruction-hook-schema-parity` in an isolated worktree;
  never implement on `main`.
- Use smallest coherent explicit-path commits and a plain push. Keeping the
  parity test and generated artifact together is justified because either one
  alone intentionally fails the recurrence gate.
- Open one PR to `main`, then bind independent `0049` review and `0050`
  validation to the same exact head without mutating it.
- Re-review and revalidate every changed head. Only `0052` may reobserve gates,
  merge, materialize evidence on `main`, verify reachability, and remove the
  merged branch/worktree.
- Verify the raw `main` schema only after merge. Verify a tag-pinned schema only
  after a separately authorized Mirror patch release exists.

## Release, Production, Rollback, and Risk

The compatible defect warrants a `patch` recommendation after integration,
but the plan does not authorize version application, a tag, push, publication,
or GitHub Release. Because `mirror/v*` activates the production-environment
publication workflow, those effects remain separately approval-gated. No
deployment, traffic, DNS, migration, secret, or live-binary mutation is in
scope.

Rollback is appropriately atomic: revert the schema and parity test together;
never rewrite an already published tag. The primary recurrence risk is
controlled by exact artifact parity, while semantic drift is controlled by the
positive/negative schema matrix and runtime fixtures.

## Required Plan Changes

None. Apply the two medium findings above as controlling execution
clarifications. If either cannot be honored, stop and return the plan to
`guiho-a-0046-plan-writer` rather than improvising.

## First Executable Unit

**S28-01 - Schema Artifact Parity and Regression Coverage.**

After human execution approval, `guiho-a-0048-plan-executor` should create the
dedicated isolated branch/worktree from the recorded current `origin/main`,
perform only the narrow `in progress` lifecycle-state update, and then rerun
the runtime-versus-committed-schema mismatch before editing code or the schema
artifact.

## References

- [Issue #28](https://github.com/CGuiho/mirror/issues/28)
- [Accepted issue #24](https://github.com/CGuiho/mirror/issues/24)
- [Task specification](../../todo/issue-28-instruction-hook-schema-parity.md)
- [Implementation plan](../../plans/issue-28-instruction-hook-schema-parity.md)
- [Hook architecture](../../2026-06-07-mirror-hooks-design.md)
- [Prior hook implementation review](../implementation/mirror-v4.1.0-hooks-review.md)
- [Prior hook validation](../../validation/mirror-v4.1.0-hooks.md)
