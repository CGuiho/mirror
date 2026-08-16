---
name: GUIHO Convention 0001 CLI Compliance Migration Plan Review
purpose: Independently assess whether the revised ten-unit migration plan is complete, safe, traceable, and ready for approval or execution.
description: Digest-bound independent review of the corrected Convention 0001 plan, task specification, question ledgers, architecture, evidence gates, commands, fixtures, ownership, and release boundaries.
created: 2026-08-16
owner: mirror-docs-reviews-plans
flags:
  - ready-for-execution-with-prerequisites
  - execution-blocked
  - digest-bound
tags:
  - review
  - planning
  - mirror
  - convention-0001
keywords:
  - plan review
  - independent review
  - exact commands
  - question ledger
  - execution gates
---

# GUIHO Convention 0001 CLI Compliance Migration Plan Review

## Verdict

**Ready for execution with explicit prerequisites; no unit is executable now.**

The final independent re-review resolves every prior plan-review defect and
maps all 31 confirmed compliance findings into ten sequential, exact-head-gated
units. It reports no technical findings against the reviewed plan bytes.

Execution remains blocked by intentionally open human/external gates: Q-001
through Q-003 identity acceptance, Q-012 shared-skill resolution or scoped
exception, Commander acceptance of the current architecture/plan/review, an
exact clean integrated base, and separate C0001-00 execution/delivery
authorization. This review authorizes no implementation, branch push, pull
request, release planning, version change, tag, publication, or public
lifecycle action.

## Reviewed Plan Identity

- Path: `docs/plans/guiho-convention-0001-cli-migration.md`
- SHA-256: `e2be85c4d361ba880022082db9d9e9054efca3176b993c3254a9ab717d137ec9`
- Unit graph: C0001-00 through C0001-09, strictly sequential
- Audit baseline: CLI-001 through CLI-031

Any byte change to the plan invalidates this digest-bound verdict and requires
a new independent review before C0001-00 can start.

## Reviewed Authorities and Ledgers

- [Original compliance audit](../implementation/guiho-convention-0001-cli-compliance-review.md)
- [Convention authority decision](../../decisions/guiho-convention-0001-cli-authority.md)
- [Proposed identity decision](../../decisions/guiho-convention-0001-cli-identities.md)
- [Revised architecture](../../architecture/guiho-convention-0001-cli-migration.md)
- [Independent architecture review](../architecture/guiho-convention-0001-cli-migration-review.md)
- [Task specification](../../todo/guiho-convention-0001-cli-migration.md)
- [Master question ledger](../../questions/guiho-convention-0001-cli-migration.md)
- [Per-unit ledgers](../../questions/guiho-convention-0001-cli-migration/guiho-convention-0001-cli-migration.xdocs.md)

## Correction Verification

### 1. RunX creation and UID permanence - resolved

C0001-00 creates only permanent baseline selectors whose exact commands already
exist. It creates no future placeholders. Each later unit introduces its
permanent UID together with its executable harness, fixtures, and assertions;
UID behavior cannot be silently replaced. Obsolete lifecycle workflows remain
uncataloged during the migration freeze.

### 2. Exact commands, bounded fixtures, and positive evidence - resolved

The plan names the exact C0001-02/C0001-03 harnesses, POSIX and PowerShell
lifecycle commands, C0001-04 build/verifier commands, native C0001-09 commands,
and final audit command. Builder output uses `--output`; verification uses
`--directory`. Disposable state is confined to the already ignored
`.temp/convention-0001/<unit>/<scenario>/` tree and checked-in inputs live under
`devops/test-fixtures/convention-0001/`.

Every custom harness must emit JSON with positive scenario/assertion counts,
zero failures, and nonzero exit on absent fixtures/tests or a zero count. This
prevents a no-tests-matched success from becoming evidence. Cleanup must prove
a strict descendant and cannot remove `.temp/` or the convention root.

### 3. Self-test extension ownership - resolved

C0001-01 establishes the injected, deterministically ordered `SelfTestCheck`
contract in `cmd/selftest.go` without mutable global registration. C0001-03
adds `embedded-resources`; C0001-04 adds `release-manifest-protocol`; C0001-05
adds `installed-state`. Their exact source ownership and ledger fields do not
overlap accidentally, and each ledger records check order and a positive
assertion count.

### 4. Classifier ownership and thin executable - resolved

`cmd` owns pre-Cobra classification, lifecycle routing, Cobra construction, and
exit mapping. `main.go` only constructs build/system dependencies, calls
`cmd.Run`, maps the result, and exits. It owns no token recognition, lifecycle
branching, lock/recovery, resource mutation, network work, or command
registration.

The route contract is sealed: exact introspection bypasses notices/workers and
recovery; argument-free Mirror never recovers and fails closed if recovery
blocks safe bootstrap; upgrade performs local validation, prints its first
recovery block, locks, recovers, then networks; dry-run does not recover or
mutate; reserved staged lifecycle locks, recovers, revalidates, then mutates.

### 5. CLI-014 and CLI-015 closure timing - resolved

C0001-03 validates the skill/setup-prompt content and embedding only
provisionally; both findings remain open. C0001-09 alone closes them after native
fixture install, separately managed init, raw version, repair, upgrade, prompt
command, and installed/projected-byte evidence against the selected manifest.

### 6. Frozen release manifest and exact installed state - resolved

C0001-04 freezes the release manifest. C0001-05 cannot alter it conditionally.
The plan enumerates the closed `current.json`, `installed-artifacts.json`,
journal, root-enum, and instance-record fields. Any missing invariant stops the
unit and requeues architecture/C0001-04 instead of allowing an opportunistic
schema addition.

### 7. Current-review approval chain - resolved

This regenerated review binds to the current plan digest. The plan descriptor
labels the plan proposed, and the C0001-00 ledger requires this review path,
reviewed digest, verdict, and Commander acceptance. An earlier review of
superseded plan bytes cannot open execution.

## Additional Safety and Traceability Results

- Every CLI-001 through CLI-031 row has an owner unit and recurrence proof.
- C0001-04 launcher proof is structural only; native runtime behavior begins in
  C0001-05.
- C0001-05/C0001-07 own the exact pre-Cobra and recovery-routing seams/tests.
- Interactive init is a post-install handoff, not an installer rollback phase.
- E-001 through E-003 are native early lifecycle gates; E-005 requires both
  native Darwin AMD64 and ARM64 evidence and cannot be waived as build-only.
- The 25-asset count remains manifest-derived with the non-circular manifest/
  checksum graph; no separate helper artifact is introduced.
- Shared `.guiho` roots/PATH, user content, and legacy `.local/bin/mirror`
  remain outside destructive ownership.
- Task state becomes `testing` before the final C0001-09 status commit/push and
  exact-head review; only the controller/integrator may mark completion after a
  zero-finding audit on refreshed merged main.
- C0001-09 produces only a release-readiness handoff. Release target selection,
  `mirror version plan`, release TODO creation, apply/tag/push/publication, and
  public lifecycle execution require a later, separately authorized task.

## Execution Gates

C0001-00 remains non-executable until all of the following are durably recorded:

1. Q-001 through Q-003 accepted identities;
2. Q-012 canonical-skill update/version pin or the exact scoped exception;
3. Commander approval of the current architecture, plan, and this digest-bound
   review;
4. this review path, digest, verdict, and acceptance in C0001-00's ledger;
5. exact clean integrated `origin/main` base with no user-work overlap; and
6. separate C0001-00 implementation and delivery authorization.

Windows/macOS evidence is not a plan-drafting prerequisite, but it is mandatory
at the owning execution gates. Failure stops and requeues; no asynchronous,
scheduled, cross-build, or narrowed-support substitute is authorized.

## Final Review Handoff

The first executable unit after every gate closes is C0001-00. The controller
must recheck the plan digest immediately before execution. All ten units still
require isolated branch/worktree ownership, accepted 0049 review, accepted 0050
validation on the same exact head, and 0052 integration/reachability/cleanup.

This verdict means the plan is technically executable after every stated gate
closes. It is not Commander acceptance, unit authorization, or an implementation
instruction.
