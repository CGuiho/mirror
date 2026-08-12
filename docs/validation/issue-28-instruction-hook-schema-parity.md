---
name: Issue 28 Instruction Hook Schema Parity Validation
purpose: Preserve reproducible local execution evidence for the GitHub issue 28 schema-parity fix.
description: Local evidence that the committed public schema equals the production Go generator output, that the accepted hook matrix is encoded with its negative restrictions, and that runtime fixtures agree.
created: 2026-08-12
updated: 2026-08-12
owner: mirror-docs-validation
flags: [local-complete, xdocs-blocked]
tags: [mirror, validation, schema, hooks]
keywords: [issue 28, mirror.schema.json, schema parity, instruction hooks]
---

# Issue 28 Instruction Hook Schema Parity Validation

## Execution Context

- Execution base: clean `main` at `9238b4e274fea918e6be0a08247a38c84a57d95e`
  (the approved planning commit), verified before any edit.
- Authorized workflow deviation: the human explicitly authorized direct work on
  `main` with commits and pushes, overriding the plan's dedicated branch,
  isolated worktree, and pull-request gates. No branch, worktree, or pull
  request was created. Parent Codex independently reviews the pushed `main`
  head; the `0049`/`0050`/`0052` lifecycle agents were not invoked.
- Available-skill deviation: `guiho-s-0023-plan-executor` is not installed on
  this machine, so execution followed the complete
  `guiho-a-0048-plan-executor.AGENTS.md` contract directly.
- Changed paths: `pkg/config/config_test.go`, `mirror/schema/mirror.schema.json`
  (S28-01); `mirror/schema/schema.xdocs.md`, `todo.md`,
  `docs/todo/issue-28-instruction-hook-schema-parity.md`,
  `docs/validation/issue-28-instruction-hook-schema-parity.md`, and
  `docs/validation/validation.xdocs.md` (S28-02).
- No-change decisions: `README.md`, `mirror/DOCS.md`, `TECHNICAL.md`, and
  `embed/skills/guiho-s-mirror/SKILL.md` already describe the accepted hook
  object contract correctly and were left untouched, as the plan required.

## Local Evidence

| Gate | Outcome |
| --- | --- |
| Mismatch reproduction | Passed: committed artifact (3861 bytes) differs from `config.JSONSchema()` (53360 bytes); committed hooks use unrestricted `patternProperties` while the generator emits closed per-event `properties`. |
| Artifact parity regression | Passed: `TestSchemaArtifactParity` failed on the stale artifact with an actionable regeneration message, then passed after mechanical regeneration. |
| Deterministic regeneration | Passed: a second `go run . config schema` produced no diff against the committed file. |
| Structural schema contract | Passed: `TestJSONSchemaHookContract` proves string, non-empty list, and object alternatives for all 21 canonical events and all 21 aliases; canonical instruction events expose `instructions`/`commands` with `anyOf` requirement; internal and alias events are command-only (`required: [commands]`, no `instructions` property); hooks and object alternatives are closed (`additionalProperties: false`, no `patternProperties`); empty values are rejected (`minLength`/`minItems`). |
| Runtime positive fixture | Passed: `go run . config check --config <issue-28 positive fixture>` prints `ok` (exit 0) for `after:plan` with an `instructions` object. |
| Runtime negative fixtures | Passed: `before:commit.instructions` and `before_apply.instructions` are rejected by `config check` (exit 1); `TestLoadRejectsInvalidHookContracts` covers unknown event, unknown field, `{}`, empty lists, empty instruction string, empty command string, internal instructions, and alias instructions. |
| Focused tests | Passed: `go test -count=1 ./pkg/config`. |
| Full Go validation | Passed: `go test -count=1 ./...` with Git-for-Windows `bash.exe` for POSIX installer tests. |
| Vet | Passed: `go vet ./...`. |
| Formatting | Passed: `gofmt -l .` returned no paths. |
| Module graph | Passed: `go mod tidy` made no changes. |
| Configuration | Passed: `go run . config check` on the repository configuration. |
| CLI contracts | Passed: `go run . --help-tree` and `go run . --help-docs`. |
| Diff hygiene | Passed: `git diff --check` clean; explicit-path status contains only owned paths. |

## XDocs Validation

`xdocs meta`, `xdocs tree`, and `xdocs doctor` remain blocked by the
repository's existing `xdocs.yaml` `scan.exclude` shape:
`scan.exclude entries must be non-empty directory names` (slash-delimited
entries such as `devops/build-binaries`). The failure reproduces unchanged and
pre-dates this task; `xdocs.yaml` was not edited. Touched descriptors
(`mirror/schema/schema.xdocs.md`, `docs/validation/validation.xdocs.md`) were
manually verified: frontmatter is valid, document-map entries are accurate, and
parent/child links are unchanged. No new XDocs error was introduced.

## Delivery

- Commit 1 `0e0a033` (S28-01): parity test and refreshed schema artifact.
- Commit 2 (S28-02): documentation and task-state updates.
- Both commits pushed to `main` with a plain push (no force).

## Pending Gates and Release Boundary

- Raw `main` URL verification of `mirror/schema/mirror.schema.json` must run
  after these commits are visible at
  `https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/schema/mirror.schema.json`.
- Independent review by parent Codex is pending and is the binding acceptance
  gate for the pushed `main` head.
- A compatible `patch` Mirror bump is recommended after integration, but version
  application, tagging, publication, and tag-pinned URL verification remain
  separately approval-gated; `mirror/v*` tags trigger the production
  publication workflow.
