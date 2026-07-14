---
name: CLI Contextual Help Validation
purpose: Record verification evidence for the contextual CLI help correction
description: Typecheck, test, binary build, manual CLI, and XDocs results for the contextual help implementation.
created: 2026-07-14
flags:
  - validated
tags:
  - cli
  - validation
  - release
keywords:
  - mirror version
  - contextual help
  - bun test
  - typecheck
  - native binaries
owner: mirror-docs-validation
---

# CLI Contextual Help Validation

## Summary

The contextual CLI help implementation satisfies the approved behavior and is ready for a patch release.

## Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Focused CLI test | Passed | `bun test source/guiho-mirror.spec.ts --test-name-pattern "shows contextual help"`: 1 passed, 12 assertions at the time of the focused run. |
| Full typecheck | Passed | `bun run typecheck`: TypeScript completed with no errors. |
| Full test suite | Passed | `bun test`: 70 tests passed, 0 failed, 339 assertions. |
| Native binary build | Passed | `bun run build`: all 12 platform assets compiled and verified. |
| Manual CLI behavior | Passed | Bare `version` and `version -h` exited 0 with version help; incomplete `version plan` exited 1 with its error and contextual plan help. |
| XDocs tree | Passed | `xdocs tree` reported the complete Mirror tree without orphan or duplicate errors. |
| Source metadata | Passed | `xdocs meta mirror/source --strict --format json` reported no errors. |
| Diff whitespace | Passed | `git diff --check` reported no errors. |

## Review

No implementation defects or unapproved deviations were found. The change preserves successful command execution, keeps usage failures nonzero, and routes help through the existing authoritative help model.

## Residual Risk

The full strict companion-document metadata scan still reports older frontmatter issues in pre-existing documents under `docs/`. The new design document and this validation subtree use valid XDocs metadata; the legacy issues are outside this CLI correction.
