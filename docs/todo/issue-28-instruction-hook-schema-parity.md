---
name: Issue 28 Instruction Hook Schema Parity
purpose: Define the required outcome and completion signals for GitHub issue 28.
description: Tracks parity between Mirror's production Go JSON Schema generator and the committed schema served to YAML editors.
created: 2026-08-12T15:06:30+02:00
updated: 2026-08-12T23:59:00+02:00
flags:
  - approved
  - implementation-ready
tags:
  - mirror
  - schema
  - hooks
  - bugfix
keywords:
  - issue 28
  - mirror.schema.json
  - instruction hooks
  - JSON Schema
  - yaml-language-server
owner: mirror-docs-todo
---

# Issue 28 Instruction Hook Schema Parity

## Summary

Mirror's production Go runtime accepts canonical instruction-hook objects, and
`pkg/config.JSONSchema()` describes them, but the committed schema used by the
`mirror init` YAML association is a stale artifact from the archived TypeBox
implementation. This makes editor validation reject valid configuration such
as `hooks."after:plan".instructions` even though `mirror config check` accepts
it.

## Todo Index

- Task: `Issue 28 Instruction Hook Schema Parity`
- Status: testing
- Index: [todo.md](../../todo.md)
- External: [CGuiho/mirror#28](https://github.com/CGuiho/mirror/issues/28)
- Plan: [issue-28-instruction-hook-schema-parity.md](../plans/issue-28-instruction-hook-schema-parity.md)

## Outcome

The checked-in `mirror/schema/mirror.schema.json` is a deterministic byte-for-
byte representation of the production Go-generated schema, accepts every hook
shape that the runtime supports, rejects the same unsupported hook shapes, and
is the artifact referenced by newly initialized `mirror.yaml` files and later
served from `main` and release tags.

## Scope

### In scope

- Establish the production Go generator as the sole authority for the
  committed schema artifact.
- Refresh `mirror/schema/mirror.schema.json` from that generator.
- Add regression coverage that fails whenever generated and committed schema
  bytes diverge.
- Exercise representative positive and negative hook-schema cases, including
  canonical instruction objects and command-only/internal-event constraints.
- Correct XDocs metadata that still describes the artifact as TypeBox-
  generated.
- Record the implementation review, validation, delivery, and deferred release
  evidence required by the repository lifecycle.

### Out of scope

- Redesigning the accepted hook model from issue #24.
- Restoring the archived Bun/TypeScript generator as an authority.
- Changing hook execution order, command trust, runtime parsing, or the schema
  URL written by `mirror init` unless implementation evidence finds a separate
  defect.
- Adding a new schema-validation dependency without a concrete need proven
  during implementation.
- Applying a Mirror version, creating or pushing a tag, publishing a release,
  or changing production state without separate authorization.

## Acceptance Signals

- `mirror/schema/mirror.schema.json` exactly matches `config.JSONSchema()` plus
  the repository-standard trailing newline.
- The schema accepts the issue reproduction with a canonical `after:plan`
  `instructions` object.
- The schema accepts command strings, command lists, command objects, and
  canonical major-event objects containing instructions and/or commands where
  the runtime accepts them.
- The schema rejects unknown events and object fields, empty hook objects,
  empty strings/lists, instructions on internal write/commit/tag/push events,
  and instructions on compatibility aliases.
- Runtime focused tests remain green, and a committed-artifact parity test
  prevents reintroducing drift.
- The `mirror init` schema association still targets the raw `main` artifact;
  no duplicate schema path is introduced.
- Relevant descriptors identify the production Go generator as authoritative.
- Independent implementation review and validation bind to the exact pull-
  request head before integration.
- Raw `main` URL verification occurs only after merge; tag-pinned URL
  verification occurs only after a separately authorized patch release.

## Dependencies and Context

- Approved hook architecture: [Mirror Hooks Design](../2026-06-07-mirror-hooks-design.md).
- Prior implementation plan: [Mirror v4.1.0 Hooks](../plans/mirror-v4.1.0-hooks.md).
- Production schema generator: `pkg/config.JSONSchema()` in
  `pkg/config/config.go`.
- Publication artifact: `mirror/schema/mirror.schema.json`.
- Schema association: `cmd/init.go` writes the raw GitHub `main` URL.
- Baseline approved for plan review: clean `main` at
  `9b6ca24a43da4ae121a6797e5017cbf26a58e961`.

## Lifecycle Phase Waivers

Application/feature brainstorm, new product requirements, new architecture,
decision recording, and architecture review are waived for this bounded defect.
GitHub issue #28 supplies the exact reproduction and expected behavior, while
accepted issue #24, the hook design, runtime implementation, user docs, and
focused tests already define the intended contract. The work changes schema
publication parity, not product behavior or architecture.

## Watch-outs

- Do not hand-maintain a partial hook schema independently of
  `pkg/config.JSONSchema()`.
- A structural spot-check is not a substitute for exact generated/committed
  parity.
- The static artifact lives under the historical `mirror/` directory but is
  still the public path referenced by production `mirror init`; do not treat it
  as disposable legacy code.
- Do not broaden this bug fix into README, `mirror/DOCS.md`, `TECHNICAL.md`, or
  embedded-skill rewrites when they already describe canonical hook objects
  accurately; update them only if execution finds a concrete mismatch.
- Do not edit `xdocs.yaml` merely to work around the pre-existing installed-
  XDocs validation error.

## Before Starting

- Rebase the implementation branch on the then-current `origin/main`, record
  the actual base commit, and re-run the mismatch reproduction before editing.
- Set this task to `in progress`; do not implement on `main`.
- Read the plan, issue #28, accepted hook design, production config code, static
  artifact, init schema association, repository instructions, and required Go
  CLI/XDocs skills.
- Stop if overlapping user changes affect owned paths or if the Go-generated
  schema no longer represents the intended hook contract.

## While Working

- Limit ownership to the files declared by the approved plan and preserve
  unrelated dirty-worktree changes.
- Keep schema generation deterministic and test the committed artifact from a
  repository-relative path that works on supported developer and CI platforms.
- Use disposable fixtures for validation; do not mutate real release state or
  global agent installations.
- Record material unattended questions in the plan's question ledger and use
  only safe, reversible answers; a material contract conflict requeues the
  plan instead of silently redesigning hooks.

## After Finishing

- Move the task to `testing` before full validation.
- Obtain independent implementation review and validation for the exact PR
  head, then use the integration agent for merge and cleanup.
- Record a Mirror `patch` recommendation after integration; do not apply it
  until release effects are separately authorized.
- Verify the raw `main` schema after merge and verify a tag-pinned URL only
  after an authorized release exists.

## Execution State

- Execution base: clean `main` at `9238b4e274fea918e6be0a08247a38c84a57d95e`.
- Authorized deviation: the human explicitly authorized implementation directly
  on `main` with commits and pushes, overriding the plan's branch, worktree,
  and pull-request gates. No branch, worktree, or pull request was created;
  parent Codex independently reviews the pushed `main` head. The
  `0049`/`0050`/`0052` lifecycle gates are superseded by that direct-main
  authorization.
- Available-skill deviation: `guiho-s-0023-plan-executor` is not installed on
  the execution machine; `guiho-a-0048-plan-executor` was followed directly.
- S28-01 completed at commit `0e0a033`: exact generated-versus-committed parity
  regression and hook-matrix structural assertions in `pkg/config/config_test.go`,
  mechanically refreshed `mirror/schema/mirror.schema.json`.
- S28-02 completed: `mirror/schema/schema.xdocs.md` no longer attributes the
  artifact to TypeBox; `todo.md` and this spec moved to `testing`; local
  validation evidence recorded in
  [docs/validation/issue-28-instruction-hook-schema-parity.md](../validation/issue-28-instruction-hook-schema-parity.md).
- No-change decisions: `README.md`, `mirror/DOCS.md`, `TECHNICAL.md`, and the
  embedded Mirror skill already describe canonical hook objects correctly and
  were left untouched.
- Pre-existing XDocs blocker recorded: `xdocs.yaml` `scan.exclude` entries are
  slash-delimited paths and fail with `scan.exclude entries must be non-empty
  directory names`; `xdocs.yaml` was not edited and touched descriptors were
  manually verified.
- Mirror decision: recommend `patch` after integration; version application,
  tagging, publication, and tag-pinned URL verification remain separately
  authorized.

## References

- [todo.md](../../todo.md)
- [Issue #28](https://github.com/CGuiho/mirror/issues/28)
- [Issue #24](https://github.com/CGuiho/mirror/issues/24)
- [Implementation plan](../plans/issue-28-instruction-hook-schema-parity.md)
