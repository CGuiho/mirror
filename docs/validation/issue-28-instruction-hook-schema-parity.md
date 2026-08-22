---
name: Issue 28 Instruction Hook Schema Parity Validation
purpose: Preserve reproducible local execution evidence for the GitHub issue 28 schema-parity fix.
description: Local evidence that the committed public schema equals the production Go generator output, that the accepted hook matrix is encoded with its negative restrictions, and that runtime fixtures agree.
created: 2026-08-12
updated: 2026-08-13
owner: mirror-docs-validation
flags: [complete, release-verified]
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
- Available-skill deviation: `guiho-s-0023-plan-executor` was unavailable in
  OpenCode's installed skill registry, so execution followed the complete
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

The original implementation run was blocked by the repository's former
path-shaped `scan.exclude` entries and therefore used manual changed-scope
verification. The follow-up
[XDocs scan exclusion repair](xdocs-scan-exclusion-configuration.md) removed the
invalid entries and normalized the issue-28 companion dates exposed by the
restored scan. Repository-wide strict metadata, tree, and doctor validation now
pass with 0 errors and 0 warnings.

## Delivery

- Commit `0e0a033` (S28-01): parity test and refreshed schema artifact.
- Commit `391e664` (S28-02): corrected schema XDocs authority metadata.
- Commit `f6685d0` (S28-02): task state and validation evidence.
- All three commits were pushed to `main` with plain pushes (no force).

## Review and Public Main

- Independent review accepted exact head
  `f6685d017850839cbf201e36fa9f00cbd5853ede` with no blocker or high findings:
  [issue comment](https://github.com/CGuiho/mirror/issues/28#issuecomment-5273331134).
- The raw `main` schema returned HTTP 200, matched the reviewed local artifact
  exactly at 53,360 characters, and exposed three `after:plan` alternatives
  including `instructions`, with hooks closed to unknown events.
- The human authorized the next alpha prerelease. The inspected Mirror plan
  resolved to `mirror/v4.1.0-alpha.2`.

## Release Verification

- Release preparation commit:
  `7f7c74df3249b97bea201291e7005c292d12b0f4`.
- Canonical tag: `mirror/v4.1.0-alpha.2`, peeled to the release-preparation
  commit and confirmed as an ancestor of `origin/main`.
- Publication workflow:
  [31686771287](https://github.com/CGuiho/mirror/actions/runs/31686771287),
  successful, including source checks, exact release build, public asset-set
  verification, and tag-pinned installer verification.
- Tag CI: [31686771264](https://github.com/CGuiho/mirror/actions/runs/31686771264),
  successful across Go quality, installers, and native Linux, macOS, Windows
  AMD64, and Windows ARM64 smoke jobs.
- Public release:
  [`mirror/v4.1.0-alpha.2`](https://github.com/CGuiho/mirror/releases/tag/mirror/v4.1.0-alpha.2),
  non-draft prerelease with exactly eight native executables,
  `guiho-s-mirror.zip`, `guiho-i-mirror.md`, and `checksums.txt`.
- Independent public download: `mirror-windows-amd64.exe` matched the SHA-256
  value in `checksums.txt` and reported `mirror v4.1.0-alpha.2`.
- Tag-pinned schema:
  `https://raw.githubusercontent.com/CGuiho/mirror/mirror/v4.1.0-alpha.2/mirror/schema/mirror.schema.json`
  returned HTTP 200 and matched the committed Go-generated artifact exactly.
