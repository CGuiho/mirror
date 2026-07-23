---
name: Mirror Upgrade Catalog Progress And Linux Download
purpose: Define the required outcomes for GitHub issues 16, 17, and 18.
description: Requires concise release-list text, visible streamed download progress, and a bounded Linux-native self-upgrade transaction.
created: 2026-07-23
owner: mirror-docs-todo-done
flags:
  - completed
tags:
  - mirror
  - cli
  - upgrade
keywords:
  - upgrade list
  - download progress
  - linux compiled binary
  - content length
---

# Mirror Upgrade Catalog Progress And Linux Download

## Task

- Status: completed
- Issues: [#16](https://github.com/CGuiho/mirror/issues/16),
  [#17](https://github.com/CGuiho/mirror/issues/17), and
  [#18](https://github.com/CGuiho/mirror/issues/18)
- Plan: [upgrade-catalog-progress-and-linux-download.md](../../plans/upgrade-catalog-progress-and-linux-download.md)
- Decision: [streamed-upgrade-download.md](../../decisions/streamed-upgrade-download.md)
- Review: [upgrade-catalog-progress-and-linux-download-review.md](../../reviews/implementation/upgrade-catalog-progress-and-linux-download-review.md)
- Validation: [upgrade-catalog-progress-and-linux-download.md](../../validation/upgrade-catalog-progress-and-linux-download.md)
- Release: [Mirror 3.7.3](https://github.com/CGuiho/mirror/releases/tag/%40guiho/mirror%403.7.3)

## Required Outcomes

### Concise release catalog

Human `mirror upgrade list` output uses exactly these columns:

```text
VERSION  CHANNEL  PUBLISHED   CURRENT  LATEST  ASSET
```

Dates use `YYYY-MM-DD`; `CURRENT`, `LATEST`, and `ASSET` use `yes` or blank.
Text output omits tags, release URLs, compatible asset names, and combined
marker text. JSON remains the complete structured API and retains those fields.

### Observable download

An upgrade emits structured download progress while the response body is read.
Known-length responses report received bytes, total bytes, and a monotonic
percentage. Unknown-length responses report received bytes. Human output shows
a readable bar or byte counter rather than appearing frozen at `Downloading...`.

### Bounded Linux-native transaction

The compiled Linux CLI reads the response body explicitly and writes chunks to
the temporary candidate. A total deadline and a no-progress deadline prevent an
unbounded wait. Missing bodies, interrupted streams, invalid lengths, empty
assets, and deadline expiry fail before the canonical executable is renamed.
All such failures remove the temporary candidate and preserve the current
binary, pinned recovery command, and existing transactional rollback behavior.

## Acceptance Signals

- Text and JSON catalog regression tests pass.
- Known-length, unknown-length, interrupted, mismatched-length, and stalled
  body tests pass.
- Progress is monotonic and ends at 100 percent when length is known.
- A compiled Linux-native old binary upgrades through a streamed local fixture.
- The staged 3.7.2 public workflow verifies exact-version installer recovery
  from a legacy installation and streams a real public asset from the fixed
  binary. The final 3.7.3 workflow installs public 3.7.2, upgrades it through
  its own command with visible progress and bounded completion, and verifies
  3.7.3 plus the global schema.
- Typecheck, full tests, all native builds, XDocs checks, exact fourteen assets,
  scoped release notes, and public installer acceptance pass.
- Issues 16, 17, and 18 close only after the public release evidence exists.

## Completion

All acceptance signals passed. Public Mirror 3.7.2 upgraded itself to 3.7.3
with visible progress through 100 percent, canonical-version verification,
schema persistence, exact fourteen assets, and scoped release notes. Issues 16,
17, and 18 are closed.
