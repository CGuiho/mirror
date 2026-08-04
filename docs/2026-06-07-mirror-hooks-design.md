---
name: Mirror Hooks Design
purpose: Define the current architecture for Mirror lifecycle hooks.
description: Proposed Go and YAML contract for AI-agent instructions, executable commands, lifecycle ordering, error handling, safety, and reporting.
created: 2026-06-07
updated: 2026-08-04
owner: mirror-docs
flags:
  - draft
  - proposed
tags:
  - mirror
  - hooks
  - versioning
  - ai-agents
keywords:
  - Mirror hooks
  - mirror.yaml
  - lifecycle events
  - agent instructions
  - command hooks
  - error hooks
---

# Mirror Hooks — Design Document

## Status

Proposed for [Mirror issue #24](https://github.com/CGuiho/mirror/issues/24)
and targeted for Mirror v4.1.0.

This document supersedes the historical Bun/TypeScript and TOML proposal that
previously occupied this path. The production implementation is the
repository-root Go/Cobra application, and `mirror.yaml` is the only active
configuration format.

This document defines architecture and acceptance criteria. It does not
authorize a version bump, tag, push, publication, or release.

## Decision Summary

Mirror hooks are named lifecycle extensions configured under `hooks` in
`mirror.yaml`. A lifecycle event can contain two independent payload types:

1. **AI-agent instructions** tell a Mirror-aware AI agent what to do at the
   boundary of a major action that the agent orchestrates.
2. **Commands** tell the Mirror Go CLI what shell commands to execute at its
   own lifecycle boundaries.

The AI agent owns the high-level `everything`, `plan`, and `apply` boundaries.
The Go CLI owns those same command boundaries plus the internal `write`,
`commit`, `tag`, and `push` boundaries. Mirror does not invoke an AI agent and
does not pause an apply operation waiting for an agent.

The following principles are normative:

- configuration is strict, typed YAML;
- canonical event names use the exact `before:*`, `after:*`, and `on:*` names
  defined by this document;
- commands execute sequentially in declaration order;
- agent instructions execute sequentially at agent-observable boundaries;
- read-only CLI commands do not execute command hooks;
- `after:<stage>` means that the stage succeeded;
- `on:<stage>-error` means that the stage failed;
- `on:error` runs once for any lifecycle failure;
- `after:everything` is the unconditional finalizer after a hook session has
  started;
- the primary failure is never replaced by a failure in an error or finalizer
  hook;
- hooks do not expand Mirror's existing release authorization or rollback
  guarantees.

## Motivation

Mirror has a deterministic semantic-version workflow but currently exposes no
production Go extension points. Projects need to perform checks, generation,
policy review, notifications, diagnostics, and cleanup at predictable release
boundaries without replacing Mirror's planner or release executor.

Command hooks address deterministic local automation such as tests and
notifications. Agent instruction hooks address judgment-based work such as
reviewing a plan, checking project policy, diagnosing a failed apply, and
summarizing the outcome.

## Goals

- Define one discoverable hook contract in `mirror.yaml`.
- Support AI-agent instructions and executable commands without conflating
  their execution models.
- Cover planning, application, file writing, committing, tagging, pushing, and
  their errors.
- Preserve deterministic order and stable error propagation.
- Preserve stdout-safe JSON reporting and stable Mirror exit codes.
- Keep direct `version plan`, `version next`, `version current`, and
  `config check` read-only.
- Retain the current Go/Cobra, standard-library, and strict-YAML architecture.

## Non-goals

- A general plugin system or in-process extension API.
- Having Mirror launch Codex, Claude, or another AI runtime.
- Pausing an in-progress apply operation for an AI response.
- Concurrent hook execution.
- Command interpolation such as `{version}` templates; hooks receive context
  through environment variables and a JSON context file.
- Platform-condition syntax in `mirror.yaml`; commands may dispatch to their
  own platform-aware scripts.
- Restoring the archived Bun/TypeScript implementation as an authority.

## Terminology

- **Hook session**: one command-hook execution inside `mirror version apply`,
  or one instruction-hook workflow orchestrated by a Mirror-aware AI agent.
- **Stage**: one lifecycle operation: plan, apply, write, commit, tag, or push.
- **Event**: a named boundary such as `before:apply` or `on:push-error`.
- **Major action**: an action directly controlled and observed by an AI agent:
  process start/end, plan, or apply.
- **Internal action**: write, commit, tag, or push inside one Go CLI apply
  invocation.
- **Instruction hook**: one or more natural-language instructions consumed by
  an AI agent.
- **Command hook**: one or more shell command strings executed by the Go CLI.
- **Primary error**: the first error that caused the normal lifecycle to stop.
- **Secondary error**: an error raised while handling or finalizing a primary
  error.

## Configuration Contract

### Canonical YAML

Event names contain colons and are quoted for clarity. Each event maps to an
object containing `instructions`, `commands`, or both. Each payload accepts one
non-empty string or a non-empty list of non-empty strings and normalizes to a
list internally.

```yaml
schema: 1

hooks:
  "before:everything":
    instructions:
      - Read the release policy and identify any unresolved blockers.
    commands:
      - go test -count=1 ./...

  "after:plan":
    instructions:
      - Review every planned file, commit, tag, and push effect.

  "before:apply":
    instructions:
      - Confirm that the planned effects remain explicitly authorized.
    commands:
      - go vet ./...

  "after:write":
    commands:
      - go fmt ./...

  "on:push-error":
    commands:
      - ./devops/report-release-failure.sh

  "on:apply-error":
    instructions:
      - Diagnose the failed stage and report which local or remote effects remain.

  "after:everything":
    instructions:
      - Summarize the release outcome and any remaining recovery work.
```

The example is illustrative. A project should configure only hooks that it
needs, and commands must be valid for the platforms on which the project runs.

### Normalized Go Model

The production configuration model should become equivalent to:

```go
type HookEvent string

type HookDefinition struct {
	Instructions []string `yaml:"instructions,omitempty" json:"instructions"`
	Commands     []string `yaml:"commands,omitempty" json:"commands"`
}

type HooksConfig map[HookEvent]HookDefinition
```

`HookEvent` is a closed set. Unknown event names and unknown fields are
configuration errors. An event definition must contain at least one instruction
or command. Empty strings and empty lists are invalid.

### Command-only Compatibility Input

The current Go configuration parser accepts a hook value as a command string or
list of command strings even though the Go runtime does not execute it. Mirror
v4.1.0 should retain that shape as command-only compatibility input:

```yaml
hooks:
  before_apply:
    - go test -count=1 ./...
```

Compatibility aliases are explicitly enumerated and normalize to canonical
events. For example, `before_apply` maps to `before:apply` and
`on_push_error` maps to `on:push-error`:

```yaml
hooks:
  "before:apply":
    commands:
      - go test -count=1 ./...
```

The canonical form is the event object with an exact quoted event name. Mirror
must not normalize aliases by blindly replacing every underscore because
`on_push_error` contains both an event separator and the hyphenated `push-error`
suffix. Defining both `before_apply` and `before:apply` is a duplicate-field
configuration error. Compatibility input does not allow instruction hooks.

## Supported Events

| Event | AI instructions | Commands | Meaning |
|---|---:|---:|---|
| `before:everything` | yes | yes | Hook session has started after configuration, trust, and authorization checks. |
| `after:everything` | yes | yes | Unconditional finalizer after a started hook session. |
| `before:plan` | yes | yes | Immediately before the relevant plan action. |
| `after:plan` | yes | yes | Plan action completed successfully. |
| `on:plan-error` | yes | yes | Plan action or its normal hooks failed. |
| `before:apply` | yes | yes | Immediately before the relevant apply action. |
| `after:apply` | yes | yes | Apply action completed successfully. |
| `on:apply-error` | yes | yes | Apply action or its normal hooks failed. |
| `before:write` | no | yes | Immediately before the planned file-write batch. |
| `after:write` | no | yes | The complete file-write batch succeeded. |
| `on:write-error` | no | yes | The write batch or its normal hooks failed. |
| `before:commit` | no | yes | Immediately before the planned release commit. |
| `after:commit` | no | yes | The planned release commit succeeded. |
| `on:commit-error` | no | yes | The commit stage or its normal hooks failed. |
| `before:tag` | no | yes | Immediately before the planned annotated tag. |
| `after:tag` | no | yes | The planned annotated tag succeeded. |
| `on:tag-error` | no | yes | The tag stage or its normal hooks failed. |
| `before:push` | no | yes | Immediately before the planned exact pushes. |
| `after:push` | no | yes | All planned pushes succeeded. |
| `on:push-error` | no | yes | Any planned push or its normal hooks failed. |
| `on:error` | yes | yes | One global error hook after applicable stage errors. |

Configuration validation rejects `instructions` on write, commit, tag, or push
events. Those boundaries occur inside a single `mirror version apply` process
and cannot be observed reliably by an external AI agent.

## AI-agent Instruction Lifecycle

### Ownership

A Mirror-aware AI agent reads `mirror.yaml` before beginning semantic-version
work. The embedded `guiho-s-mirror` skill defines how to resolve, validate, and
follow instruction hooks. Instruction hooks remain project-local input:

- they are not copied into global skills or managed instruction blocks;
- they do not gain system, developer, or repository-instruction priority;
- they cannot override safety policy or authorize commits, tags, pushes,
  publications, or other effects;
- the agent must disclose conflicts or instructions it cannot safely follow;
- a standalone Mirror CLI invocation validates but does not execute them.

### Ordered Lifecycle

The agent executes instruction hooks only around actions it directly controls:

```text
before:everything
  before:plan
    agent invokes mirror version plan <target>
    success -> after:plan
    failure -> on:plan-error -> on:error -> after:everything

  before:apply
    agent invokes mirror version apply <target> [authorized flags]
    success -> after:apply
    failure -> on:apply-error -> on:error -> after:everything

after:everything
```

The agent runs instructions within one event sequentially. It evaluates the
result of the major action before selecting `after:*` or `on:*-error`.
Instruction hooks do not run merely because a user invoked Mirror outside an AI
workflow.

An agent normally runs an explicit read-only plan for review before invoking
apply. `mirror version apply` then rebuilds and revalidates its own plan. This is
intentional: instruction plan hooks surround the agent's explicit plan action,
while command plan hooks surround the authoritative plan built inside apply.

If an instruction cannot be completed, the agent treats that as a failure of
the current major stage, reports the reason, and follows the applicable error
path. Error-hook instructions do not recursively trigger more error hooks.

## Go CLI Command Lifecycle

### Session Boundary

Command hooks run only as part of a mutating `mirror version apply <target>`
invocation. Before starting the hook session, Mirror must:

1. resolve and strictly validate `mirror.yaml`;
2. validate the target and CLI flags;
3. obtain explicit apply confirmation;
4. obtain the user's command-hook trust decision.

No hook can run when configuration cannot be resolved or validated. Once
`before:everything` starts, `after:everything` is scheduled as the unconditional
finalizer.

### Ordered Lifecycle

```text
before:everything
  before:plan
    build version plan
    success -> after:plan
    failure -> on:plan-error

  before:apply
    apply preflight

    before:write
      write all planned version files
      success -> after:write
      failure -> on:write-error

    before:commit
      create the planned release commit
      success -> after:commit
      failure -> on:commit-error

    before:tag
      create the planned annotated tag
      success -> after:tag
      failure -> on:tag-error

    before:push
      push the exact planned commit and tag refs
      success -> after:push
      failure -> on:push-error

    success -> after:apply
    failure -> on:apply-error

any failure -> on:error
after:everything
```

When an AI agent orchestrates the complete workflow, the two consumers nest
without executing either payload type twice:

```text
AI before:everything instructions
  AI before:plan instructions
    mirror version plan                         # no command hooks
  AI after:plan instructions
  AI before:apply instructions
    mirror version apply
      CLI before:everything commands
      CLI plan/apply/action commands
      CLI after:everything commands
  AI after:apply instructions
AI after:everything instructions
```

Action hooks are skipped when the corresponding action is absent from the
version plan. `before:write` and `after:write` run once around the complete
contiguous file-write batch, not once per file.

### Nested Error Ordering

Errors propagate from the innermost failed stage to the outer lifecycle. For
example, a push failure executes:

```text
on:push-error
on:apply-error
on:error
after:everything
```

A plan failure executes:

```text
on:plan-error
on:error
after:everything
```

An error in `before:<stage>` or `after:<stage>` is an error in that stage and
uses the same path. `after:<stage>` runs only after successful completion of
the stage action; it is not a finalizer.

Error hooks and `after:everything` are best-effort cleanup/reporting hooks. If
one fails, Mirror records the secondary error and continues the remaining error
and finalizer hooks. The first primary error remains the returned error. If
`after:everything` is the only failure, its failure becomes the primary error;
it does not recursively invoke `on:error`.

Normal events stop their remaining command list on the first failure. Error
events and `after:everything` attempt every configured command so one broken
diagnostic or cleanup command does not suppress the remaining handlers.

## Read-only and Dry-run Behavior

The following commands never execute command hooks:

- `mirror version current`;
- `mirror version next`;
- `mirror version plan`;
- `mirror version apply --dry-run`;
- `mirror config check` and `mirror config show`;
- plain argument-free `mirror`.

This preserves their existing read-only or bounded bootstrap contracts. A
Mirror-aware AI agent may still execute `before:plan`, `after:plan`, or
`on:plan-error` instruction hooks around a read-only plan that it orchestrates.

## Command Execution Contract

### Ordering and Shell

Commands in one event run sequentially in YAML declaration order. A nonzero
exit from a normal hook stops the remaining commands in that event and starts
the applicable error path.

Commands execute in the resolved project root with the parent environment plus
Mirror context variables. Mirror uses the platform shell:

- POSIX: `/bin/sh -c <command>`;
- Windows: `cmd.exe /d /s /c <command>`.

A project that requires PowerShell, Bash, or another interpreter must invoke it
explicitly in the command. Mirror performs no template interpolation.

Command execution inherits CLI cancellation. An interrupted hook terminates the
active child process as far as the operating system permits and maps to Mirror
exit code 130. Automatic hook timeouts and concurrent execution are deferred
beyond v4.1.0.

### Environment Variables

Every command hook receives:

| Variable | Availability | Meaning |
|---|---|---|
| `MIRROR_HOOK_EVENT` | always | Canonical event name. |
| `MIRROR_HOOK_KIND` | always | `command`. |
| `MIRROR_CWD` | always | Resolved project root. |
| `MIRROR_CONFIG_PATH` | always | Resolved configuration path. |
| `MIRROR_TARGET` | always | Requested release target. |
| `MIRROR_SOURCE` | plan+ | Version source adapter. |
| `MIRROR_OUTPUT` | plan+ | Comma-separated output adapters. |
| `MIRROR_CURRENT` | plan+ | Current version, empty for an initial release. |
| `MIRROR_NEXT` | plan+ | Planned next version. |
| `MIRROR_PROJECT_NAME` | plan+ | Resolved project name, when available. |
| `MIRROR_GIT_TAG` | plan+ | Exact planned tag, when available. |
| `MIRROR_FILE_PATHS` | write+ | Platform-list-separated planned file paths. |
| `MIRROR_COMMIT_MESSAGE` | commit+ | Planned commit message. |
| `MIRROR_COMMIT_PATHS` | commit+ | Platform-list-separated commit paths. |
| `MIRROR_TAG` | tag+ | Exact tag for the tag stage. |
| `MIRROR_PUSH_COMMIT` | push+ | Whether the commit ref is included. |
| `MIRROR_PUSH_TAG` | push+ | Whether the tag ref is included. |
| `MIRROR_ERROR_STAGE` | error hooks | Failed stage name. |
| `MIRROR_ERROR_MESSAGE` | error hooks | Primary error message. |
| `MIRROR_ERROR_EXIT_CODE` | error hooks | Child exit code when available. |
| `MIRROR_APPLIED` | apply/finalizer | Whether the complete plan succeeded. |
| `MIRROR_CONTEXT_PATH` | always | Path to the structured JSON context file. |

List values use the operating system path-list separator. Scripts needing
unambiguous structured data should read `MIRROR_CONTEXT_PATH`.

### Structured Context

Mirror creates one private temporary JSON context file per hook session and
updates it atomically before each event. It contains the normalized event,
plan, current stage, completed effects, primary error, secondary errors, and
hook results available at that point. Mirror removes it after
`after:everything`.

The context file is an interface for local hook processes, not a persistence or
audit log. Mirror must not add credentials or secret environment values to it.

### Output and Results

Hook stdout and stderr are captured independently. Human output identifies the
event and command index before rendering captured output. JSON mode emits one
valid Mirror envelope on stdout and includes structured hook results; hook
output never writes directly to JSON stdout.

```go
type HookResult struct {
	Event      HookEvent `json:"event"`
	Kind       string    `json:"kind"`
	Index      int       `json:"index"`
	Status     string    `json:"status"`
	DurationMS int64     `json:"duration_ms"`
	ExitCode   *int      `json:"exit_code,omitempty"`
	Stdout     string    `json:"stdout,omitempty"`
	Stderr     string    `json:"stderr,omitempty"`
}
```

Normal statuses are `success`, `failure`, and `skipped`. Mirror returns its
stable general-failure exit code 1 for a failed command hook and records the
child process exit code in `HookResult`. Cancellation remains exit code 130.

## Trust and Security

Command hooks are arbitrary repository-controlled code. Apply confirmation and
hook trust are separate decisions:

- `--yes` authorizes the planned Mirror release effects;
- `--run-hooks` authorizes configured command hooks for that invocation;
- `--skip-hooks` explicitly applies without command hooks;
- when command hooks exist and neither hook flag is present, Mirror must prompt
  interactively or fail closed in non-interactive mode;
- `--run-hooks` and `--skip-hooks` are mutually exclusive;
- configured hook event names and command counts appear before confirmation;
- Mirror never treats committed configuration as proof that commands are
  trusted.

AI instruction hooks are also repository-controlled input. An agent interprets
them only within the active user request and the instruction hierarchy. They
cannot grant new authority, suppress required validation, disclose secrets, or
override higher-priority instructions.

## Mutation and Rollback Boundaries

Hooks do not make the release pipeline fully transactional.

- Failures before the release commit may use Mirror's existing file and staging
  rollback path.
- Mirror stages only exact paths owned by the version plan; hook-created files
  are not staged implicitly.
- Hooks that mutate planned files may cause stale-plan or dirty-tree validation
  to fail.
- A successful commit, tag, or remote push may remain after a later action or
  hook fails.
- Error context and reporting must identify completed local and remote effects
  so recovery does not blindly repeat them.
- Error hooks may attempt project-specific recovery, but Mirror does not infer
  destructive rollback commands from hook configuration.

## Production Architecture

### `pkg/config`

- Replace the generic `map[string][]string` with typed hook definitions.
- Strictly decode canonical event objects and documented compatibility input.
- Reject unknown events, fields, duplicates, empty payloads, and unsupported
  instruction/event combinations.
- Generate the exact hook JSON schema from the production contract.

### `pkg/hooks`

Create one domain package that owns:

- the closed event catalog and support matrix;
- configuration normalization helpers shared with `pkg/config` where needed;
- command execution, environment construction, and context-file lifecycle;
- hook result and nested error aggregation;
- a testable runner interface using `os/exec` and `context`.

The package must not import Cobra or invoke an AI runtime.

### `cmd/version.go`

- Resolve trust flags and confirmation before starting command hooks.
- Wrap plan construction with the top-level command events.
- Pass a hook dispatcher and session context into version application.
- Preserve one stdout-safe JSON response.

### `pkg/versioning`

- Keep ownership of plans, preflight, file writes, commits, tags, pushes, and
  existing rollback behavior.
- Emit or invoke typed lifecycle boundaries around write, commit, tag, and push
  stages without parsing hook configuration directly.
- Return enough structured state to report partial completion accurately.

### Embedded Mirror Agent Resources

Update the embedded `guiho-s-mirror` skill and managed instruction guidance to:

- read and validate hook definitions from `mirror.yaml`;
- execute supported instruction hooks around agent-controlled major actions;
- reject unsupported internal instruction events;
- maintain instruction priority and release authorization boundaries;
- report instruction-hook outcomes.

Ordinary config and version commands must not mutate agent resources.

## Validation Strategy

### Configuration tests

- canonical event objects decode from YAML;
- instruction and command scalars normalize to lists;
- command-only compatibility input normalizes correctly;
- underscore and colon duplicates are rejected;
- unknown events and fields are rejected;
- empty definitions, lists, and strings are rejected;
- instruction payloads on internal events are rejected;
- JSON schema matches runtime validation.

### Command-runner tests

- commands run sequentially in the resolved project root;
- platform shell selection and environment inheritance are correct;
- every lifecycle context variable is correct;
- context JSON updates atomically and is removed after finalization;
- stdout and stderr remain distinct and JSON stdout remains valid;
- nonzero exits stop normal hooks and record the child exit code;
- interruption cancels execution and maps to exit code 130;
- error/finalizer hook failures remain secondary.

### Lifecycle tests

- successful event order exactly matches this document;
- plan, write, commit, tag, push, and hook failures select the correct nested
  error path;
- `after:<stage>` never runs for a failed stage;
- `after:everything` runs after every started session;
- `on:error` runs at most once;
- absent plan actions skip their action hooks;
- the write pair runs once around the entire file batch;
- dry-run and read-only commands execute no command hooks;
- missing hook trust fails before any command executes;
- rollback behavior remains correct before the commit boundary;
- disposable Git fixtures prove partial-state reporting after commit, tag, and
  push failures.

### Agent-instruction tests

- the embedded Mirror skill describes the exact support matrix;
- instruction hooks run in order around agent-controlled plan and apply actions;
- the agent selects success or error hooks from the observed action result;
- unsupported internal instruction events fail configuration validation;
- instructions never imply release authorization or higher instruction
  priority;
- a direct non-agent CLI invocation does not execute instruction text.

## Acceptance Criteria

- `mirror config check` validates the complete canonical and compatibility
  schema.
- `mirror version plan`, `current`, `next`, and apply dry-run remain free of
  command-hook side effects.
- `mirror version apply` executes trusted command hooks in deterministic order.
- Mirror-aware agents execute instruction hooks only at supported major-action
  boundaries.
- Every stage has deterministic success and error routing.
- JSON output remains valid regardless of hook output or failure.
- Primary and secondary failures are distinguishable.
- Existing release safety, exact-ref pushes, exit codes, and rollback behavior
  remain intact.
- README, `mirror/DOCS.md`, technical architecture, embedded agent resources,
  JSON schema, XDocs metadata, tests, review, and validation evidence agree with
  the shipped behavior.
- No acceptance item authorizes a version bump, tag, push, publication, or
  release.

## Implementation Sequence

1. Accept this RFC and resolve any requested changes to trust or compatibility
   behavior.
2. Add typed hook configuration and schema tests.
3. Add `pkg/hooks` with command execution, context, results, and unit tests.
4. Integrate top-level command events in `cmd/version.go`.
5. Integrate internal action events in `pkg/versioning` using disposable Git
   fixtures.
6. Update embedded Mirror agent resources for instruction hooks.
7. Add human and JSON reporting, help text, and user documentation.
8. Run formatting, focused tests, full tests, vet, XDocs validation, local
   implementation review, and independent validation.
9. Open a dedicated pull request. Keep version application and publication
   separately authorized.

## References

- [Issue #24: RFC: mirror hooks](https://github.com/CGuiho/mirror/issues/24)
- [Author clarification about agent-controlled major actions](https://github.com/CGuiho/mirror/issues/24#issuecomment-5176860127)
- Production configuration model: `pkg/config/config.go`
- Production version pipeline: `pkg/versioning/versioning.go`
- Version command orchestration: `cmd/version.go`
- Embedded Mirror skill: `embed/skills/guiho-s-mirror/SKILL.md`
