---
name: GUIHO Convention 0001 CLI Migration Architecture Review
purpose: Independently assess whether the proposed Mirror target architecture can support a complete convention migration.
description: Reviews authority, ownership, configuration, artifacts, launcher, transactions, recovery, native feasibility, validation, and approval gates before detailed planning.
created: 2026-08-16
owner: mirror-docs-reviews-architecture
flags:
  - ready-for-planning
  - execution-prerequisites
tags:
  - review
  - architecture
  - mirror
  - convention-0001
keywords:
  - stable launcher
  - complete release
  - transaction journal
  - Windows self uninstall
---

# GUIHO Convention 0001 CLI Migration Architecture Review

## Verdict

**Second review: Ready for planning with explicit execution prerequisites.**

The first independent review found four blockers: no materialized singular
authority, an unresolved 25-versus-33-asset helper design, a circular manifest/
checksum graph, and incomplete uninstall semantics. It also required sealing
argument-free behavior, exact evolution values, legacy detection-only handling,
the shared Go-skill precedence gate, installer phase ordering, and native
evidence boundaries.

Those corrections are now materialized in the revised architecture and
authority decision: 25 manifest-derived assets with no helper family, an
offline staged-payload lifecycle protocol outside Cobra, non-circular hashes,
complete fail-closed uninstall with unconditional shared PATH/root
preservation, bounded plain invocation, exact policy enums, scoped shared-skill
precedence, and separated Windows/macOS gates. The second independent review
accepted the architecture for planning.

## Reviewed Inputs

- GUIHO Convention 0001.
- [Compliance review](../implementation/guiho-convention-0001-cli-compliance-review.md).
- [Authority decision](../../decisions/guiho-convention-0001-cli-authority.md).
- [Proposed identity decision](../../decisions/guiho-convention-0001-cli-identities.md).
- [Target architecture](../../architecture/guiho-convention-0001-cli-migration.md).
- Current Go RFC, `TECHNICAL.md`, repository instructions, release matrix,
  installers, updater, agent resources, workflows, schemas, and XDocs state at
  audited head `a65562055d1dd6e879812f5507558dbc39d18f43`.

## Second-Review Disposition

The second review's remaining clarifications are incorporated:

- `pkg/release` owns the normative catalog model and golden vectors; shell
  adapters own pre-payload phase zero and prove parity.
- Phase-zero applicable downloads may precede the lock. Once acquired, prior-
  journal recovery is the first locked action, followed by staged-state
  revalidation. In-payload upgrade locks and recovers before network work.
- `__lifecycle` is a reserved token/staging-authorized protocol dispatcher
  outside the Cobra tree, not a hidden Cobra install command.
- Scripts validate the full 25-asset catalog/manifest/checksum filename set and
  hash every downloaded applicable byte; CI/release verification hashes foreign
  target bytes.
- `update` is rejected entirely rather than retained as a hidden alias.
- Windows uninstall feasibility, implemented acceptance, and final workflow
  confirmation belong to C0001-05, C0001-08, and C0001-09 respectively; macOS
  native evidence belongs to C0001-09.

## Findings

### Execution prerequisites

- **The required identity confirmation is open.** The architecture correctly
  labels `mirror`, `guiho-s-mirror`, and `guiho-p-mirror` as proposals. Any
  plan claiming unattended readiness before acceptance would violate the
  convention and make canonical paths and manifest IDs unstable.
- **Shared Go CLI guidance is contradictory.** The installed
  `guiho-s-0035-cli-engineer-go` contract still mandates exactly 11 assets,
  `update` agent verbs, self-replacement, and scheduled Windows completion.
  The accepted authority decision resolves Mirror's local precedence, but the
  plan must include an external coordination gate so future agents do not
  reintroduce the obsolete model.

### High

- **Windows synchronous self-uninstall needs a proved mechanism.** A plan must
  make native proof an early unit with explicit success semantics and must not
  accept a delayed `scheduled` result. If direct delete-on-close is not viable,
  a small manifest-verified finalizer may be used only if the invoking
  operation waits for and verifies completed removal.
- **Manifest schema evolution and launcher compatibility are coupled.** The
  first implementation must version both `artifacts.json` and `current.json`,
  define compatibility windows, and reject unknown newer schemas. Launcher
  changes must remain installer-driven; payload upgrades cannot assume a new
  launcher already exists.
- **Legacy-layout detection must respect the new ownership boundary.** The first
  convention installer may encounter `$HOME/.local/bin/mirror`, but that path
  is outside the allowed `.guiho` locations. It must report PATH shadowing and
  give explicit user-run cleanup guidance without deleting or mutating the
  legacy file.
- **Process termination is security-sensitive.** PID alone is insufficient.
  The planned registry must verify process-start identity and executable path
  immediately before termination, handle PID reuse, and never terminate the
  active upgrader, launcher, or descendants.
- **Agent policy is caller governance, not caller detection.** The CLI must
  expose strict effective values and provenance, while the main skill governs
  AI behavior. A direct human invocation remains authoritative; adding an
  unreliable agent-detection heuristic would create a new security boundary.

### Medium

- The proposed 25-asset set is sufficient. Convention 0001 requires selected
  payloads and launchers but not a second helper family. Installer scripts can
  verify the selected payload, then invoke its hidden non-public lifecycle
  entrypoint backed by the shared Go transaction engine. The count remains a
  manifest consequence, not a policy.
- Project `mirror.yaml` removal during uninstall must be limited to an
  explicitly resolved project scope and a file that can be attributed to
  Mirror initialization. Default removal must never search parent or sibling
  repositories.
- The `agent.evolution` enum and merge table must be copied exactly from the
  convention into requirements/tests before implementation. Prompt guidance
  alone is insufficient; command boundaries must enforce the effective value.
- Strict XDocs coverage may surface pre-existing problems in `.github/` and
  `.vscode/`. The tooling unit must classify and repair those findings rather
  than re-excluding tracked owned directories.

### Low

- Keep the raw SemVer contract independent from human-readable build metadata;
  `mirror version` may remain the diagnostic surface.
- Generated examples should be round-trip tested through their corresponding
  strict decoders so schema/example drift cannot recur.

## Architecture Qualities

### Cohesion

The stable launcher, immutable payloads, relative pointer, complete release
manifest, and installed ownership manifest form one coherent lifecycle model.
Removing any one of them would reopen installer, upgrade, rollback, or
uninstall findings.

### Failure safety

The durable phase journal, snapshot-before-mutation rule, first-action
recovery, process-owned lock, confined temp directory, and post-activation
verification provide a testable rollback boundary. The plan must retain all of
these properties in the same foundational package rather than duplicating
partial transactions in each command.

### Maintainability

One Cobra tree, strict Go structs, deterministic generators, a central release
matrix, and a central install-state package avoid split authorities. Standalone
scripts remain necessary public entrypoints, but golden fixtures and shared
manifest semantics must prove their parity with the Go lifecycle.

### Security and ownership

Path confinement, strict manifest decoding, checksum verification, archive
hardening, PID/path/start-time checks, exact managed markers, and default
preservation of shared/user-owned files address the major trust boundaries.
No secret or privileged-install surface is introduced.

## Required Planning Conditions

The implementation plan must:

1. map every `CLI-001` through `CLI-031` finding to at least one unit and
   recurrence test;
2. isolate authority/tooling, CLI/config, agent, release, launcher/state,
   installer, upgrade, uninstall, and final documentation/CI work in ordered
   pull requests;
3. name branch/worktree/path ownership and overlap exclusions per unit;
4. include exact-head independent review, exact-head validation, integration,
   and cleanup gates for every pull request;
5. create a question ledger per unit and stop on any unsealed product,
   ownership, or platform question;
6. keep all real user-global lifecycle tests inside redirected fixtures;
7. defer version application, tagging, pushing, publication, and public
   installation tests to separately authorized work;
8. treat the identity decision and two Windows native proofs as explicit gates.

## Approval Boundary

The second review approves using the architecture as the source for the full
plan, subject to identity, shared-skill, and human-approval gates. It does not
authorize an implementation branch, real process termination, a release, or
production mutation.
