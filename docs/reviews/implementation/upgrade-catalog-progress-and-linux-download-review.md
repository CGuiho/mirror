---
name: Mirror Upgrade Catalog Progress And Linux Download Review
purpose: Review the issues 16 through 18 implementation against its approved contract.
description: Maps catalog, progress, deadlines, transaction safety, native tests, release gates, and public evidence to the implementation.
created: 2026-07-23
owner: mirror-docs-reviews-implementation
flags:
  - validated
tags:
  - mirror
  - implementation review
keywords:
  - issue 16
  - issue 17
  - issue 18
  - Mirror 3.7.3
---

# Mirror Upgrade Catalog Progress And Linux Download Review

## Verdict

Accepted. The implementation satisfies issues 16, 17, and 18 and is publicly
verified in Mirror 3.7.3. No open source, transaction, test, documentation, or
release blocker remains.

## Acceptance Mapping

| Requirement | Implementation | Result |
| --- | --- | --- |
| Concise human catalog | `cli.ts` renders exactly `VERSION CHANNEL PUBLISHED CURRENT LATEST ASSET`; JSON catalog fields are unchanged. | passed |
| Visible progress | Upgrade events carry received/total/percent data and text renders known-length bars or unknown-length byte counts. | passed |
| No unbounded Linux wait | Explicit body reads have total and inactivity deadlines and abort/cancel behavior. | passed |
| Pre-swap integrity | Empty, interrupted, mismatched-length, invalid-native, and wrong-version candidates fail before rename and are removed. | passed |
| Transaction safety | Canonical rename, candidate install, version/schema verification, rollback, cache commit, and cleanup remain ordered. | passed |
| Compiled-native proof | Linux fixture executes a compiled old upgrader against a delayed streamed target; Windows runs live replacement tests. | passed |
| Public proof | Released 3.7.2 upgraded itself to released 3.7.3 with visible 89.5 MiB progress and canonical/schema verification. | passed |

## Review Notes

The failed 3.7.1 public gate correctly exposed an immutable bootstrap boundary:
3.6.1 cannot use updater code that does not exist in its binary. The one-time
supported transition is its printed exact-version installer recovery. Mirror
3.7.2 crossed that boundary and proved the fixed downloader against a real
public asset; Mirror 3.7.3 then passed the strict forward command-upgrade gate.
No tag or release history was rewritten.
