---
name: GUIHO Convention 0001 CLI Migration Question Ledger
purpose: Keep implementation questions and their authority visible before and during execution.
description: Records sealed convention decisions, open identity confirmations, platform proof gates, and the stop/requeue rule for all migration units.
created: 2026-08-16
owner: mirror-docs-questions
flags:
  - approval-required
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

## Open Human Decisions

| ID | Question | Proposed answer | Blocks |
| --- | --- | --- | --- |
| Q-001 | What is the confirmed CLI home name? | `mirror` | C0001-00 through C0001-09 |
| Q-002 | What is the confirmed main skill ID? | `guiho-s-mirror` | C0001-00 through C0001-09 |
| Q-003 | What is the confirmed main install/setup prompt ID? | `guiho-p-mirror` | C0001-00 through C0001-09 |
| Q-012 | How is the contradictory canonical Go CLI skill resolved for execution? | Update/version-pin the Superiority skill; otherwise explicitly accept the scoped owner/expiry exception. | C0001-00 through C0001-09 |

Approval means marking the corresponding identity decision Accepted and
updating this table with the human answer and date. Silence, existing filenames,
or an executor's inference does not close these questions.

## Sealed Answers

| ID | Answer | Authority |
| --- | --- | --- |
| Q-004 | Breaking changes are permitted and expected. | User direction on 2026-08-16. |
| Q-005 | Production remains Go/Cobra with one command tree, strict YAML, no Viper, and static builds. | Repository instructions and Convention 0001 where compatible. |
| Q-006 | Convention 0001 supersedes the obsolete 11-asset, direct-payload, self-replacement, scheduled-upgrade, and `update`-verb clauses. | Accepted authority decision. |
| Q-007 | Eight application payload targets remain the native matrix; matching stable launchers are added. | Convention 0001 plus current target matrix. |
| Q-008 | Global and project configuration are distinct strict contracts. | Convention 0001. |
| Q-009 | Lifecycle mutations use a complete manifest and installed ownership manifest. | Convention 0001. |
| Q-010 | No version apply, tag, push, publication, public install, or production mutation is authorized by this plan. | Repository release boundary and this planning request. |
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
