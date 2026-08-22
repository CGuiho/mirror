---
name: GUIHO Convention 0001 CLI Compliance Migration Plan
purpose: Provide a cohesive, branch-aware, independently verifiable implementation sequence for resolving every confirmed compliance finding.
description: Defines ten ordered pull-request units covering authority/tooling, Cobra behavior, dual configuration, agent lifecycle, complete releases, launcher/state foundations, installers, upgrade, uninstall, and final documentation/CI compliance.
created: 2026-08-16
owner: mirror-docs-plans
flags:
  - proposed
  - approval-required
  - breaking-change
tags:
  - mirror
  - plan
  - cli
  - convention-0001
keywords:
  - compliance migration
  - implementation units
  - stable launcher
  - complete release
  - transactional lifecycle
  - exact-head review
---

# GUIHO Convention 0001 CLI Compliance Migration Plan

## Plan Verdict

This is the complete implementation plan, but it is **not yet authorized for
execution**. The code path is fully decomposed; execution is gated on:

1. human confirmation of `mirror`, `guiho-s-mirror`, and `guiho-p-mirror` in
   the identity decision;
2. materialization of the completed second architecture-review readiness
   verdict and human approval of the revised architecture, this plan, and
   review conditions;
3. an exact clean `origin/main` commit containing the approved planning package;
4. separate execution approval for the first unit; and
5. later native Windows evidence gates before lifecycle cutover.

Q-012 is also a pre-execution gate: update/version-pin the canonical Go CLI
skill or explicitly accept the Mirror-only scoped precedence exception.

The plan intentionally permits breaking public changes. It does not authorize
a version bump, tag, push, publication, public installer execution, or mutation
of a real user installation.

## Inputs and Precedence

- Governing convention:
  `C:\GUIHO\guiho\docs\conventions\guiho-convention-0001-cli.md`.
- Audit and 31 findings:
  [GUIHO Convention 0001 CLI Compliance Review](../reviews/implementation/guiho-convention-0001-cli-compliance-review.md).
- Accepted precedence:
  [GUIHO Convention 0001 CLI Authority](../decisions/guiho-convention-0001-cli-authority.md).
- Proposed identity gate:
  [GUIHO Convention 0001 Mirror Identities](../decisions/guiho-convention-0001-cli-identities.md).
- Target architecture:
  [GUIHO Convention 0001 CLI Migration Architecture](../architecture/guiho-convention-0001-cli-migration.md).
- Independent architecture review:
  [Architecture Review](../reviews/architecture/guiho-convention-0001-cli-migration-review.md).
- Task and acceptance contract:
  [GUIHO Convention 0001 CLI Compliance Migration](../todo/guiho-convention-0001-cli-migration.md).
- Question and evidence gates:
  [Question Ledger](../questions/guiho-convention-0001-cli-migration.md).

The repository-root Go/Cobra implementation remains production authority.
Historical Bun/TypeScript code under `mirror/` is read-only evidence unless a
unit explicitly removes a stale public artifact or link. The convention wins
over obsolete exact-11-asset and self-replacement clauses.

## Observed Planning Baseline

- Audited source head: `a65562055d1dd6e879812f5507558dbc39d18f43`.
- Live canonical tags at planning time: latest tag
  `mirror/v4.1.0-alpha.2`; latest stable tag `mirror/v4.0.1`.
- Branch: `main`, tracking `origin/main` at audit time.
- The checkout contained pre-existing modified and untracked documentation;
  these are user-owned and must not be absorbed, reset, or overwritten.
- Go format, tidy diff, full tests, and vet passed at the audited source after
  using the required isolated caches/Git shell/filesystem access.
- Mirror config check and current XDocs checks passed, but RunX failed because
  root `runx.yaml` is absent; XDocs success depended on tracked owned-directory
  exclusions.
- No real user installation, upgrade, rollback, or uninstall was executed.

The execution base is not the audited commit. It must be the exact clean
`origin/main` commit that contains the human-approved architecture, decisions,
plan, reviews, task, question ledger, and descriptors. The controller records
that SHA before creating C0001-00. A different base requires a fresh audit of
all owned files and plan reapproval if behavior or findings changed.

## Delivery Topology

```text
External authority alignment (parent/Superiority handoff)
  -> C0001-00 Repository contracts, RunX, XDocs baseline
  -> C0001-01 Cobra/version/help/list/self-test contract
  -> C0001-02 Project/global config, schemas, examples, evolution policy
  -> C0001-03 Init and complete agent-resource lifecycle
  -> C0001-04 Complete release manifest, payloads, launchers, verifier
  -> C0001-05 Canonical paths, launcher, pointer, journals, locks, native proofs
  -> C0001-06 Complete installers, repair, PATH, legacy-shadow detection
  -> C0001-07 Synchronous manifest-driven upgrade and process coordination
  -> C0001-08 Manifest-driven CLI/POSIX/PowerShell uninstall
  -> C0001-09 CI, publication, docs, final convention audit, release handoff
```

All units are sequential. They share command, release, lifecycle, docs, and
workflow files, so parallel implementation would create unsafe authority drift.
Each unit is one dedicated branch/worktree and one pull request. Main may be
temporarily noncompliant between units, but it must remain buildable and fully
green under that unit's declared transitional contract. No release is cut
until C0001-09 passes.

## Per-Unit Question Ledgers

The [master ledger](../questions/guiho-convention-0001-cli-migration.md) owns
cross-unit decisions. Each executor must update its durable unit ledger before
the first edit and again at PR, review, validation, and integration boundaries:

| Unit | Ledger |
| --- | --- |
| C0001-00 | [C0001-00.md](../questions/guiho-convention-0001-cli-migration/C0001-00.md) |
| C0001-01 | [C0001-01.md](../questions/guiho-convention-0001-cli-migration/C0001-01.md) |
| C0001-02 | [C0001-02.md](../questions/guiho-convention-0001-cli-migration/C0001-02.md) |
| C0001-03 | [C0001-03.md](../questions/guiho-convention-0001-cli-migration/C0001-03.md) |
| C0001-04 | [C0001-04.md](../questions/guiho-convention-0001-cli-migration/C0001-04.md) |
| C0001-05 | [C0001-05.md](../questions/guiho-convention-0001-cli-migration/C0001-05.md) |
| C0001-06 | [C0001-06.md](../questions/guiho-convention-0001-cli-migration/C0001-06.md) |
| C0001-07 | [C0001-07.md](../questions/guiho-convention-0001-cli-migration/C0001-07.md) |
| C0001-08 | [C0001-08.md](../questions/guiho-convention-0001-cli-migration/C0001-08.md) |
| C0001-09 | [C0001-09.md](../questions/guiho-convention-0001-cli-migration/C0001-09.md) |

No empty `none recorded` field is proof that a question was considered. The
executor records exact base/approval and either the question/answer authority or
an explicit `no material deviation` result after reproducing the unit baseline.

## Cross-Repository Prerequisite

Before C0001-00 implementation approval, the lifecycle controller must create
or link a parent `C:\GUIHO\guiho\TODO.md` coordination item for updating the
canonical Go CLI skill/contract in `C:\GUIHO\superiority`. That separately
owned change must remove the contradictory 11-asset, `update`-verb,
self-replacement, and scheduled-Windows requirements and adopt the convention's
manifest/launcher model.

If that update cannot land first, the human must explicitly accept the exact
exception recorded in the authority decision: owner `guiho-a-0001-swe`, Mirror
units C0001-00 through C0001-09 only, no reuse, expiry at canonical-skill update
or C0001-09 final-readiness start, and closure evidence recorded in the parent
TODO/final validation. Every implementation agent references it. This plan does
not authorize edits outside `C:\GUIHO\mirror`.

## Branch, Worktree, and Integration Contract

For each unit `<NN>`:

- refresh remote state and verify a clean canonical `main` worktree;
- record exact `origin/main` base, predecessor merge SHA, and approval in the
  question ledger;
- create branch `codex/mirror-convention-0001-<NN>-<slug>`;
- create a dedicated isolated worktree outside the canonical checkout;
- never implement on `main` or reuse a dirty worktree;
- own only paths enumerated by the unit; preserve unrelated changes;
- stop if another user/agent change overlaps an owned path;
- use smallest coherent explicit-path commits; do not amend unrelated commits;
- push the unit branch only after its local gates pass and push authorization
  is confirmed for that unit;
- open one PR targeting `main` and capture the exact head SHA;
- run `guiho-a-0049-implementation-reviewer` against that exact head without
  fixing it;
- run `guiho-a-0050-validation-reporter` against the same exact head without
  mutating it;
- requeue implementation and repeat both gates after any head change;
- use `guiho-a-0052-pull-request-integrator` only after accepted review,
  validation, required CI, approval, and mergeability all bind to that head;
- verify the merged commit is reachable from refreshed `origin/main`; and
- remove the merged branch/worktree only after integration proof.

Review and validation reports are materialized by the integration lifecycle,
not committed by the implementation executor to the PR head. No unit may
silently absorb work from a later unit.

For every unit, `guiho-a-0048-plan-executor` owns implementation on the isolated
branch/worktree, `guiho-a-0049-implementation-reviewer` owns independent review,
`guiho-a-0050-validation-reporter` owns exact-head evidence, and
`guiho-a-0052-pull-request-integrator` owns merge/reachability/cleanup. The
`guiho-a-0001-swe` controller owns requeue and approval-boundary decisions.

Per-unit integrated evidence paths are:

```text
docs/reviews/implementation/guiho-convention-0001-cli-migration-C0001-<NN>.md
docs/validation/guiho-convention-0001-cli-migration-C0001-<NN>.md
```

Final integrated evidence paths are:

```text
docs/reviews/implementation/guiho-convention-0001-cli-compliance-final-review.md
docs/validation/guiho-convention-0001-cli-migration-final.md
```

Create a separate `docs/todo/guiho-convention-0001-cli-release.md` only if the
human later authorizes release preparation; source compliance does not imply a
release task.

## Common Engineering Rules

- Load the root/parent instructions, lifecycle controller, Go CLI engineering,
  RunX, XDocs, and Mirror skills applicable to the unit.
- Use Go/Cobra/standard library and existing dependencies; a new dependency
  requires an explicit architecture/plan requeue and license/security review.
- Strictly decode one YAML/JSON document into typed structs; reject unknown
  fields and path traversal.
- Keep `CGO_ENABLED=0` and the current eight-target payload matrix.
- Use redirected fixture roots for home, shared GUIHO root, temp, repositories,
  network catalog, PATH/profile/registry, process registry, and installed state.
- Never read secret-bearing files or print environment values.
- Never run semantic version apply against the real repository during testing.
- Never execute install/upgrade/uninstall against the developer's real home.
- Preserve exit codes 0/1/2/3/4/5/130 and test error-class boundaries.
- Keep current compatible background version checks nonmutating and bounded.
- Update touched XDocs descriptors in the same unit and run strict validation.

## Traceability Matrix

| Audit finding | Primary unit(s) | Required recurrence proof |
| --- | --- | --- |
| CLI-001 missing RunX | C0001-00 | Root check/list and catalog parity test/documented inventory. |
| CLI-002 XDocs exclusions/gaps | C0001-00, C0001-09 | Strict full-tree meta/tree/doctor includes tracked owned directories. |
| CLI-003 obsolete repository contracts | C0001-00, C0001-09 | Contract search rejects current-authority 11-asset/self-replace/scheduled text. |
| CLI-004 decorated `--version` | C0001-01 | Native and command tests assert raw SemVer only. |
| CLI-005 invalid help-tree depth | C0001-01 | Parser/table tests for default/max/>1 and rejection of 1/invalid values. |
| CLI-006 missing global-flags toggle | C0001-01 | Live-tree snapshots with and without inherited globals. |
| CLI-007 comma-aware list flags | C0001-01 | Repetition/comma preservation tests for every list flag. |
| CLI-008 `update` agent verbs | C0001-01, C0001-03 | Live help/docs expose `upgrade`; obsolete public verb rejected/hidden. |
| CLI-009 one config contract | C0001-02 | Separate strict loaders, paths, schemas, diagnostics, and fixtures. |
| CLI-010 incomplete init | C0001-02, C0001-03 | Twice-run clean/drifted init matrix and partial-failure rollback. |
| CLI-011 absent evolution policy | C0001-02, C0001-03 | Merge truth table and enforced disabled/always-ask/always-proceed command tests. |
| CLI-012 missing schemas/examples | C0001-02, C0001-04 | Generated-byte parity, strict example loads, release presence. |
| CLI-013 AGENTS reconciliation gap | C0001-03 | Missing-file, surrounding-content, marker-corruption, idempotency tests. |
| CLI-014 incomplete main skill | C0001-03, C0001-09 | Resource assertions, skill validator/semantic checks, and final native install/repair/upgrade lifecycle proof. |
| CLI-015 missing main setup prompt | C0001-03, C0001-09 | Asset identity/content tests, offline bootstrap scenario, and final native installed-artifact proof. |
| CLI-016 missing uninstall scripts | C0001-08 | Both scripts parse and pass parity/fixture acceptance. |
| CLI-017 installer catalog/channel gap | C0001-06 | Paginated exact/stable/prerelease selection matrix. |
| CLI-018 incomplete release set | C0001-04 | Manifest-derived exact-set verifier accepts payloads, launchers, neutral artifacts, manifest, and checksums only. |
| CLI-019 partial install/no ownership | C0001-04, C0001-06 | Complete download plus installed-manifest ownership/repair tests. |
| CLI-020 direct payload/no launcher | C0001-05, C0001-06 | Canonical layout, forwarding, exact exit, fallback, reinstall tests. |
| CLI-021 wrong temp root | C0001-05, C0001-06 | Descendant validation and cleanup escape-negative tests. |
| CLI-022 nontransactional install | C0001-05, C0001-06 | Failure injection at every phase restores byte-exact prior state. |
| CLI-023 PATH duplication/wrong dir | C0001-06 | Twice-run native user-PATH fixture tests for `.guiho/bin`. |
| CLI-024 late/incomplete candidate validation | C0001-01, C0001-04-C0001-07 | Pre-activation version/format/target/resources/self-test negatives. |
| CLI-025 missing recovery blocks | C0001-07 | Golden first/final block for success, dry run, and every error class. |
| CLI-026 self-replacement/async Windows | C0001-05, C0001-07 | Native synchronous immutable activation; no detached replacement helper or scheduled authority. |
| CLI-027 partial upgrade/no channel | C0001-04, C0001-07 | Complete catalog/release/reconciliation/retirement tests. |
| CLI-028 weak concurrency/journal/rollback | C0001-05, C0001-07 | PID reuse, active lock, phase crash/recovery, process and full rollback matrix. |
| CLI-029 incomplete uninstall | C0001-08 | Shared grouped plan/flags/confirmation/ownership/synchronous removal tests. |
| CLI-030 stale README | C0001-09 | Documentation contract test/manual link/ordering verification. |
| CLI-031 obsolete CI/publication proof | C0001-04, C0001-06-C0001-09 | Native workflows prove each supported lifecycle and exact manifest set. |

## Transitional Compatibility Policy

- Do not publish any intermediate unit.
- Old direct-layout reading may exist only in C0001-06's migration adapter and
  must be ownership-proved, tested, and removed from normal post-migration
  execution.
- The old `update` verb and scheduled/self-replacement updater are removed at
  their owning cutover units; they are not kept as documented alternatives.
- The old checked-in `mirror/schema/mirror.schema.json` loses production
  authority when root schemas and version-pinned release URLs land. It may be
  removed or marked historical in the same unit; it cannot remain a current
  duplicate authority.
- A unit may temporarily retain a test-only legacy reader needed to migrate a
  fixture, but it must be private, time-bounded to C0001-09, and absent from
  generated help and release manifests.

## Entrypoint Routing and Recovery Order

`cmd` owns one narrow argument classifier before Cobra construction; `main.go`
remains a thin executable adapter that passes `os.Args[1:]`, build information,
and system dependencies to `cmd.Run`, maps the result through `cmd.ExitCode`,
and exits. It contains no token recognition, lifecycle branching, lock/recovery,
resource mutation, network work, or Cobra registration. The classifier and its
tests preserve these mutually exclusive routes:

1. Raw version, help, help-docs, help-tree, and hidden self-test routes never
   bootstrap resources, recover lifecycle state, print update notices, or start
   background workers. Their exact stdout/stderr contracts remain isolated.
2. Argument-free `mirror` never performs lifecycle recovery. It suppresses
   notices/workers, checks that no pending journal/lock makes the active
   manifest or pointer unsafe, and then performs only bounded resource
   reconciliation plus the banner. If pending recovery blocks a safe
   bootstrap, it fails closed before resource mutation and prints the exact
   recovery command; it does not repair the transaction itself.
3. `mirror upgrade` suppresses notices/workers, completes local-only argument,
   target/channel, platform, and recovery-template validation, then prints the
   first executable recovery block as its first operational output. A normal
   invocation next acquires the lifecycle lock, performs first-action journal
   recovery, and only then performs catalog/network work or installed-state
   mutation.
4. `mirror upgrade --dry-run` follows the same local-validation, first-block,
   and lock-inspection order, but never mutates. If a pending journal exists it
   fails closed with recovery guidance before network work; otherwise it may
   read the catalog and render the complete plan without applying recovery or
   changing installed state.
5. The reserved `__lifecycle` route is recognized outside Cobra only for a
   verified staged payload with a valid operation token and confined staging
   authority. It suppresses notices/workers, acquires the lock, performs
   first-action recovery, revalidates the staged release, and then may mutate.
6. Other state-dependent commands encounter pending-journal handling before
   ordinary Cobra dispatch. The router either completes safe typed recovery
   under the lifecycle lock or fails closed with exact guidance; it never lets
   notices/workers race recovery. Raw-contract and argument-free exceptions are
   exactly the routes above.

Table-driven routing tests cover every route, ambiguous/abbreviated spellings,
invalid reserved tokens, pending/no-pending journal state, lock contention,
dry-run, and stdout ordering.

## Unit C0001-00 - Authority, RunX, and Full XDocs Baseline

### Outcome

Current repository authorities explicitly adopt Convention 0001, development
workflows are cataloged from root RunX, and XDocs covers the actual tracked
repository before behavior changes begin.

### Dependencies and gates

- Q-001 through Q-003 accepted.
- Architecture and this plan approved.
- Cross-repository Go CLI skill/parent handoff linked.
- Exact approved execution-base SHA recorded.

### Branch and ownership

- Branch: `codex/mirror-convention-0001-00-tooling`.
- Owned: `AGENTS.md`, `TECHNICAL.md`, `docs/rfc/mirror-go-rewrite-rfc.md`,
  `runx.yaml`, `xdocs.yaml`, root/module `*.xdocs.md`, this task/plan/question
  state, and focused contract tests/scripts under `devops/` if needed.
- Excluded: production Go behavior, installers/updaters, workflows, generated
  binaries, historical Bun source, and unrelated dirty documentation.

### Work

1. Re-audit the exact base and update the question ledger/TODO to `in progress`.
2. Replace current-authority 11-asset/direct-payload/self-replacement/scheduled-
   Windows/`update` clauses with the accepted target and explicit release
   authorization boundary. Preserve historical documents as clearly labeled
   evidence.
3. Add schema-current root `runx.yaml` with only the permanent base selectors
   whose commands exist and pass in C0001-00: tidy diff, full tests, vet, config
   check, live help, and XDocs checks. Do not add placeholder selectors. Each
   later unit adds its permanent focused selector in the same PR as the command,
   package, fixture, or harness it executes; release and lifecycle selectors
   therefore cannot appear before their owning units.
4. Validate RunX without allowing its managed-instruction bootstrap to create
   unrelated `AGENTS.md` changes; if installed RunX necessarily reconciles a
   block, record and review that exact owned change instead of accepting a
   surprise mutation.
5. Remove tracked `.github` and `.vscode` from XDocs exclusion. Exclude only
   valid generated/vendor directory names. Add/fix descriptors for root,
   `cmd`, `embed`, `pkg`, `devops`, `.github`, `.vscode`, schemas/examples, and
   all new documentation modules. Repair surfaced metadata/tree problems.
6. Add a deterministic repository contract check that scans current-authority
   docs (not historical records) for prohibited obsolete clauses.

### Verification

- `runx check --format json` and `runx list --format json` succeed and list the
  expected selectors.
- Every selector present in the C0001-00 catalog has an existing exact command,
  and both its direct command and `runx run <uid>` pass; no future placeholder
  or selector replacement is accepted.
- `xdocs meta . --documents --strict`, `xdocs tree`, `xdocs doctor .`, and
  `git diff --check` pass with no tracked owned directory hidden.
- `git status --short` contains only unit-owned changes; no generated `bin/` or
  user-owned files are absorbed.
- Go format/tidy/test/vet remain green even though behavior is unchanged.

### Commit and handoff

Use coherent commits for (a) authority docs, (b) RunX catalog, and (c) XDocs
coverage/repairs if each independently passes its checks. Update TODO/ledger in
the final unit commit. PR review verifies that no tooling command mutates real
global state. Mirror version decision: deferred; documentation/tooling alone
does not authorize or settle a semantic-version target.

## Unit C0001-01 - Cobra, Version, Help, Lists, Agent Verbs, and Self-Test

### Outcome

The live Cobra tree implements the convention's public command/flag semantics
and exposes a hidden candidate self-test suitable for later lifecycle gates.

### Dependencies and gates

- C0001-00 integrated and exact merge SHA recorded.
- No product question open; identity values are accepted but this unit does not
  install them.

### Branch and ownership

- Branch: `codex/mirror-convention-0001-01-cli-contract`.
- Owned: `cmd/root.go`, `cmd/root_test.go`, `cmd/helptree.go`,
  `cmd/agent.go`, `cmd/agent_test.go`, new focused self-test code/tests under
  exact paths `cmd/selftest.go` and `cmd/selftest_test.go`, list-flag
  declarations/tests in affected `cmd/*.go`, live help golden fixtures, and
  touched command descriptors/docs. `main.go` is not owned by this unit.
- Excluded: config data model, release set, installers, installed layout,
  updater replacement, uninstall implementation, workflows.

### Work

1. Make the top-level version flags print exact raw SemVer plus newline. Keep
   decorated build/platform information under `mirror version`. Use a valid
   SemVer-compatible development default such as `0.0.0-dev`, not bare `dev`.
2. Replace help-tree depth parsing with the literal `max` or integer `>1`,
   defaulting to `max`. Return usage exit 2 for `1`, zero, negatives,
   fractional/overflow/unknown values.
3. Add persistent `--help-tree-global-flags`. Omit inherited globals from each
   node by default; include them only when requested. Derive both modes from the
   same live Cobra tree and keep deterministic ordering.
4. Replace every user-facing list flag using `StringSlice`/comma splitting with
   repeated `StringArray` behavior. Test `--flag=a,b` as one literal value and
   repeated flags as ordered values.
5. Rename public agent mutation commands from `update` to `upgrade`; update
   tests/help and reject the obsolete spelling entirely. Do not retain a hidden
   compatibility alias.
6. Add hidden `__self-test` with no shorthand. It verifies executable target
   metadata, raw version validity, command-tree construction, and the reserved
   future protocol version without network or user-global mutation. This is
   incremental ownership: C0001-03 adds embedded resource-catalog checks,
   C0001-04 adds release-manifest/schema compatibility, and C0001-05/C0001-06
   add staged/installed manifest and pointer checks. It emits deterministic
   machine-readable or bounded plain success and stable exit classes.
   Define an explicit `SelfTestCheck` dependency contract and deterministic
   ordered assembler. Command dependencies inject checks; package initialization
   and mutable global registries are forbidden. Base check IDs/order cover raw
   SemVer, target metadata, Cobra-tree construction, and protocol version.
7. Add table-driven whole-tree assertions for required flags on every command,
   no accidental shorthands, and help-doc/help-tree parity.

### Verification

- Focused `go test -count=1 ./cmd/...` plus complete Go suite and vet.
- Built native payload probes for raw version, all help modes, comma-preserving
  list flags, agent verb presence/absence, hidden self-test success/failure.
- Generated Markdown help has deterministic no-diff output.
- RunX command/help selectors and strict XDocs remain green.

### Commit and handoff

Keep version/help/list/verb changes in one public-contract commit when their
tree snapshots are coupled; place hidden self-test in a second coherent commit
if it passes independently. TODO/ledger closes CLI-004 through CLI-008 and the
CLI part of CLI-024. Mirror decision: breaking public CLI change; defer the
SemVer recommendation to a separately authorized post-C0001-09 release task.
Do not apply.

## Unit C0001-02 - Dual Configuration, Schemas, Examples, and Evolution Policy

### Outcome

Mirror has separate strict project/global configuration authorities,
deterministic inheritance, enforceable evolution policy, and release-ready
closed schemas/examples.

### Dependencies and gates

- C0001-01 integrated.
- Accepted CLI home identity fixes the global config path.
- Copy the convention's exact `agent.evolution` fields/enums/defaults into the
  unit ledger before code edits; any ambiguity requeues architecture.

### Branch and ownership

- Branch: `codex/mirror-convention-0001-02-config`.
- Owned: `pkg/config/**`, `cmd/config.go`, relevant config consumers/tests,
  new root `schema/**` and `examples/**`, old production schema association at
  `mirror/schema/**`, `mirror.yaml` only as a validated project example if
  necessary, `devops/test-convention-config/**`,
  `devops/test-fixtures/convention-0001/config/**`, and touched descriptors/
  docs.
- Excluded: init resource mutation, agent prompt bodies, release packaging,
  install/updater/uninstall mechanics, workflows except no generated change.

### Work

1. Split the existing type into project-specific and global-specific Go
   structs without weakening current project semantic-version/hook validation.
2. Implement fixed global path resolution beneath the canonical CLI home and
   explicit/current project resolution only. `--config` changes the project
   path only. Eliminate any hidden parent search or cross-file fallback.
3. Strictly decode one YAML document with known fields, validate both files
   independently, and preserve configuration exit 3. Diagnostics name the
   exact file/kind without leaking values.
4. Implement effective policy merge: compiled always-ask defaults, then global
   fields, then project fields, then only a permitted explicit invocation
   choice. Add a full table covering missing, override, invalid, and
   contradictory combinations.
5. Expose one effective-policy API and machine-readable config output with
   per-field provenance. Tests prove `disabled`, `always-ask`, and
   `always-proceed` resolution. The CLI does not infer whether a direct caller
   is human or agent; the main skill consumes and enforces this contract.
6. Generate committed root `schema/mirror.schema.json` and
   `schema/mirror.global.schema.json` deterministically from the production Go
   types. Close properties and encode nonempty/enum constraints.
7. Add minimal `examples/mirror.example.yaml` and
   `examples/mirror.global.example.yaml`. Strict-load and semantically validate
   both; generate/compare them if a deterministic generator is appropriate.
8. Move production authority away from historical `mirror/schema/`; remove the
   duplicate or label it historical, update descriptors, and add exact
   generated/committed parity tests.
9. Change schema URL construction to an exact selected SemVer release URL.
   Unit tests validate canonical tag escaping/path and reject `main`/branch
   URLs. Actual init writing lands in C0001-03.
10. Extend `config check/show/path/schema` behavior to report both resolved
    paths and select project/global/effective output explicitly, preserving
    machine-readable stability and redaction.

### Verification

- Focused config tests cover strict unknowns, multiple documents, absent/global
  creation prerequisites, path confinement, effective policy truth table,
  schema closure, exact artifact parity, examples, URLs, and exit codes.
- `go run . config check` passes against a disposable repository/global home;
  malformed project and global fixtures fail independently with exit 3.
- `go test -count=1 ./...`, vet, generated no-diff, RunX, and strict XDocs pass.

### Commit and handoff

Suggested commits: (a) split types/loaders/path/merge, (b) generated schemas and
examples/parity, (c) CLI diagnostics and docs. Do not commit generated artifacts
without their recurrence test. TODO/ledger closes CLI-009, CLI-011, and the
config/schema portion of CLI-012. No auth/data/database migration; global file
creation is deferred to init/install. Mirror version remains deferred.

## Unit C0001-03 - Common Init and Complete Agent Lifecycle

### Outcome

Initialization and singular agent commands idempotently create/repair the
complete accepted agent/config set while enforcing evolution policy and
preserving user-authored instruction content.

### Dependencies and gates

- C0001-02 integrated.
- Main skill and main prompt IDs explicitly accepted.
- Agent Evolution and Feedback wording reviewed against the convention.

### Branch and ownership

- Branch: `codex/mirror-convention-0001-03-agent-init`.
- Owned: `cmd/root.go`, `cmd/selftest.go`, new
  `cmd/selftest_resources.go`, their focused tests, `cmd/init.go`,
  `cmd/init_test.go`, `cmd/agent.go`,
  `cmd/agent_test.go`, `pkg/maintenance/**`, `embed/embed.go`,
  `embed/skills/guiho-s-mirror/**`, moved
  `embed/instructions/guiho-i-mirror.md`, new
  `embed/prompts/guiho-p-mirror.md`, related descriptors, README/DOCS sections
  only as necessary to test current behavior, plus
  `devops/test-convention-agent-init/**` and
  `devops/test-fixtures/convention-0001/agent-init/**`.
- Excluded: release builder/manifest, launcher/install state, scripts, updater,
  uninstall, workflows.

### Work

1. Define a typed embedded resource catalog with accepted IDs, contained paths,
   digests, projection modes, and required-resource validation used by
   `__self-test` and later release manifest generation. Extend C0001-01's
   ordered assembler with the `embedded-resources` check; do not replace the
   dependency contract.
2. Write the main setup prompt with remote install/recovery, common init, raw
   version verification, config locations, complete repair, and safe failure
   guidance. It must work when no current payload is usable.
3. Update the main skill with the complete AI-managed lifecycle, exact
   install/upgrade/uninstall commands, evolution enforcement, CLI Evolution and
   Feedback section, configuration precedence, and current hook trust boundary.
   Remove obsolete `update`, partial asset, direct path, and asynchronous
   upgrade guidance.
4. Keep the instruction prompt as the bounded managed block source. Reconcile
   both missing and existing `AGENTS.md`, validate exact markers, preserve all
   surrounding bytes/newline style, refuse corrupt/duplicate marker layouts,
   and make repeated runs byte-idempotent.
5. Implement the exact nested tree: `agent skill install|uninstall|upgrade|list|show`,
   `agent instruction apply|remove|upgrade|show`, and
   `agent prompt list|show`. Each action uses declared IDs; prompt commands are
   read-only. Same-version skill/instruction upgrade verifies and repairs
   drift. Removal touches only exact owned projections/blocks.
6. Teach the main skill to read the effective `agent.evolution` values and
   provenance before governed agent actions. `always-ask` produces an
   actionable consent boundary, `always-proceed` may proceed only within the
   declared scope, and `disabled` performs no action and does not ask. Direct
   human CLI invocation remains authoritative. Record agent decisions without
   secret/environment disclosure.
7. Rebuild `mirror init` as the common sequence: canonical directories, global
   config create/validate, project config create/validate, complete resource
   reconciliation, managed instruction reconciliation, resolved-path/policy
   report, config/self checks. When policy choices are needed, explain all
   three values, recommend `always-proceed`, offer it for all four governed
   actions, and if declined ask separately for upgrade, bugs, improvements, and
   reviews; skipped answers remain `always-ask`. Inject all filesystem/UI
   decisions for tests.
8. Preserve Mirror-specific interactive/flag authority and current safe Git
   defaults. Use version-pinned schema associations from C0001-02.
9. Add failure injection so no half-written resource or config survives; where
   project and global files already exist, preserve their user contents.
10. Preserve the compatible argument-free `mirror` bootstrap by routing it
    through the same typed embedded resource catalog without version/release
    effects; it must not become a second resource implementation and must never
    recover a lifecycle transaction. If pending recovery makes resource
    ownership unsafe, fail closed before reconciliation with the exact recovery
    command, without notices/workers or the banner. This is a staged transition:
    C0001-05 binds it to active installed-manifest authority before any
    convention-compliant release can be installed or published.

### Verification

- Twice-run tests for empty, complete, missing, drifted, corrupt-marker,
  read-only/failure-injected, noninteractive, and evolution-policy fixtures.
- Semantic resource assertions verify frontmatter IDs, main prompt distinction,
  required sections, no obsolete verb/model, and embedded catalog completeness.
- `__self-test` fails when any required embedded resource is missing/mismatched.
- Full Go/vet, config checks, live help/docs, RunX, and strict XDocs pass.

### Commit and handoff

Suggested commits: (a) resource catalog/reconciliation, (b) skill/prompt bodies,
  (c) common init/evolution enforcement. Commit bodies note breaking `update`
  removal. TODO/ledger closes CLI-010, CLI-013, and the agent half of CLI-011.
  CLI-014/CLI-015 become structurally complete but remain provisionally open
  until C0001-09 proves their documented commands and installed projections
  through native executable lifecycles. No global real-home mutation or release
  effect.

## Unit C0001-04 - Complete Release Manifest, Builder, and Verifier

### Outcome

One deterministic manifest describes and verifies the complete convention
release, including all payloads, launchers, agent resources, schemas, examples,
checksums, canonical paths, projections,
persistence, and retirement behavior.

### Dependencies and gates

- C0001-03 integrated.
- All artifact identities accepted and embedded resource catalog stable.
- Launcher interface and pointer schema from architecture frozen for build
  implementation; actual runtime behavior lands in C0001-05.

### Branch and ownership

- Branch: `codex/mirror-convention-0001-04-release-manifest`.
- Owned: `pkg/release/**`, `devops/build-binaries.go` and tests,
  `devops/verify-release-assets/**`, new manifest generator/schema fixtures,
  `devops/launcher/**` build entrypoint, `cmd/selftest.go`, new
  `cmd/selftest_release.go`, and their focused tests, release assets sourced
  from `embed/`, `schema/`, `examples/`, `devops/test-convention-release/**`,
  `devops/test-fixtures/convention-0001/release/**`, and touched descriptors.
  C0001-04 does not own `cmd/root.go`.
- Conditional: `.github/workflows/ci.yml` only for build-only exact-set jobs;
  publication/lifecycle jobs remain C0001-09.
- Excluded: installer/upgrade/uninstall behavior and real installed state.

### Work

1. Version and strictly define `artifacts.json`, stable artifact IDs, allowed
   relative canonical/projection paths, platform selectors, digests/sizes,
   executable modes, persistent/replaceable/retired semantics, and contained
   resource identities and an explicit empty agent-definition set. Reject
   absolute/traversal/collision/shared-root claims. The installed manifest
   records the exact selected `artifacts.json` digest.
2. Move release-catalog pagination, exact/channel selection, compatibility, and
   complete-asset filtering into `pkg/release`. Leave `pkg/update` responsible
   only for cached notices and the bounded nonmutating background check.
3. Keep the current eight payload targets and add eight matching launcher
   targets. Preserve static flags: CGO off, AMD64 v1, ARM64 v8.0, ARMv6/v7
   GOARM selection, injected exact SemVer/commit/RFC3339 build date/target.
4. Produce the manifest-derived complete set, currently expected to be 25
   assets, from one central matrix. Copy agent resources, two schemas, and two
   examples from their production sources. Generate the manifest only after
   managed asset bytes are final. The manifest contains no self digest and no
   checksum-file digest. Generate deterministic sorted checksums last so they
   cover `artifacts.json` and every other asset except `checksums.txt`. Never
   make 25 an independent policy.
5. Extend verification from hard-coded count to manifest authority while still
   rejecting missing and unexpected release files. Verify filename/ID/path
   consistency, digest/size, checksum exactness/sort, target/native headers,
   raw version, embedded target, resource identity, schema/example validity,
   launcher compatibility, and manifest schema version.
   Extend C0001-01's ordered self-test assembler with the
   `release-manifest-protocol` check to prove the embedded resource inventory
   and supported release-manifest/schema protocol agree; installed state
   remains C0001-05/06.
6. Add negative fixtures for every integrity class and a second-build byte-
   determinism test with identical inputs.
7. Update build CLI/help/RunX selector and correct `--directory` usage in
   current authorities. Do not restore a contradictory `--dir` contract.

### Verification

- Exact release build in a disposable output directory, never hand-editing
  ignored `bin/`.
- Verifier accepts exactly the generated set and rejects each mutated fixture.
- Checksum entries equal `{artifacts.json} + {every ordinary asset declared by
  artifacts.json}`. `checksums.txt` excludes itself; assertions derive the
  expected set/count from the manifest matrix plus these two metadata rules.
- Native current-platform payload raw-version/self-test smoke plus structural
  launcher header, target-metadata, schema, and payload-compatibility checks.
  C0001-04 does not execute the launcher or claim forwarding, fallback,
  activation, or installed-state behavior; those runtime proofs begin in
  C0001-05. All other targets build and receive correct build-only labels.
- Full Go/vet, RunX, XDocs, deterministic second build, and optional CI build
  matrix pass.

### Commit and handoff

Suggested commits: (a) manifest model/validation, (b) launcher build target and
complete builder, (c) verifier/negative fixtures/CI build job. TODO/ledger
closes CLI-018 and release portions of CLI-012/019/027/031. Main must not be
tagged while installers still use the old contract. C0001-04 output is a
build/verification fixture, not an installable or publishable release, until
C0001-05/C0001-06 close launcher/state/installer ownership. Mirror version
deferred.

## Unit C0001-05 - Canonical Install State, Stable Launcher, and Native Proofs

### Outcome

Reusable Go foundations implement confined canonical paths, strict installed
state, stable launch/fallback, durable transactions, rollback, recovery, locks,
instance identity, and the Windows feasibility proofs required by later units.

### Dependencies and gates

- C0001-04 integrated.
- Native Windows runner/developer fixture access approved for harmless isolated
  early proofs; no real installed Mirror process is targeted. Native macOS is a
  C0001-09 final evidence gate, not a plan-drafting prerequisite.

### Branch and ownership

- Branch: `codex/mirror-convention-0001-05-launcher-state`.
- Owned: new `pkg/installstate/**`, `pkg/installer/**`, `pkg/processes/**`,
  `internal/launcher/**`, `devops/launcher/**`, thin `main.go`, new
  `cmd/dispatch.go`, `cmd/dispatch_test.go`, `cmd/root.go`, `cmd/selftest.go`,
  new `cmd/selftest_installed.go`, focused entrypoint/platform tests,
  `devops/test-lifecycle.ps1`,
  `devops/test-fixtures/convention-0001/**`, and related descriptors. C0001-05
  does not conditionally alter the release-manifest contract: if an accepted
  field/invariant is missing, stop and requeue C0001-04 plus architecture/plan
  review before continuing.
- Excluded: public installers, `cmd/upgrade.go`, public updater cutover,
  uninstall surfaces, user PATH, workflows except focused native test wiring.

### Work

1. Implement a root-injected path resolver for `.guiho/bin`, `.guiho/.temp`,
   CLI home, versions, pointer, installed manifest, state/cache/data, locks,
   journals, and instances. Resolve and confine every operation; test symlink/
   junction/traversal and broad-root rejection on supported platforms.
2. Define strict versioned installed-state models. `current.json` contains only
   `schema`, `installation_id`, `active`, and optional `previous`; each pointer
   entry contains `version`, `payload_artifact_id`, `relative_path`, `sha256`,
   and `artifacts_manifest_sha256`. `installed-artifacts.json` contains only
   `schema`, `installation_id`, `release_version`, `release_tag`, `target`,
   `artifacts_manifest_sha256`, `canonical_artifacts[]`,
   `managed_projections[]`, and `persistent_paths[]`. Canonical artifacts carry
   artifact ID, root, relative path, digest, size, mode, persistence,
   replacement, and retirement. Managed projections carry artifact ID,
   destination root, relative path or marker ID, digest, and kind. Persistent
   paths carry root, relative path, and category. Closed root enums are
   `cli-home`, `shared-bin`, `global-agents`, `global-claude`, and
   `project-root`. Store relative paths only and use platform-safe flush/atomic
   replacement.
3. Implement the launcher forwarding protocol and exact exit propagation.
   Verify active identity before start; fall back once only for missing,
   corrupt, or unstartable active payload; never for an application exit after
   start. Bound diagnostics and recovery.
4. Implement a strict transaction journal with `schema`, `operation_id`,
   `installation_id`, `operation`, `phase`, owner token/PID/process-start
   identity, confined staging/snapshot relative paths, source/target manifest
   digests, and started/updated timestamps. Instance records remain limited to
   installation ID, PID, process-start identity, executable path, ancestry, and
   timestamp. Implement operation-owned unique temp creation, snapshot
   inventory, projection operations, activation, post-verification, commit,
   rollback, and first-action recovery. Inject filesystem operations and crash
   points for deterministic tests. Any need for another release-manifest or
   installed-state field stops and requeues the owning architecture/C0001-04
   contract; no opportunistic field is added.
5. Implement locks with random ownership token, PID/start identity, operation,
   and timestamp. Stale takeover proves owner death. Token mismatch cannot
   release another owner.
6. Implement instance registration/cleanup and verified selection using
   installation ID, PID, process-start identity, executable path, and ancestry.
   Provide no termination policy yet; C0001-07 consumes the verified set.
7. Expose the transaction engine through a hidden, versioned, non-public
   lifecycle protocol dispatcher in the selected payload. Intercept it outside
   the Cobra tree, require operation token and confined staging authority, and
   keep it absent from help/docs/tree/suggestions/discovery. It is used later by
   lifecycle scripts after payload verification and is never a public install
   command. Keep `main.go` thin by routing through a testable
   `cmd.Run(args []string, deps RuntimeDependencies) int` seam. Dependencies
   inject stdout/stderr, environment/home resolution, notice/worker scheduling,
   Cobra construction, lock/journal inspection, lifecycle handling, clock,
   process/filesystem operations, and event recording. No test-only public flag
   or environment variable may broaden production roots.
8. Close the staged ownership from C0001-01/C0001-03: extend `__self-test` to
   the ordered `installed-state` check for strict release/installed-manifest and
   pointer validation, and make argument-free bootstrap resolve active manifest-
   declared resources. Remove the transitional embedded-only authority before
   merging.
9. Prove native Windows activation while an old payload is running. Prove a
   synchronous final-removal primitive or narrowly scoped waited finalizer for
   launcher/payload self-uninstall. Record exact evidence E-001/E-002 and
   requeue on failure; do not substitute scheduled success.
10. Prove PID-reuse/path mismatch/unrelated process protection E-003 on native
   Windows and available Linux fixtures. Record the macOS equivalent as E-005
   for C0001-09 before final platform compliance.

### Verification

- Unit/fuzz/property tests for strict JSON, path confinement, manifest-pointer
  consistency, atomic writes, launcher forwarding/fallback, journal recovery,
  locks, PID identity, and snapshot restoration.
- Entrypoint tests prove the reserved lifecycle token is intercepted before
  Cobra construction/dispatch, cannot be discovered through Cobra help/docs/
  tree/suggestions, rejects missing or invalid operation authority, and enters
  first-action recovery before any staged-state mutation.
- Reserved-route negatives cover misspellings, prefixes, aliases, placement
  after `--`, duplicate tokens, missing/unsupported protocol data, invalid
  operation tokens, and unconfined staging. None may fall through to Cobra
  suggestions, completion, or ordinary command handling.
- Failure injection after each phase produces either byte-equivalent old state
  or fully verified new state; never a mixed release.
- Native Windows and current Unix launcher/activation/self-removal proofs run
  against disposable roots/processes. Cross-target launcher builds still pass.
- Race-enabled focused tests where supported, full Go/vet, release verifier,
  RunX, and XDocs pass.

### Commit and handoff

Suggested commits: (a) paths/models/atomic storage, (b) launcher, (c)
transaction/lock/instance primitives, (d) native proofs. The PR cannot merge
with a failed evidence gate; instead update architecture/plan. TODO/ledger
closes foundations for CLI-020 through CLI-022, CLI-026, and CLI-028. No public
lifecycle cutover or real process termination occurs.

## Unit C0001-06 - Complete Install, Reinstall, Repair, PATH, and Legacy Detection

### Outcome

Both standalone installers resolve and verify one complete release, install the
canonical launcher/immutable layout transactionally through the verified staged
payload, repair same-version drift, manage PATH idempotently, and report legacy
PATH shadowing without touching out-of-bound files.

### Dependencies and gates

- C0001-05 integrated with E-001 passing.
- Exact/channel catalog contract and complete manifest stable.
- Explicit permission for fixture-only platform profile/registry tests; no real
  user PATH or installation mutation.

### Branch and ownership

- Branch: `codex/mirror-convention-0001-06-installers`.
- Owned: `devops/install.sh`, `devops/install.ps1`, hidden staged-payload
  lifecycle integration and golden harness under `devops/`/`pkg/installer`,
  `pkg/release` catalog consumers, `devops/test-lifecycle.sh`,
  `devops/test-lifecycle.ps1`,
  `devops/test-fixtures/convention-0001/**`, relevant RunX selectors, README
  install section, and descriptors.
- Excluded: public upgrade cutover, uninstall scripts/flags, publication
  workflow, semantic version application.

### Work

1. Keep both scripts standalone for `curl ... | sh` and `irm ... | iex`.
   Parameterize fixture roots only through explicit test hooks that cannot
   weaken public canonical paths.
2. Support exact SemVer plus stable/prerelease channel selection. Exhaust
   release catalog pages, canonical-tag validate, deduplicate, SemVer sort,
   reject drafts/incomplete releases, and resolve one exact version before
   mutation. Test empty pages, pagination cycles/limits, malformed tags, and
   releases with missing assets.
   Prove Bash/PowerShell phase-zero parity against `pkg/release` shared golden
   catalog fixtures rather than maintaining unreviewed selector semantics.
3. Display selected exact version, channel, shared bin, CLI home, immutable
   version path, and projected resource roots before replacement.
4. Create a unique confined `$HOME/.guiho/.temp/mirror-install-<uuid>` child.
   The script downloads the complete platform-applicable staged release:
   `checksums.txt`, `artifacts.json`, selected payload/launcher, and all target-
   neutral ordinary assets. It verifies the exact checksum graph, strict
   manifest, payload checksum/native target/raw version/hidden self-test, and
   launcher before invoking the payload's hidden lifecycle entrypoint. That
   offline entrypoint revalidates staged state and drives the shared typed
   transaction; it performs no catalog or network/download work. Apply size/
   time bounds and clean only the verified operation child on exits.
   Phase zero also proves that the manifest, release-catalog names, and checksum
   filenames describe all 25 assets. It hashes only downloaded applicable
   bytes; foreign-target byte verification belongs to release verification/CI.
5. Before snapshots/activation, verify every checksum, manifest relationship,
   native payload/launcher format and embedded target, raw payload SemVer,
   launcher compatibility, schemas/examples, agent resources, and staged
   payload `__self-test`.
6. The hidden lifecycle dispatcher acquires the lock, performs prior-journal
   recovery as its first locked action, and then revalidates every staged byte/
   relationship because another phase-zero operation may have completed. It
   then snapshots every replaceable projection/PATH state, installs the
   immutable version/resources, writes the
   installed manifest, reconcile all projections, remove manifest-retired
   disposable projections, apply the idempotent user PATH addition, atomically
   activate, and verify raw version plus `__self-test` through the stable
   launcher.
7. A failure before final commit restores pointer, installed manifest, versions,
   projections, and only the installer's own uncommitted PATH addition while
   preserving pre-existing persistent/user files. After success, print that the
   managing agent runs `mirror init` and raw version verification; do not make a
   streamed noninteractive installer depend on interactive setup. A later init
   failure cannot roll back the verified installation: report init recovery
   guidance, and let a repeated init repair only its owned config/resource
   state.
8. Make same-version installation a full verification/repair, not an early
   no-op. Test missing/corrupt payload, launcher, prompt, skill, schema, example,
   manifest, and managed block independently.
   After successful installation, plain installed `mirror` must resolve the
   exact installed manifest for bounded skill/instruction reconciliation and
   reject missing/corrupt ownership rather than falling back to filename or
   embedded-only guessing. This closes C0001-03's transitional installed mode.
9. Add `.guiho/bin` to the platform-resolved user PATH exactly once without
   admin/root. POSIX edits one selected user profile through a marker or exact
   entry; PowerShell updates user environment safely. Twice-run and variant
   separator/casing tests prove idempotency and preservation.
10. Detect legacy `.local/bin/mirror` and PATH shadowing, report their exact
    resolved paths, and preserve them because they are outside the convention's
    ownership boundary. After canonical launcher verification, print an
    explicit user-run cleanup instruction; do not execute it. Record E-004.
11. Ensure remote recovery/install commands can pin the exact version and
    channel syntax used later by upgrade.

### Verification

- POSIX parser plus real `dash` streamed twice-run install/repair fixtures.
- Windows PowerShell parser plus real `Invoke-Expression` twice-run fixtures.
- Offline fake release server covers all selection/pagination/integrity/failure
  cases without public network dependence.
- Failure injection at download, validation, snapshot, copy, projection, PATH,
  activation, launcher verification, installed raw-version check, installed
  self-test, and transaction commit restores the entire prior fixture.
  Interactive `mirror init` is a separately printed post-install handoff and is
  never part of the installer transaction or its rollback matrix.
- Fresh install, same-version repair, previous-version transition, retired
  artifact cleanup, legacy detection/reporting, out-of-bound preservation, PATH
  idempotency, and temp cleanup pass on native runners.
- Full Go/vet, release build/verifier, RunX, XDocs, and native launcher smoke.

### Commit and handoff

Suggested commits: (a) catalog/download/common fixtures, (b) POSIX transaction,
  (c) PowerShell transaction, (d) repair/PATH/legacy guidance/docs. Keep public
  scripts and parity tests together when one without the other would be unsafe.
  TODO/ledger closes CLI-017, CLI-019 through CLI-024 for installation. No
  public installer is executed and no release is published.

## Unit C0001-07 - Synchronous Complete-Release Upgrade

### Outcome

`mirror upgrade` completes recovery, selection, complete verification,
immutable installation, safe instance handling, activation, resource
reconciliation, post-verification, and rollback synchronously in its original
invocation with mandatory first/final recovery blocks.

### Dependencies and gates

- C0001-06 integrated.
- E-001 and E-003 pass on required native platforms.
- Installer exact-version recovery syntax is stable and independently tested.

### Branch and ownership

- Branch: `codex/mirror-convention-0001-07-upgrade`.
- Owned: `main.go`, `cmd/root.go`, `cmd/upgrade.go`, entrypoint/upgrade command
  tests, `pkg/updater/**`, relevant `pkg/release/**` catalog APIs, consumed
  `pkg/installstate/**`, `pkg/installer/**`, and `pkg/processes/**`, removal of
  obsolete detached self-replacement files, upgrade help/docs, RunX selector,
  C0001-07 scenarios in `devops/test-lifecycle.sh`,
  `devops/test-lifecycle.ps1`, and
  `devops/test-fixtures/convention-0001/**`, descriptors, focused CI lifecycle
  jobs if necessary.
- Excluded: uninstall behavior/scripts, final publication workflow, real
  installation/processes.

### Work

1. Add `--channel` and exact-version request parsing using the same normative
   catalog contract as installers. Complete only local argument, mutually
   exclusive target/channel, platform, and recovery-template validation at
   this stage; suppress update notices/workers and do not start catalog network,
   process, journal-recovery, or filesystem work.
2. Generate the platform-specific exact remote reinstall recovery block from
   one tested function/template. After local validation, print a usable first
   block as the first operational output and before release resolution, lock,
   recovery, process, or filesystem work. Print it again as the final output
   block for success, dry run, interruption, and every failure. Pin the final
   block to resolved exact SemVer when available; otherwise retain the requested
   exact/channel recovery.
3. Acquire the process-owned lifecycle lock, then recover any incomplete
   transaction before network work. Reject an actively owned lock; never use
   age alone for takeover. Resolve the exhaustive exact/channel catalog only
   after recovery. Dry run never recovers or mutates: after its first block it
   acquires/inspects the lock, fails closed before network if a pending journal
   exists, and otherwise resolves the catalog only to report the full planned
   version/artifact/path changes.
4. Stage under unique confined `.guiho/.temp/mirror-upgrade-<uuid>`. Download
   manifest/checksums then the complete release; perform every C0001-06
   pre-activation validation, including staged raw version and `__self-test`.
5. Enumerate registered instances, immediately reverify PID/start identity/
   executable path/install identity, and terminate only other instances of the
   previous owned payload. Exclude the active upgrader, launcher, descendants,
   and mismatches. Bound graceful/forced handling; refusal/timeout rolls back.
6. Install immutable target/resources, snapshot and reconcile the complete
   projection set, remove retired owned artifacts, atomically switch
   `current.json`, then run raw version and hidden self-test through the stable
   launcher before commit.
7. Persist every journal phase. Crash/failure recovery either completes a
   verified intended transition where unambiguous or restores the complete
   previous pointer/manifest/version/projections. Reconciliation failure cannot
   leave mixed payload/agent/schema state.
8. Remove live executable overwrite, adjacent staging, detached Windows replacement helper,
   `scheduled` result, and next-invocation completion consumption from current
   code/tests/docs. Historical review records may retain explicit past facts.
9. Preserve background update check behavior as cache-only/nonmutating and
   keep release catalog timeout/streaming limits.
10. Wire interrupted-transaction recovery before ordinary command dispatch.
    Raw version, help, help-docs/tree, and hidden self-test bypass notices and
    repair output so their exact stdout contracts remain unchanged. Argument-
    free `mirror` never recovers and instead fails closed before bootstrap if
    recovery is required. A state-dependent command that cannot safely dispatch
    until recovery completes fails with exact recovery guidance. No route starts
    background update notices/workers before recovery safety is established.

### Verification

- Golden recovery output: first bytes/block and final terminal block for exact,
  stable, prerelease, no-update, dry-run, network, integrity, lock, process,
  activation, self-test, rollback, and interrupt outcomes.
- Catalog pagination/channel/exact and complete-asset negative matrix.
- Phase-by-phase crash/restart recovery and byte-equivalent rollback matrix.
- Entrypoint ordering tests prove interrupted-transaction recovery precedes
  ordinary Cobra command dispatch, while raw version/help/help-docs/help-tree/
  hidden self-test retain their exact output bypass and unsafe commands fail
  with the prescribed recovery guidance.
- Multiple instance tests cover PID reuse, path mismatch, child preservation,
  active upgrader preservation, graceful exit, timeout, and no unrelated kill.
- Native Unix/Windows older-to-newer, exact downgrade if permitted by explicit
  target, same-version repair, corrupt target, fallback, and synchronous
  completion fixtures.
- Source/current-doc search contains no live replacement, detached replacement
  helper authority, scheduled result, or deferred completion authority. The
  selected payload's verified hidden lifecycle entrypoint remains explicitly
  allowed for standalone scripts.
- Full Go/vet/race-appropriate tests, release verifier, installer regressions,
  RunX, XDocs, and native CI lifecycle jobs pass.

### Commit and handoff

Suggested commits: (a) recovery output/selection, (b) manifest transaction,
  (c) instance coordination/native cutover, (d) obsolete updater removal and
  docs/tests. TODO/ledger closes CLI-025 through CLI-028 and upgrade parts of
  CLI-024/031. Do not execute the real command outside a redirected fixture.
  Mirror version remains deferred.

## Unit C0001-08 - Shared Manifest-Driven Uninstall

### Outcome

The Cobra command and mandatory POSIX/PowerShell scripts produce the same exact
ownership-bounded uninstall plan, preservation/confirmation semantics, rollback
behavior, and synchronously verified removal.

### Dependencies and gates

- C0001-07 integrated.
- E-002 synchronous Windows self-removal proof accepted.
- Installed manifest/persistent classification and legacy detection boundary
  are stable.

### Branch and ownership

- Branch: `codex/mirror-convention-0001-08-uninstall`.
- Owned: `cmd/uninstall.go`, `cmd/uninstall_unix.go`,
  `cmd/uninstall_windows.go` or their replacements, new
  `devops/uninstall.sh`, `devops/uninstall.ps1`, shared uninstall planner/state
  code under `pkg/installstate/**` and `pkg/installer/**`, hidden staged-payload
  lifecycle integration, C0001-08 scenarios in `devops/test-lifecycle.sh`,
  `devops/test-lifecycle.ps1`, and
  `devops/test-fixtures/convention-0001/**`, tests/golden fixtures, uninstall
  docs/RunX, and descriptors.
- Excluded: publication workflow except focused CI job wiring, semantic version
  apply, real home/project/process mutation.

### Work

1. Build one typed uninstall plan from strict installed/release manifests,
   canonical paths, selected project scope, persistence classes, and flags.
   Plan entries have exact path, artifact/ownership reason, and REMOVE/PRESERVE
   group. Reject traversal, missing ownership proof, or shared-root claims.
   Missing, corrupt, incompatible, or path-unsafe ownership state fails closed
   with exact installer-repair guidance before destructive mutation.
2. Implement convention flags `--preserve-config`, `--preserve-data`,
   `--dry-run`, and `--yes`; remove nonstandard `--keep-agent-resources` from
   public help under the accepted breaking policy.
3. Default removal includes owned versions, launcher, manifests, cache/state,
   CLI data/config, agent resources/projections, and the explicitly resolved
   project config where ownership/scope is proven. Preservation flags retain
   exact declared categories and their necessary parent directories. Project
   config is limited to the explicitly resolved current project; never search
   parents, siblings, or other repositories.
4. Always preserve shared `.guiho` directories, unrelated `.guiho/bin` entries,
   specifically `$HOME/.guiho/`, `$HOME/.guiho/bin/`, and
   `$HOME/.guiho/.temp/`; preserve the shared `$HOME/.guiho/bin/` PATH entry,
   other CLIs, unrelated PATH entries, entire user-authored `AGENTS.md` files,
   text outside exact managed markers, and any unmanifested/unproved path.
5. Print exact grouped plan before mutation. Interactive terminal requires
   confirmation unless `--yes`; rejection exits success/no change or the
   convention-defined code. Noninteractive destructive execution without
   `--yes` fails before mutation. Dry run never prompts/mutates.
6. Acquire lifecycle lock, recover prior transaction, snapshot reversible
   projections/config categories, remove in safe dependency order, always
   preserve the shared `.guiho/bin` user PATH entry, and verify every
   selected target is absent before success. Roll back failure before the final
   self-removal boundary where possible; print exact recovery when not.
7. Use the accepted synchronous Unix/Windows self-removal primitive. Wait and
   verify launcher/payload/finalizer deletion. Never return `scheduled` or
   success while selected owned artifacts remain.
8. Make `devops/uninstall.sh` and `.ps1` standalone remote entrypoints. They
   resolve the installed exact release, download the complete platform-
   applicable set through phase-zero adapters, validate full 25-asset catalog/
   manifest/checksum filenames, hash every downloaded byte, verify native/raw-
   version/self-test gates, then invoke reserved non-Cobra `__lifecycle`
   offline. They prove `pkg/release` golden catalog parity, expose the same
   flags/groups/confirmation, and do not depend on a healthy current payload.
9. Add parity golden tests so CLI and both scripts agree on REMOVE/PRESERVE
   sets and terminal behavior for every flag combination.

### Verification

- Truth table for TTY/non-TTY, yes/no, dry run, preserve config/data/both,
  missing/corrupt manifest, partial install, legacy-shadow detection, absent install,
  and managed instruction edge cases.
- Exact grouped plan golden files contain no guessed/unowned/shared targets.
- Native POSIX/PowerShell twice-install-then-uninstall fixtures prove complete
  default removal, each preservation option, shared PATH preservation, entire
  `AGENTS.md` preservation, other-CLI coexistence, and synchronous self-removal.
- Failure injection and interruption prove bounded recovery/rollback and no
  false success.
- Full Go/vet, script parsers, installer/upgrade regressions, release verifier,
  RunX, XDocs, and native CI jobs pass.

### Commit and handoff

Suggested commits: (a) shared planner/flags/goldens, (b) Cobra integration,
  (c) POSIX script, (d) PowerShell/native self-removal, (e) parity/docs. TODO/
  ledger closes CLI-016 and CLI-029. No real uninstall or public remote script
  invocation is authorized. Mirror version remains deferred.

## Unit C0001-09 - CI, Publication, Documentation, Final Audit, and Release Handoff

### Outcome

All current authorities, workflows, generated assets, and user docs describe
and prove one Convention 0001-compliant CLI; a fresh audit has no findings and
the separately approval-gated release handoff is complete.

### Dependencies and gates

- C0001-00 through C0001-08 integrated in order.
- Shared Go CLI skill/contract alignment completed; temporary exception closed.
- Required native runners available. Targets without claimed runtime support
  may be labeled build-only, but that alternative does not waive E-005: native
  macOS lifecycle evidence remains mandatory for Mirror's claimed macOS support
  on both `darwin-amd64` and `darwin-arm64`. If either corresponding native
  runner is unavailable or fails, stop and requeue architecture/planning; do
  not narrow support claims inside C0001-09 execution.

### Branch and ownership

- Branch: `codex/mirror-convention-0001-09-final-compliance`.
- Owned: `.github/workflows/ci.yml`, `.github/workflows/publish.yml`,
  `README.md`, `mirror/DOCS.md`, `TECHNICAL.md`, current RFC/instructions,
  embedded skill/prompts, help docs, RunX/XDocs configs/descriptors, release
  tools/tests only for gaps found by final audit, final native scenarios in
  `devops/test-lifecycle.sh`/`devops/test-lifecycle.ps1`, new
  `devops/audit-convention-0001/**`,
  `devops/test-fixtures/convention-0001/**`, `todo.md`, task/question ledger,
  and lifecycle review/validation descriptors materialized by the controller/
  integrator.
- Excluded: new product features, historical record rewrites, any release
  effect, parent/Superiority files.

### Work

1. Replace CI's 11-asset and direct-install assertions with manifest-derived
   complete-release build/verification and native lifecycle matrices. Run
   format, tidy diff, full/race-appropriate tests, vet, config/schema/example
   parity, help, self-test, RunX, XDocs, installer/reinstall/repair, upgrade/
   recovery/rollback/process, and uninstall/preservation suites.
2. Use native Linux/macOS/Windows runners for claimed runtime behavior and
   available ARM64 runners for ARM64 claims. Label ARMv6/v7 and targets without
   runtime-support claims build-only; never present cross-compilation as runtime
   validation. Build-only labeling cannot substitute for E-005 while macOS is
   a claimed runtime platform. Run `darwin-amd64` on native Intel macOS and
   `darwin-arm64` on native Apple Silicon macOS.
3. Make publication consume `artifacts.json`, require every declared asset,
   verify checksums/semantics again after download/upload, preserve canonical
   `mirror/v<semver>` tags and channel rules, and reject missing/extra assets.
   Publication remains dormant without an authorized tag.
4. Rewrite README install examples for channel/exact selection and canonical
   layout, immediately follow with raw `mirror --version`, document init/config/
   evolution/agent/upgrade recovery, and make the final operational section
   exactly `## Uninstall` with both remote commands, destructive warning, dry
   run, and combined preservation example.
5. Align `mirror/DOCS.md`, `TECHNICAL.md`, Go RFC, AGENTS, embedded skill and
   prompts, generated help, schemas/examples, current plans/TODOs, and XDocs.
   Historical Bun/past reviews may state old facts but cannot be current
   authority.
6. Fix every README/AGENTS command spelling, including verifier `--directory`.
   Add current-authority search tests for obsolete 11 assets, `.local/bin`
   default, self-replace, scheduled/deferred upgrade, `agent update`, mutable
   schema URL, missing final Uninstall, and partial release claims.
7. Build the exact complete release twice from fixed inputs and prove
   determinism. Run native payload/launcher/install/repair/upgrade/rollback/
   uninstall acceptance on disposable fixture roots. From the documented
   installer interface, run the separately managed post-install `mirror init`,
   verify raw `mirror --version`, then exercise repair and upgrade. Prove that
   the projected skill, instruction, and main setup prompt bytes match the
   installed manifest, every setup-prompt command is executable and source-
   faithful, and offline argument-free bootstrap reconciles manifest-declared
   resources idempotently.
8. Re-run the entire original convention aspect list against the exact PR head.
   Create a new exact-head validation report with per-finding closure and
   residual platform evidence; do not overwrite the original audit.
9. After local implementation and native acceptance pass, move the task to
   `testing` before the final C0001-09 status commit/push and exact-head gates.
   The executor never marks it completed. Completion belongs to the controller/
   integrator only after accepted 0049/0050 review/validation, 0052 integration,
   and a zero-finding audit on refreshed merged main. C0001-09 creates only the
   release-readiness handoff: it does not ask for a target, run Mirror planning,
   or pre-create a release TODO. Only the post-integration controller may create
   a separate release task after new Commander authorization.

### Verification

- All direct and RunX-cataloged local gates pass from a clean checkout.
- Strict XDocs meta/tree/doctor plus `git diff --check` covers every tracked
  owned module.
- CI completes every required native/build-only job on the exact PR head.
- Publication workflow dry/static tests prove complete-manifest enforcement
  without creating a release.
- Full generated documentation/help/schema/example/release second-run produces
  no diff.
- Fresh compliance audit explicitly marks CLI-001 through CLI-031 closed and
  separates compliant evidence, unverified platform claims, and authorized-
  release follow-up.
- Implementation reviewer and validation reporter accept the same exact head;
  integrator verifies merged-main reachability and clean branch/worktree.

### Commit and handoff

Suggested commits: (a) CI/native acceptance, (b) publication manifest gates,
  (c) current user/technical/agent docs, (d) final generated/XDocs/TODO state.
  Validation/review evidence follows lifecycle ownership. The exact target is
  deferred to the then-current Mirror plan and a separate approval; no version
  or release effect is authorized here.

## Per-Unit TODO Milestones

Each unit records these checkpoints in the task and question ledger:

1. `approved`: identity/plan/unit execution approval and exact base captured;
2. `in progress`: isolated branch/worktree created and baseline reproduced;
3. `local complete`: unit acceptance and all common gates pass;
4. `PR open`: PR URL and exact head captured;
5. `review accepted`: 0049 verdict binds to exact head;
6. `validation accepted`: 0050 evidence binds to the same head;
7. `integrated`: 0052 proves gates, merge, main reachability, and cleanup;
8. `next unit unblocked`: predecessor merged SHA becomes the next base.

Do not mark the top-level task completed per unit. Record closed audit IDs and
remaining IDs so partial progress cannot be mistaken for full compliance.

## Exact Per-Unit Commands and Fixed Fixtures

C0001-00 creates only selectors whose exact commands and executable harnesses
exist in C0001-00. It does not reserve, stub, document, or create selectors for
C0001-01 through C0001-09. Each later unit creates its permanent selector in the
same commit/PR as the executable command, fixtures, and assertions it invokes.
A UID is never repurposed to materially different behavior; later units may
continue running an earlier selector but cannot silently replace its command.

| UID | Exact command |
| --- | --- |
| `mirror-go-tidy-check` | `go mod tidy -diff` |
| `mirror-go-test` | `go test -count=1 ./...` |
| `mirror-go-vet` | `go vet ./...` |
| `mirror-config-check` | `go run . config check` |
| `mirror-help-tree` | `go run . --help-tree` |
| `mirror-help-docs` | `go run . --help-docs` |
| `mirror-xdocs-meta` | `xdocs meta . --documents --strict` |
| `mirror-xdocs-tree` | `xdocs tree` |
| `mirror-xdocs-doctor` | `xdocs doctor .` |

Obsolete release/install workflows remain under migration freeze and are not
cataloged as supported workflows. The focused selectors are added only by their
owner units:

| Unit | Permanent UID | Exact command |
| --- | --- | --- |
| C0001-01 | `mirror-convention-0001-c01-cli` | `go test -count=1 ./cmd/...` |
| C0001-02 | `mirror-convention-0001-c02-config` | `go run ./devops/test-convention-config --fixture-root .temp/convention-0001/C0001-02/config --fixtures devops/test-fixtures/convention-0001/config --scenario all --format json` |
| C0001-03 | `mirror-convention-0001-c03-agent-init` | `go run ./devops/test-convention-agent-init --fixture-root .temp/convention-0001/C0001-03/agent-init --fixtures devops/test-fixtures/convention-0001/agent-init --scenario all --format json` |
| C0001-04 | `mirror-convention-0001-c04-release` | `go run ./devops/test-convention-release --fixture-root .temp/convention-0001/C0001-04 --fixtures devops/test-fixtures/convention-0001/release --format json` |
| C0001-05 | `mirror-convention-0001-c05-state` | `go test -count=1 ./cmd/... ./internal/launcher/... ./pkg/installstate/... ./pkg/installer/... ./pkg/processes/...` |
| C0001-05 | `mirror-convention-0001-c05-windows` | `powershell.exe -NoProfile -File devops/test-lifecycle.ps1 -FixtureRoot .temp/convention-0001/C0001-05/windows -CatalogFixture devops/test-fixtures/convention-0001/catalog.json -Scenario launcher-state -Format json` |
| C0001-06 | `mirror-convention-0001-c06-install-posix` | `sh devops/test-lifecycle.sh --fixture-root .temp/convention-0001/C0001-06/posix --catalog-fixture devops/test-fixtures/convention-0001/catalog.json --scenario install --format json` |
| C0001-06 | `mirror-convention-0001-c06-install-windows` | `powershell.exe -NoProfile -File devops/test-lifecycle.ps1 -FixtureRoot .temp/convention-0001/C0001-06/windows -CatalogFixture devops/test-fixtures/convention-0001/catalog.json -Scenario install -Format json` |
| C0001-07 | `mirror-convention-0001-c07-upgrade-posix` | `sh devops/test-lifecycle.sh --fixture-root .temp/convention-0001/C0001-07/posix --catalog-fixture devops/test-fixtures/convention-0001/catalog.json --scenario upgrade --format json` |
| C0001-07 | `mirror-convention-0001-c07-upgrade-windows` | `powershell.exe -NoProfile -File devops/test-lifecycle.ps1 -FixtureRoot .temp/convention-0001/C0001-07/windows -CatalogFixture devops/test-fixtures/convention-0001/catalog.json -Scenario upgrade -Format json` |
| C0001-08 | `mirror-convention-0001-c08-uninstall-posix` | `sh devops/test-lifecycle.sh --fixture-root .temp/convention-0001/C0001-08/posix --catalog-fixture devops/test-fixtures/convention-0001/catalog.json --scenario uninstall --format json` |
| C0001-08 | `mirror-convention-0001-c08-uninstall-windows` | `powershell.exe -NoProfile -File devops/test-lifecycle.ps1 -FixtureRoot .temp/convention-0001/C0001-08/windows -CatalogFixture devops/test-fixtures/convention-0001/catalog.json -Scenario uninstall -Format json` |
| C0001-09 | `mirror-convention-0001-c09-native-posix` | `sh devops/test-lifecycle.sh --fixture-root .temp/convention-0001/C0001-09/native-posix --catalog-fixture devops/test-fixtures/convention-0001/catalog.json --scenario full-native --format json` |
| C0001-09 | `mirror-convention-0001-c09-native-windows` | `powershell.exe -NoProfile -File devops/test-lifecycle.ps1 -FixtureRoot .temp/convention-0001/C0001-09/windows -CatalogFixture devops/test-fixtures/convention-0001/catalog.json -Scenario full-native -Format json` |
| C0001-09 | `mirror-convention-0001-c09-final-audit` | `go run ./devops/audit-convention-0001 --repository . --fixture-root .temp/convention-0001/C0001-09/audit --fixtures devops/test-fixtures/convention-0001 --format json` |

Every custom harness emits one JSON result with `status: pass`, positive
`scenarios` and `assertions`, and `failures: 0`. It exits nonzero when either
count is zero, failures are nonzero, or a required fixture/test is absent. The
C0001-09 POSIX selector runs separately on native Linux, Darwin AMD64, and
Darwin ARM64; both Darwin results are mandatory E-005 evidence.

C0001-04 uses these exact fixed build/verifier commands:

```text
runx run --dry-run mirror-convention-0001-c04-release
go run ./devops/build-binaries.go --output .temp/convention-0001/C0001-04/release-a --version 4.1.0-alpha.2 --commit 0123456789abcdef0123456789abcdef01234567 --build-date 2000-01-01T00:00:00Z
go run ./devops/build-binaries.go --output .temp/convention-0001/C0001-04/release-b --version 4.1.0-alpha.2 --commit 0123456789abcdef0123456789abcdef01234567 --build-date 2000-01-01T00:00:00Z
go run ./devops/verify-release-assets --directory .temp/convention-0001/C0001-04/release-a
go run ./devops/verify-release-assets --directory .temp/convention-0001/C0001-04/release-b
go run ./devops/test-convention-release --fixture-root .temp/convention-0001/C0001-04 --fixtures devops/test-fixtures/convention-0001/release --format json
```

The release harness compares both directories byte-for-byte where deterministic
output is required, reports exactly 25 assets, positive scenario/assertion
counts, and zero failures. Checked-in immutable inputs live only under
`devops/test-fixtures/convention-0001/`. Harnesses copy them into the already
ignored `.temp/convention-0001/<unit>/<platform-or-scenario>/` root, redirect
child `HOME`/`USERPROFILE`, CLI home, PATH profile/registry fixtures, catalogs,
and process state there, and fail if a path reaches the real user home or
installation. Cleanup first proves the target is a strict descendant of the
convention root and never recursively removes `.temp/` or
`.temp/convention-0001/` itself.

Installer lifecycle tests invoke the actual public POSIX/PowerShell scripts
from local fixture URLs, assert phase-zero parity with `pkg/release` goldens,
and verify exact exits, output blocks, and filesystem state. Each unit still
runs `runx check --format json` and `runx list --format json`; mutating/high-
impact selectors are first revealed with `runx run --dry-run <uid>`.

## Common Test and Validation Gate

Every unit runs the narrowest focused tests first, then the complete applicable
gate before PR:

```text
gofmt -l .
go mod tidy -diff
go test -count=1 ./...
go vet ./...
go run . config check                    (redirected fixture when global config applies)
go run . --help-tree
go run . --help-docs
runx check --format json
runx list --format json
xdocs meta . --documents --strict
xdocs tree
xdocs doctor .
git diff --check
```

From C0001-04 onward, add exact complete-release build and verification. From
C0001-06 onward, add both installer fixture suites. From C0001-07 onward, add
upgrade/recovery/rollback/process suites. From C0001-08 onward, add all
uninstall surfaces and preservation suites. C0001-09 additionally reruns the
complete installed-agent-resource lifecycle matrix so CLI-014 and CLI-015 are
closed by executable native evidence rather than resource-only tests.

On Windows, use workspace-local `GOCACHE`/`GOMODCACHE` if permissions or
contention require it and Git's `sh.exe` for POSIX fixture syntax. A sandbox
failure must be rerun with the required scoped filesystem access before being
classified as source failure. Never weaken a test to accommodate sandbox
limitations.

## Data, Auth, Cache, and Production Impact

- Data: adds versioned manifests, pointer, journals, instance records, and
  persistent config/data classifications under the accepted CLI home. File
  formats are versioned and strictly decoded. Legacy migration is transactional.
- Auth/secrets: none. Catalog/public release downloads remain unauthenticated
  unless existing GitHub mechanisms require opaque credentials; no values are
  read or printed by agents/tests.
- Cache: background release cache remains disposable; install/upgrade staging
  is operation-owned beneath the shared temp root; uninstall removes cache by
  default and preserves only when the accepted policy says so.
- Database: none.
- API: no service API. CLI flags/output/files/manifests are public contracts and
  receive golden/compatibility tests.
- Production: publication workflow and public installers affect users only
  after a separately authorized release. No plan unit itself changes production.

## Rollback Strategy

- PR rollback: revert one unit's merge only if later units have not depended on
  it; otherwise revert the dependent chain in reverse or fix forward under a
  reviewed recovery plan.
- Runtime rollback: launcher retains a verified previous pointer; lifecycle
  transactions restore complete snapshots and installed ownership state.
- Release rollback: never rewrite a published tag. Use exact-version recovery
  installer guidance and a separately authorized corrective release.
- Documentation rollback: current-authority docs roll back with their owning
  behavior; historical evidence is not rewritten to hide a failed migration.
- Failed native proof: stop/requeue architecture; do not merge a weaker
  asynchronous or unverified substitute.

## Stop and Requeue Conditions

Return to the lifecycle controller/architect/plan writer when any of these
occurs:

- an identity remains unconfirmed or changes;
- the convention or canonical Go CLI skill changes materially;
- exact base no longer reproduces the audited finding/assumption;
- a unit needs paths outside its ownership or overlaps user work;
- a new dependency, privileged operation, secret, service, database, or cloud
  change becomes necessary;
- Windows synchronous activation/self-removal or verified process handling
  cannot be proved;
- the manifest cannot express an ownership/persistence case without claiming a
  shared/user path;
- native validation is unavailable for a claimed runtime target;
- review or validation changes the PR head or returns blocking findings;
- implementation would require version apply, tag, publication, public install,
  or production mutation without explicit authorization.

## Release Decision and Authorization Boundary

This migration is breaking. After C0001-09 is integrated, the Commander first
approves a concrete target. Then run only
`mirror version plan <commander-approved-target>` against the exact clean main
state. Never use argument-free `mirror version plan`, and do not preselect
`major`, `minor`, or a prerelease in this implementation plan. Record the actual
recommendation in a separate release task.

The following remain separately authorized and are not implied by plan
approval or implementation approval: `version apply`, changelog/release commit,
tag creation, push, GitHub Release/publication, npm or other registry work,
remote installer execution, public upgrade/uninstall, and production
verification. Each public artifact set must be reverified after publication.

## Definition of Done

The migration is done only when:

- all ten unit PRs are integrated in order with exact-head review/validation;
- Q-001 through Q-003, Q-012, and E-001 through E-005 are durably closed;
- every traceability row has a passing recurrence test/evidence link;
- no current authority contradicts Convention 0001;
- the exact complete release is deterministic and manifest-verified;
- native lifecycle evidence matches every support claim;
- CLI-014/CLI-015 have native executable install/init/repair/upgrade and
  installed-resource evidence, not content checks alone;
- the task entered `testing` before the final C0001-09 status commit/push and
  before exact-head 0049/0050 gates;
- 0052 integrated that accepted head and verified refreshed-main reachability;
- the final fresh compliance audit against refreshed merged main reports zero
  violations;
- RunX, strict XDocs, Go, release, installer, upgrade, and uninstall gates pass
  from a clean merged main checkout;
- the controller, not the C0001-09 executor, marked the task `completed`; and
- C0001-09 contains only a release-readiness handoff with no release target,
  Mirror plan result, release TODO, or public release effect.

Public release work is not part of this Definition of Done.
