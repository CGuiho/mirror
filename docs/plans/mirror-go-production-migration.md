---
name: Mirror Go Production Migration Plan
purpose: Record the executable phases and acceptance criteria for making Go/Cobra the delivery authority.
description: Completed implementation plan for the Mirror Go migration.
created: 2026-07-26
owner: mirror-docs-plans
flags: [executed]
tags: [mirror, go, plan]
keywords: [cobra, strict yaml, release tooling, ci]
---

# Mirror Go Production Migration Plan

## Scope and boundaries

Build on the saved uncommitted Go rewrite without resetting user work. Finish
runtime behavior, tests, installers, release tooling, workflows, and repository
documentation. Do not bump, tag, push, publish, or create a release.

## Execution units

1. **Baseline and package repair** — inspect all dirty work; separate executable
   helper packages so `go test ./...` and `go vet ./...` compile every package.
2. **Runtime contract** — construct one Cobra tree; inject build metadata and IO;
   implement strict YAML, stable errors, deterministic help, embedded resources,
   idempotent argument-free bootstrap, init defaults, bounded background
   updates, transactional upgrades, and platform uninstall.
3. **Delivery contract** — centralize the eight-target matrix; build static
   binaries with metadata; create the skill ZIP, prompt, and sorted checksums;
   verify the exact 11-name set.
4. **Installation and upgrades** — map supported platforms, verify checksums,
   install both agent roots, preserve recovery, and verify exact versions.
5. **CI and publication** — make Go tests/builds/native smokes authoritative;
   align publication to `mirror/v*`; remove Bun package publication.
6. **Documentation and tracking** — update README, full docs, technical overview,
   RFC, changelog, skill, TODO, review, validation, and XDocs topology.
7. **Final gate** — run format/tidy/test/vet, full build and verifier, command and
   installer smokes, XDocs validation, workflow parse, and `git diff --check`.

## Affected areas

`main.go`, `cmd/`, `pkg/`, `embed/`, `devops/`, `.github/workflows/`, `go.mod`,
`mirror.yaml`, root/package docs, `docs/`, `TODO.md`, and XDocs descriptors.

## Acceptance criteria

The Go module passes all source gates; the exact matrix builds; the Windows
binary and offline installer pass native smoke; workflow contract tests prevent
Bun or tag drift; current documentation names Go as authority; and no external
release effect occurs.
