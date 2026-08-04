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
  main.go: Thin executable entrypoint with linker build metadata and exit mapping.
  mirror.yaml: Self-hosting semantic-version configuration using mirror/v tags.
  xdocs.yaml: YAML configuration for XDocs discovery and validation.
documents:
  AGENTS.md: Current Go CLI engineering, delivery, documentation, and release boundaries.
  CHANGELOG.md: Release history and exact-version release notes.
  README.md: User and contributor entrypoint for the production Go CLI.
  TECHNICAL.md: Current runtime, maintenance, and delivery architecture.
  todo.md: Local task ledger and migration handoff.
  xdocs-overview.md: Generated companion overview for the repository root.
tags: [repository, mirror, go, documentation]
keywords: [cobra, strict yaml, lifecycle hooks, native release, eleven assets]
flags: []
status: stable
---

The repository root is the production Mirror Go module. The Bun package is a
historical child; `cmd`, `pkg`, `embed`, and `devops` own current delivery.
