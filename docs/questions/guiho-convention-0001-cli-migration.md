---
name: GUIHO Convention 0001 CLI Migration Question Ledger
purpose: Keep implementation questions and their authority visible before and during execution.
description: Records sealed convention decisions, open identity confirmations, platform proof gates, and the stop/requeue rule for all migration units.
created: 2026-08-16
owner: mirror-docs-questions
flags:
  - approved-for-execution
tags:
  - mirror
  - questions
  - convention-0001
keywords:
  - identity confirmation
  - Windows feasibility
  - release authorization
  - unit ledger
---

# GUIHO Convention 0001 CLI Migration Question Ledger

## Closed Commander Decisions

| ID | Accepted answer | Authority |
| --- | --- | --- |
| Q-001 | CLI home name is `mirror`. | Commander-in-Chief, 2026-08-16. |
| Q-002 | Main skill ID is `guiho-s-mirror`. | Commander-in-Chief, 2026-08-16. |
| Q-003 | Main install/setup prompt ID is `guiho-p-mirror`. | Commander-in-Chief, 2026-08-16. |
| Q-012 | Use the scoped Convention 0001 precedence exception below until it expires. | Commander-in-Chief, 2026-08-16. |

### Q-012 Scoped Precedence Exception

- Owner: `guiho-a-0001-swe`.
- Scope: Mirror units `C0001-00` through `C0001-09` only.
- Higher task authority: the accepted GUIHO Convention 0001 source, Mirror
  authority decision, architecture, and digest-bound implementation plan.
- Superseded clauses: the shared Go CLI skill's obsolete 11-asset,
  self-replacement, asynchronous Windows completion, and agent `update` verb
  requirements.
- Reuse: prohibited for every other CLI and task.
- Expiry: the earlier of a version-pinned canonical shared-skill correction or
  the start of C0001-09's final release-readiness gate.
- Closure evidence: record the corrected shared-skill version/digest or the
  expired-exception handoff in the final validation record.

## Sealed Answers

| ID | Answer | Authority |
| --- | --- | --- |
| Q-004 | Breaking changes are permitted and expected. | User direction on 2026-08-16. |
| Q-005 | Production remains Go/Cobra with one command tree, strict YAML, no Viper, and static builds. | Repository instructions and Convention 0001 where compatible. |
| Q-006 | Convention 0001 supersedes the obsolete 11-asset, direct-payload, self-replacement, scheduled-upgrade, and `update`-verb clauses. | Accepted authority decision. |
| Q-007 | Eight application payload targets remain the native matrix; matching stable launchers are added. | Convention 0001 plus current target matrix. |
| Q-008 | Global and project configuration are distinct strict contracts. | Convention 0001. |
| Q-009 | Lifecycle mutations use a complete manifest and installed ownership manifest. | Convention 0001. |
| Q-010 | Implementation, sequential PR integration, and the exact `5.0.0-alpha.0` version commit/tag push are authorized subject to all plan gates. GitHub Release/publication, public lifecycle execution, and production mutation remain unauthorized. | Commander-in-Chief, 2026-08-16. |
| Q-011 | Existing dirty worktree changes are user-owned and must be preserved. | Observed planning baseline. |
| Q-013 | The complete current release has 25 manifest-derived assets and no separate helper family. | Revised architecture and first independent review adjudication. |
| Q-014 | `artifacts.json` has ordinary-asset digests but no self/checksum digest; checksums cover the manifest plus all ordinary assets and exclude themselves. | Revised architecture and first independent review adjudication. |

## Evidence Gates, Not Product Questions

These answers are defined by the architecture, but implementation cannot pass
the associated gate without native evidence:

| ID | Required proof | Owner unit |
| --- | --- | --- |
| E-001 | Windows launcher can synchronously activate a new immutable payload while the old payload is running. | C0001-05 |
| E-002 | Windows uninstall can synchronously verify removal of the launcher and running payload without reporting deferred success. | Feasibility C0001-05; implemented acceptance C0001-08; final workflow confirmation C0001-09. |
| E-003 | PID/start-identity/executable-path checks prevent PID-reuse and unrelated-process termination. | C0001-05 and C0001-07 |
| E-004 | Legacy `.local/bin/mirror` detection reports PATH shadowing and preserves the out-of-bound file regardless of its name. | C0001-06 |
| E-005 | Native macOS process identity, launcher, install, upgrade, rollback, and uninstall semantics satisfy final platform claims. | C0001-09 |

Failure to prove an evidence gate requeues the architecture and plan. It does
not authorize a weaker or asynchronous substitute.

## Per-Unit Ledger Rule

Before each unit begins, its executor appends a section containing:

- exact `origin/main` base SHA and predecessor PR/merge SHA;
- human execution approval reference;
- all baseline deviations;
- every material question, the authority consulted, and its answer;
- evidence-gate result where applicable;
- requeue/stop decisions; and
- final PR number and exact reviewed/validated head.

Safe mechanical choices may be recorded with rationale. A choice that changes
public behavior, canonical paths/IDs, ownership, persistence, security,
platform support, release contents, or failure semantics requires human or
accepted-architecture authority. An unanswered material question stops the
unit and returns it to the plan writer/controller.
