---
name: XDocs Scan Exclusion Configuration Validation
purpose: Record validation evidence for the repaired Mirror XDocs configuration.
description: Proves valid name-only scan exclusions, strict repository metadata, hierarchy integrity, and unchanged Go CLI behavior.
created: 2026-08-13
updated: 2026-08-13
owner: mirror-docs-validation
flags: [complete]
tags: [mirror, xdocs, validation]
keywords: [scan.exclude, metadata, doctor, hierarchy]
---

# XDocs Scan Exclusion Configuration Validation

## Configuration Evidence

- XDocs version: `v0.10.0`.
- Removed invalid `scan.exclude` values: `devops/build-binaries`,
  `mirror/node_modules`, and `mirror/bin`.
- `devops/build-binaries` was a stale path-shaped reference to the tracked Go
  source file `devops/build-binaries.go`, not a directory.
- Existing name-only exclusions `node_modules` and `bin` match those directory
  names at every repository depth; nested duplicates were unnecessary.
- `.gitignore` independently excludes generated dependency/build directories.

## XDocs Evidence

- `xdocs scan`: 228 files, 37 directories, 37 covered directories, 0 uncovered
  directories, and 38 descriptors including the root index.
- `xdocs meta . --documents --strict`: 37 descriptors valid with companion
  ownership and frontmatter rules satisfied.
- `xdocs tree`: valid containment hierarchy rooted at `mirror`.
- `xdocs doctor . --warnings-as-errors`: valid, 0 errors, 0 warnings.

## Final Gate

- Go formatting and module graph: clean.
- `go test -count=1 ./...`: passed.
- `go vet ./...`: passed.
- `go run . config check`: passed.
- `go run . --help-tree` and `go run . --help-docs`: passed.
- Schema artifact parity and parsed hook contract tests: passed.
- `git diff --check`: passed.
- Review: no blocker, high, medium, or low findings in the focused
  configuration/metadata diff.
- Mirror decision: no version bump or release for this configuration-only
  documentation tooling correction.
