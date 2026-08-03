---
name: POSIX sh Public Installer Pipe Implementation Review
purpose: Review the issue 22 installer correction against the documented public and delivery contracts.
description: Local review of POSIX conversion, streamed regression coverage, and preserved verification and rollback behavior.
created: 2026-08-03
updated: 2026-08-03
owner: mirror-docs-reviews-implementation
flags: [accepted-local]
tags: [mirror, review, installer]
keywords: [posix sh, dash, curl pipe, transactional install]
---

# POSIX sh Public Installer Pipe Implementation Review

## Verdict

Accepted locally. No blocking implementation finding remains; hosted CI is the
remaining pull-request gate.

## Scope Reviewed

- [Issue #22 task](../../todo/posix-sh-installer-pipe.md)
- `devops/install.sh`
- `devops/build-binaries_test.go`
- `.github/workflows/ci.yml`
- `README.md` and `mirror/DOCS.md`
- affected XDocs descriptors and validation evidence

## Findings

### Closed

- The script now declares `#!/bin/sh` and uses POSIX conditions, parameter
  expansion, functions, and sequential target handling throughout.
- Release metadata download is captured before parsing, so curl failures remain
  observable without Bash `pipefail`.
- Function variables use operation-specific names to avoid collisions in shells
  without `local`.
- The NUL, frontmatter, checksum, binary-version, rollback, cleanup, skill,
  instruction, and PATH boundaries remain present.
- The Go regression streams the installer on standard input through a real
  POSIX shell twice against disposable signed fixtures and verifies idempotent
  resources.
- Linux CI mirrors the public pipe with `sh -s` twice while its Bash source-only
  mapping checks remain intact.

### Residual

- Hosted runner evidence remains pending until the pull request executes.
- XDocs v0.9.0 rejects the repository's pre-existing path-shaped exclusions;
  metadata validation uses an equivalent temporary directory-name config and
  does not change the unrelated checked-in configuration.

## Release Boundary

The task authorizes an issue and pull request only. It does not authorize a
version bump, tag, release, or publication.
