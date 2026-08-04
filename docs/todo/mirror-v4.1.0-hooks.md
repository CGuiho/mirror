---
name: Mirror v4.1.0 Hooks
purpose: Define the implementation outcome for the approved Mirror hooks RFC.
description: Tracks typed YAML hooks, command execution, agent instruction boundaries, lifecycle errors, safety, tests, documentation, and pull-request delivery.
created: 2026-08-04
updated: 2026-08-04
owner: mirror-docs-todo
flags: [implemented, hosted-pending]
tags: [mirror, hooks, go, agents]
keywords: [mirror.yaml, command hooks, instruction hooks, lifecycle errors]
---

# Mirror v4.1.0 Hooks

## Todo Index

- Task: `Mirror v4.1.0 Hooks`
- Status: implemented; pull-request checks pending
- Index: [TODO.md](../../TODO.md)
- External: [CGuiho/mirror#24](https://github.com/CGuiho/mirror/issues/24)
- Branch: `codex/implement-mirror-hooks`

## Authority

The accepted issue body and
[hook design](../2026-06-07-mirror-hooks-design.md) define the product contract.
The repository-root Go/Cobra implementation is the runtime authority. The
archived Bun/TypeScript package is historical evidence only.

The required `guiho-s-0035-cli-engineer-go` and
`guiho-s-0036-feature-brainstorm` packages were unavailable in the checked user
and Superiority roots. The full `guiho-a-0001-swe` controller, repository
instructions, approved issue RFC, installed Mirror skill, and XDocs skill are
the active fallback authority.

## Scope

- Replace the generic hook map with canonical typed lifecycle definitions and
  command-only compatibility normalization.
- Execute explicitly trusted command hooks sequentially from the project root.
- Preserve context, separate output streams, JSON purity, stable exit codes,
  cancellation, primary errors, and existing rollback boundaries.
- Route plan, apply, write, commit, tag, push, stage-error, global-error, and
  unconditional-finalizer events deterministically.
- Teach the embedded Mirror skill to follow AI-agent instructions only at
  agent-controlled everything, plan, and apply boundaries.
- Update user, technical, design, schema, XDocs, review, and validation records.
- Submit one dedicated pull request.

## Out of Scope

- Invoking or pausing for an AI runtime from the Go CLI.
- Executing command hooks from read-only commands or apply dry-runs.
- Concurrent hook execution, command interpolation, or automatic timeouts.
- A version bump, tag, release push, publication, or GitHub release.

## Acceptance Signals

- Strict configuration and generated schema agree on every event and payload.
- Trust is resolved before any configured command executes.
- Disposable fixtures prove exact success and nested-error ordering.
- Hook output cannot corrupt JSON stdout.
- Internal instruction hooks are rejected.
- All Go, vet, config, help, XDocs, and diff checks pass.
- The pull request links issue #24 and contains no release effect.

## Lifecycle

- Current phase: pull-request publication and hosted validation.
- Local implementation review: accepted.
- Local validation: complete.
- Next phase: hosted pull-request checks and maintainer review.
