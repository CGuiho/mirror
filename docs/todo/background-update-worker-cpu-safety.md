---
name: Mirror Background Update Worker CPU Safety
purpose: Define the bounded single-worker outcome for Mirror's background release check.
description: Requires coalesced update checks, deterministic worker exit, stale-lock recovery, and failure isolation from foreground commands.
created: 2026-07-21
owner: mirror-docs-todo
flags:
  - testing
tags:
  - mirror
  - cli
  - reliability
keywords:
  - background update worker
  - CPU usage
  - process accumulation
  - update cache lease
---

# Mirror Background Update Worker CPU Safety

## Todo Index

- Task: `Mirror Background Update Worker CPU Safety`
- Status: testing
- Index: [todo.md](../../todo.md)
- Validation: [background-update-worker-cpu-safety.md](../validation/background-update-worker-cpu-safety.md)

## Outcome

Mirror retains its nonblocking background release check without allowing a
foreground command burst, stalled request, crashed worker, or stale lock to
accumulate persistent worker processes or consume sustained CPU.

## Scope

### In scope

- Ensure the hidden worker path performs one update check and never schedules
  another worker.
- Coalesce concurrent cold-cache and stale-cache starts through one atomic
  per-cache lease acquired before process creation.
- Bound the complete worker network operation to 15 seconds.
- Reclaim leases older than 30 seconds while preventing an old owner from
  deleting a replacement lease.
- Keep all scheduler and worker-launch failures isolated from foreground CLI
  commands.
- Preserve the four-hour update-cache freshness interval.

### Out of scope

- Removing the RFC 0034 background update check.
- Adding a daemon, resident service, polling loop, or recurring timer.
- Changing upgrade, installer, or release-catalog behavior.

## Acceptance Signals

- Thirty-two concurrent foreground schedulers create exactly one real worker
  process.
- The measured worker process exits after its bounded work.
- Concurrent stale-lock reclaimers produce exactly one replacement owner.
- A timed-out request releases its lease and permits a later check.
- Worker and scheduler failures never change a foreground command result.
- Typecheck, focused regressions, full tests, build, XDocs validation, CI, and
  public release verification pass.

## Related Context

- [XDocs issue #14](https://github.com/CGuiho/xdocs/issues/14) reported the
  cross-CLI incident pattern that prompted this Mirror audit.
