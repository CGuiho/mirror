---
subject: mirror
description: Production Go/Cobra Mirror CLI, typed lifecycle hooks, and durable project records.
parent: null
children:
  - mirror-cmd
  - mirror-devops
  - mirror-docs
  - mirror-embed
  - mirror-mirror
  - mirror-pkg
files:
  .gitignore: Ignore rules for generated and local files.
  go.mod: Go module and direct dependency contract.
  go.sum: Go dependency integrity checksums.
  main.go: Thin entrypoint with linker metadata, stable-launcher dispatch, exact child exit propagation, CLI execution, and final recovery output.
  mirror.yaml: Self-hosting semantic-version configuration using mirror/v tags.
  runx.yaml: RunX v2 catalog for formatting, tests, vet, release assets, help, and stable-upgrade proofs.
  xdocs.yaml: YAML configuration for XDocs discovery and validation.
documents:
  AGENTS.md: Current Go CLI engineering, delivery, documentation, and release boundaries.
  LICENSE.md: Repository license terms for GUIHO Mirror.
  CHANGELOG.md: Release history and exact-version release notes.
  README.md: User and contributor entrypoint for the production Go CLI.
  TECHNICAL.md: Current runtime, maintenance, and delivery architecture.
  todo.md: Local task ledger and migration handoff.
  xdocs-overview.md: Generated companion overview for the repository root.
tags: [repository, mirror, go, documentation]
keywords: [cobra, strict yaml, stable launcher, immutable payload, lifecycle hooks, native release, eleven assets]
flags: []
status: stable
---

The repository root is the production Mirror Go module. The Bun package is a
historical child; `cmd`, `pkg`, `embed`, and `devops` own current delivery.
