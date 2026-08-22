---
name: GUIHO Convention 0001 CLI Compliance Migration
purpose: Define the complete outcome and acceptance signals for making production Mirror compliant with GUIHO Convention 0001.
description: Tracks the breaking command, configuration, agent, release, installer, launcher, upgrade, uninstall, documentation, and validation migration derived from the 31-finding audit.
created: 2026-08-16
updated: 2026-08-16
owner: mirror-docs-todo
flags:
  - proposed
  - breaking-change
  - approval-required
tags:
  - mirror
  - todo
  - cli
  - convention-0001
keywords:
  - compliance migration
  - stable launcher
  - complete release
  - dual configuration
  - transactional lifecycle
---

# GUIHO Convention 0001 CLI Compliance Migration

## Task State

- Status: `todo; plan written; approval gates open`
- Lifecycle controller: `guiho-a-0001-swe`
- Audit baseline: `a65562055d1dd6e879812f5507558dbc39d18f43`
- Planning release context: latest canonical tag `mirror/v4.1.0-alpha.2`;
  latest stable tag `mirror/v4.0.1`.
- Compliance audit:
  [guiho-convention-0001-cli-compliance-review.md](../reviews/implementation/guiho-convention-0001-cli-compliance-review.md)
- Architecture:
  [guiho-convention-0001-cli-migration.md](../architecture/guiho-convention-0001-cli-migration.md)
- Architecture review:
  [guiho-convention-0001-cli-migration-review.md](../reviews/architecture/guiho-convention-0001-cli-migration-review.md)
- Plan:
  [guiho-convention-0001-cli-migration.md](../plans/guiho-convention-0001-cli-migration.md)
- Plan review:
  [guiho-convention-0001-cli-migration-review.md](../reviews/plans/guiho-convention-0001-cli-migration-review.md)
- Question ledger:
  [guiho-convention-0001-cli-migration.md](../questions/guiho-convention-0001-cli-migration.md)

## Unit Dependency and Evidence Table

| Unit | Depends on | Primary outcome | Ledger |
| --- | --- | --- | --- |
| C0001-00 | Commander gates | Authority, RunX, full XDocs baseline | [C0001-00](../questions/guiho-convention-0001-cli-migration/C0001-00.md) |
| C0001-01 | C0001-00 | Cobra/version/help/lists/agent verbs/transitional self-test | [C0001-01](../questions/guiho-convention-0001-cli-migration/C0001-01.md) |
| C0001-02 | C0001-01 | Dual config, schemas/examples, evolution policy | [C0001-02](../questions/guiho-convention-0001-cli-migration/C0001-02.md) |
| C0001-03 | C0001-02 | Common init, resources, bounded plain invocation | [C0001-03](../questions/guiho-convention-0001-cli-migration/C0001-03.md) |
| C0001-04 | C0001-03 | Manifest-derived 25-asset build/verification fixture | [C0001-04](../questions/guiho-convention-0001-cli-migration/C0001-04.md) |
| C0001-05 | C0001-04 | Launcher/state/transaction engine and Windows proofs | [C0001-05](../questions/guiho-convention-0001-cli-migration/C0001-05.md) |
| C0001-06 | C0001-05, E-001 | Both installers, repair, PATH, legacy detection | [C0001-06](../questions/guiho-convention-0001-cli-migration/C0001-06.md) |
| C0001-07 | C0001-06, E-003 | Synchronous complete-release upgrade | [C0001-07](../questions/guiho-convention-0001-cli-migration/C0001-07.md) |
| C0001-08 | C0001-07, E-002 | CLI/POSIX/PowerShell uninstall parity | [C0001-08](../questions/guiho-convention-0001-cli-migration/C0001-08.md) |
| C0001-09 | C0001-00..08, Q-012 | Native CI, docs, publication gates, zero-finding audit | [C0001-09](../questions/guiho-convention-0001-cli-migration/C0001-09.md) |

For each `<NN>`, integrated evidence is stored at
`docs/reviews/implementation/guiho-convention-0001-cli-migration-C0001-<NN>.md`
and `docs/validation/guiho-convention-0001-cli-migration-C0001-<NN>.md`.
Final evidence uses
`docs/reviews/implementation/guiho-convention-0001-cli-compliance-final-review.md`
and `docs/validation/guiho-convention-0001-cli-migration-final.md`.

## Finding Traceability

| Findings | Units |
| --- | --- |
| CLI-001 | C0001-00 |
| CLI-002..CLI-003 | C0001-00, C0001-09 |
| CLI-004..CLI-007 | C0001-01 |
| CLI-008 | C0001-01, C0001-03 |
| CLI-009 | C0001-02 |
| CLI-010..CLI-011 | C0001-02, C0001-03 |
| CLI-012 | C0001-02, C0001-04 |
| CLI-013 | C0001-03 |
| CLI-014..CLI-015 | C0001-03, C0001-09 |
| CLI-016 | C0001-08 |
| CLI-017 | C0001-06 |
| CLI-018 | C0001-04 |
| CLI-019 | C0001-04, C0001-06 |
| CLI-020..CLI-022 | C0001-05, C0001-06 |
| CLI-023 | C0001-06 |
| CLI-024 | C0001-01, C0001-03..C0001-07 |
| CLI-025 | C0001-07 |
| CLI-026 | C0001-05, C0001-07 |
| CLI-027 | C0001-04, C0001-07 |
| CLI-028 | C0001-05, C0001-07 |
| CLI-029 | C0001-08 |
| CLI-030 | C0001-09 |
| CLI-031 | C0001-04, C0001-06..C0001-09 |

## Outcome

Production Mirror obeys GUIHO Convention 0001 across its repository tooling,
public Cobra contract, separate project/global YAML configuration, evolution
policy, initialization, agent artifacts, complete release, stable launcher,
immutable installation layout, install/reinstall/repair, synchronous upgrade,
manifest-owned uninstall, user documentation, CI, and publication gates.

The migration removes obsolete behavior rather than maintaining two competing
installation models. Every lifecycle transition is complete, verified,
recoverable, and proven on the native platforms it claims to support.

## Scope

### In scope

- Correct every audit finding `CLI-001` through `CLI-031`.
- Add root RunX coverage and repository-wide XDocs coverage.
- Align repository/local/shared engineering contracts with the accepted
  convention precedence.
- Correct raw version, help-tree, list flags, agent verbs, and hidden self-test.
- Add distinct project/global typed configuration, schemas, examples,
  inheritance, version-pinned associations, and evolution enforcement.
- Add the main install/setup prompt and complete agent reconciliation.
- Define/build/verify the manifest-declared complete release and all stable
  launchers; use the verified staged payload's hidden lifecycle entrypoint
  instead of publishing a second helper-binary family.
- Implement canonical shared paths, immutable version payloads, activation
  pointer, installed manifest, journals, locks, instance registry, snapshots,
  recovery, and rollback.
- Replace installers, upgrade, and uninstall with complete transactions; add
  both mandatory uninstall scripts.
- Migrate README, full docs, technical contracts, help, workflows, CI, and
  publication acceptance.
- Produce exact-head review and validation evidence for every implementation
  PR and a final repository-wide compliance re-audit.

### Out of scope

- Restoring or extending the historical Bun/TypeScript CLI.
- New semantic-version features unrelated to convention integration.
- Production deployment, secrets, authentication, databases, DNS, or cloud
  infrastructure.
- A release/version apply/tag/push/publication without separate authorization.
- Deleting or mutating a real user installation during ordinary local tests.

## Acceptance Signals

1. RunX check/list succeeds from the repository root and catalogs every
   project workflow; strict XDocs includes all tracked owned source and
   workflow directories without invalid exclusions.
2. Live help/version tests prove raw SemVer, `max|>1` help depth, optional
   global flag repetition, comma-preserving repeated list flags, and canonical
   `agent ... upgrade` verbs.
3. Both YAML configs strictly load, independently fail, report resolved paths,
   generate exact closed schemas/examples, merge deterministically, and enforce
   the safe always-ask evolution default.
4. Init reconciles global/project config and every required agent artifact
   idempotently using version-pinned schema/resource references.
5. The release verifier accepts only the complete manifest-declared set, all
   checksums and semantic relationships, the eight payload targets, and eight
   matching launcher targets.
6. Installer and same-version repair consume the complete selected release,
   stage only under `.guiho/.temp`, preserve persistent/user-owned paths,
   maintain PATH idempotently, and roll back every mutation on injected failure.
7. The stable launcher returns exact payload behavior and falls back only when
   the active payload is missing, corrupt, or unstartable.
8. Upgrade always prints first/final executable recovery blocks, selects exact
   versions/channels across the complete catalog, synchronously activates and
   verifies the target, safely handles other instances, and completely recovers
   every interrupted phase.
9. CLI/POSIX/PowerShell uninstall surfaces produce the same exact grouped plan,
   confirmation behavior, preservation semantics, bounded ownership, and
   synchronous completed removal.
10. Native runner evidence supports every runtime platform claim; cross-built
    ARM variants without matching hardware are labeled build-only. Build-only
    labeling does not waive E-005 while macOS remains a claimed runtime target.
11. README ends with the complete Uninstall section, all current technical and
    agent documents agree, and obsolete 11-asset/scheduled-upgrade guidance is
    absent from current authorities.
12. A fresh convention audit reports no violations, with all standard Go,
    Mirror, RunX, XDocs, release, installer, upgrade, and uninstall gates green.

## Approval and Dependency Gates

- Accept the proposed CLI home, main skill, and main prompt identities.
- Materialize the completed second independent architecture-review readiness
  verdict, then approve the revised architecture, plan, and plan-review
  conditions.
- Coordinate the contradictory shared Go CLI skill/contract in the Superiority
  repository and track that cross-component work in the parent GUIHO TODO, or
  explicitly accept the scoped owner/expiry exception before C0001-00.
- Prove the Windows launcher activation and synchronous self-uninstall designs
  before dependent lifecycle implementation.
- Obtain native macOS lifecycle evidence before final platform compliance and
  release readiness; its absence does not block drafting this plan.
- Provide separate human authorization for each implementation unit/PR.
- Provide separate authorization for the final version decision and every
  release effect.

## Lifecycle State Rules

- Keep this task `todo` while the identity/plan gates are open.
- Change to `in progress` only when C0001-00 has an approved exact execution
  base, isolated branch/worktree, and explicit execution approval.
- Change to `testing` after C0001-09 local implementation and native acceptance
  pass, before the final C0001-09 status commit/push and before its exact-head
  0049/0050 gates. C0001-00 through C0001-08 must already be integrated, while
  C0001-09 is not integrated until those gates accept its exact head.
- Change to `completed` only after the final exact-head validation report and
  fresh zero-finding audit pass on refreshed merged main, and 0052 proves merge,
  main reachability, and cleanup. The C0001-09 executor never marks completion;
  release/public verification is outside this task and requires a later,
  separately authorized release task.

## Risks and Stop Conditions

- Stop if any implementation path overlaps uncommitted user work.
- Stop if the convention, accepted identities, or shared Go CLI authority
  changes during execution; re-review architecture and re-plan affected units.
- Stop if a platform proof cannot provide synchronous verified semantics.
- Stop if a manifest would claim a shared/user-authored/unrelated path.
- Stop if validation requires mutating a real user CLI home, agent resources,
  repository config, or process set; redirect the fixture instead.
- Stop before any version apply, tag, push, publication, or public lifecycle
  mutation that lacks explicit authorization.

## Exact-Head and Rollback Rules

- Every unit records exact clean base, branch/worktree, approval, PR/head,
  independent 0049 review, 0050 validation, and 0052 merge/reachability/cleanup
  in its ledger. A head change invalidates prior review/validation.
- Runtime transactions restore the complete pointer, installed manifest,
  versions, projections, and only an operation-owned uncommitted PATH change.
  Shared roots/PATH, user content, and legacy `.local/bin` files are never
  rollback targets.
- Revert a merged unit only when no later integrated unit depends on it;
  otherwise revert the dependent chain in reverse or use an approved fix-
  forward plan. Published tags are immutable.
- Completion requires Q-001 through Q-003, Q-012, E-001 through E-005, all ten
  exact-head lifecycle gates, and a zero-finding final audit.
- A separate release TODO is created only after the human authorizes release
  preparation and a concrete target for
  `mirror version plan <commander-approved-target>`.
