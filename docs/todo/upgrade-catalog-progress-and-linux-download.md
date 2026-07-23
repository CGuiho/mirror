---
name: Mirror Upgrade Catalog Progress And Linux Download
purpose: Define the required outcomes for GitHub issues 16, 17, and 18.
description: Requires concise release-list text, visible streamed download progress, and a bounded Linux-native self-upgrade transaction.
created: 2026-07-23
owner: mirror-docs-todo
flags:
  - approved
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

- Status: in progress
- Issues: [#16](https://github.com/CGuiho/mirror/issues/16),
  [#17](https://github.com/CGuiho/mirror/issues/17), and
  [#18](https://github.com/CGuiho/mirror/issues/18)
- Plan: [upgrade-catalog-progress-and-linux-download.md](../plans/upgrade-catalog-progress-and-linux-download.md)
- Decision: [streamed-upgrade-download.md](../decisions/streamed-upgrade-download.md)

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
- The public release workflow replaces a previous stable Linux installation
  through the exact-version installer recovery, then proves the released binary
  can stream a real public asset with visible progress and bounded completion.
- Typecheck, full tests, all native builds, XDocs checks, exact fourteen assets,
  scoped release notes, and public installer acceptance pass.
- Issues 16, 17, and 18 close only after the public release evidence exists.
