---
name: Mirror Upgrade Catalog Progress And Linux Download Plan
purpose: Provide the executable delivery sequence for GitHub issues 16, 17, and 18.
description: Sequences catalog simplification, streamed downloads, deadlines, native tests, documentation, release, and issue closure.
created: 2026-07-23
owner: mirror-docs-plans
flags:
  - approved
tags:
  - mirror
  - plan
  - upgrade
keywords:
  - streamed download
  - progress events
  - linux acceptance
  - release catalog
---

# Mirror Upgrade Catalog Progress And Linux Download Plan

## Required Guidance

Coordinate with `guiho-a-0001-swe` and use the CLI Engineer, Bun, TypeScript,
TypeBox, TODO, plan execution, implementation review, validation, XDocs, and
Mirror skills. The installed `guiho-s-0034-cli-engineer` file is unavailable in
this runtime, so preserve its repository contract and RFC 0034 behavior through
the local plan, tests, and existing implementation conventions.

## Execution Units

1. **Freeze public contracts.**
   Read all issue bodies and comments. Coordinate the six-column text table with
   XDocs. Keep Mirror's JSON release catalog complete and versioned.
2. **Simplify the human catalog.**
   Replace `MARKERS`, `TAG`, and `RELEASE` columns with independent
   `CURRENT`, `LATEST`, and `ASSET` yes/blank columns. Keep semantic ordering,
   GitHub pagination, prerelease filtering, compatible-asset selection, and
   warnings unchanged.
3. **Extend structured upgrade events.**
   Add the `progress` status and optional download progress object containing
   `receivedBytes`, `totalBytes`, and `percent`. Keep ordered phase events and
   JSON envelopes backward-readable.
4. **Replace opaque response persistence.**
   Remove direct `Bun.write(path, Response)`. Read `response.body` with a reader,
   write every chunk through a Bun file sink, close both resources in `finally`,
   validate the declared content length, reject an empty asset, and remove the
   temporary file on every pre-replacement failure.
5. **Bound network waiting.**
   Pass an abort signal to fetch. Enforce a total download deadline and reset a
   shorter inactivity timer after each chunk. Abort the request and cancel the
   body on expiry. Report a stable download-failure result and never rename the
   canonical binary.
6. **Render useful progress.**
   For known totals, print a fixed-width progress bar with percentage and byte
   counts at bounded increments. For unknown totals, print received bytes at
   bounded increments. Retain the initial `Downloading...` phase line and
   preserve JSON-only purity.
7. **Add regression coverage.**
   Test exact catalog headings and exclusions, complete JSON metadata, progress
   monotonicity, unknown totals, partial-stream failure, length mismatch, empty
   response, fetch timeout, inactivity timeout, temporary-file cleanup, and
   canonical-byte preservation.
8. **Exercise compiled native behavior.**
   On Linux CI, compile a current fixture executable that performs its own
   upgrade through the real transaction and a target executable that supports
   `--version` and schema save. Serve the target in delayed chunks and assert
   successful exit, target version, progress, schema persistence, and cleanup.
9. **Strengthen public release acceptance.**
   In the publish workflow, discover the latest stable release other than the
   current tag and install it into an isolated Linux home. The 3.7.2 staged
   recovery first crossed the immutable legacy-updater boundary with the
   canonical installer and proved the fixed binary against a real public asset.
   The final 3.7.3 gate must now run the public 3.7.2 binary's own
   `mirror upgrade --version 3.7.3`, require visible streamed progress and
   bounded completion, and verify the new canonical version and global schema.
10. **Document and review.**
    Update canonical docs, source descriptors, task indexes, the installed
    Mirror skill source, implementation review, and validation report.
11. **Validate before versioning.**
    Run typecheck, focused tests, full tests, build matrix, config check, XDocs
    strict metadata/tree/doctor, and inspect the exact diff.
12. **Release through Mirror.**
    Use a minor bump because this adds visible progress and changes the human
    table contract. Plan and apply `3.7.0`, allowing configured commit/tag/push.
    Approve the existing protected production environment once if GitHub holds
    the run, then require green CI, exact fourteen assets, and scoped notes.
13. **Close with evidence.**
    Run public previous-to-new upgrade acceptance, verify the release asset set
    and notes, update completion artifacts, push every one-file commit, and close
    issues 16, 17, and 18 with direct evidence.

## Stop Conditions

Stop release progression on any failed typecheck, test, native fixture, XDocs
check, version plan mismatch, publish job, exact-asset comparison, public upgrade,
or transactional-preservation assertion. Do not close an issue from source-only
evidence.
