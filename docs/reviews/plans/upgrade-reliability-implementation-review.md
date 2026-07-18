---
name: Mirror Upgrade Reliability Implementation Plan Review
purpose: Determine whether the upgrade reliability plan is safe and explicit enough for autonomous execution.
description: Reviews traceability, sequencing, failure semantics, tests, documentation, TODO alignment, and release boundaries for Mirror issues 9 and 10.
created: 2026-07-15
flags:
  - approved
  - ready-for-execution
tags:
  - review
  - planning
  - reliability
keywords:
  - mirror upgrade
  - plan review
  - Windows replacement
  - recovery command
owner: mirror-docs-reviews-plans
---

# Mirror Upgrade Reliability Implementation Plan Review

## Verdict

Ready for execution.

The plan is traceable to the approved design and issues #9/#10, separates domain contracts from Citty presentation, makes the first executable unit explicit, and includes the required Windows-native proof rather than relying only on mocks.

## Findings

### Blockers

None.

### High

None.

### Medium

- The installer implementations cannot literally import the TypeScript candidate builder. M6 correctly treats M2 as a shared naming contract; tests must enforce parity across the TypeScript, PowerShell, and POSIX candidate orders to prevent drift.
- The current package has a single `binary` script whose build module emits the asset matrix. M8 must record the actual available scripts rather than inventing a separate `binaries` command.

### Low

- Root XDocs currently reports an unrelated incomplete generated descriptor detail. The implementation should repair touched descriptor accuracy and record any remaining pre-existing strict-health issue rather than broad-regenerating unrelated docs.

## Sequencing Risks

- M3 must not fold release resolution back into opaque execution; the delayed-body output test is the guardrail.
- M4 must land before cache-success rendering. Cache writes are commit metadata and cannot be used as optimistic upgrade intent.
- M6 follows the domain invariants so installer behavior is derived from the same target/asset/replacement contract.
- M8 must document only implemented behavior and must not mark the TODO complete before local checks pass.

## Acceptance Criteria Review

Each unit identifies an owner, dependencies, files, cache/auth/data/docs impact, checks, acceptance criteria, and a stop condition. The plan explicitly covers:

- exact target resolution and prerelease preservation;
- fully paginated SemVer release discovery;
- pre-download planning and ordered lifecycle output;
- canonical rename/swap, exact fresh-process verification, rollback, and artifact preservation;
- post-verification cache and cleanup warnings;
- exact-version recovery for all bare-upgrade outcomes;
- hardened canonical installers and thin legacy wrappers;
- real Windows native executable replacement;
- help, docs, bundled skill, TODO, XDocs, and release-boundary updates.

No auth, database, remote deployment, secret, or production mutation is hidden in the plan.

## TODO Alignment

- Root task: [Mirror Upgrade Reliability](../../../todo.md)
- Task spec: [upgrade-reliability.md](../../todo/upgrade-reliability.md)
- Approved design: [upgrade-reliability-design.md](../../superpowers/specs/2026-07-15-upgrade-reliability-design.md)
- Execution plan: [upgrade-reliability-implementation.md](../../plans/upgrade-reliability-implementation.md)

The TODO status is correctly `in progress`; publication and issue closure remain outside this implementation branch.

## Required Plan Changes

No blocking changes. During execution, implement the two medium findings as test/validation details: candidate-order parity and accurate script reporting.

## First Executable Unit

M1 - Typed Upgrade and Catalog Contracts, immediately followed by M2 - Release Resolution and Complete Catalog.

## References

- [Implementation plan](../../plans/upgrade-reliability-implementation.md)
- [Approved design](../../superpowers/specs/2026-07-15-upgrade-reliability-design.md)
- [Task specification](../../todo/upgrade-reliability.md)
