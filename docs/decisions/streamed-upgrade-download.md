---
name: Streamed And Bounded Mirror Upgrade Downloads
purpose: Record why Mirror streams upgrade responses instead of persisting Response objects directly.
description: Selects explicit web-stream reading, Bun file sinks, progress events, two deadlines, and pre-swap validation.
created: 2026-07-23
owner: mirror-docs-decisions
flags:
  - accepted
tags:
  - mirror
  - decision
  - reliability
keywords:
  - Bun compiled HTTP
  - streaming download
  - inactivity timeout
  - transactional replacement
---

# Streamed And Bounded Mirror Upgrade Downloads

## Decision

Mirror will explicitly read `Response.body` and write each `Uint8Array` chunk to
a Bun file sink. It will not pass a whole `Response` to `Bun.write`.

The transaction emits throttled structured progress, verifies a declared
content length, rejects empty downloads, applies both a total deadline and a
reset-on-progress inactivity deadline, and cleans the temporary candidate on
all download failures. Native-format and version validation still occur before
the canonical executable is renamed.

## Rationale

The opaque response-to-file operation provides no progress boundary and was
observed hanging inside a Bun-compiled Linux executable. Explicit streaming
makes forward movement observable, provides a safe place to enforce deadlines
and length integrity, and leaves the existing verified rename/swap/rollback
transaction unchanged.

## Consequences

- Text callers see real progress; JSON callers receive structured progress.
- A server without `Content-Length` remains supported through byte counters.
- A quiet connection cannot wait forever.
- A continually moving but extremely slow download remains bounded by the total
  deadline.
- Temporary artifacts are disposable until native and version validation pass.
- The public event-status union gains `progress`; this is accepted as a pre-1.0
  compatible evolution within the approved breaking-change boundary.

## Rejected Alternatives

- Keep `Bun.write(path, response)`: repeats the observed compiled Linux hang and
  cannot expose body progress.
- Buffer the whole body with `arrayBuffer()`: still hides progress and raises
  peak memory use.
- Add only a spinner: changes presentation without fixing the unbounded wait.
- Rename before download validation: violates transactional preservation.
