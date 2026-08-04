---
subject: mirror-cmd
description: Cobra command construction, managed-instruction rendering, error mapping, and platform CLI adapters.
parent: mirror
children: []
files:
  root.go: Fresh root command construction, global flags, startup lifecycle, and injected dependencies.
  errors.go: Stable process error categories and exit codes.
  helptree.go: Deterministic command-tree and Markdown help generation.
  config.go: Configuration commands.
  init.go: YAML configuration initialization with Git-first defaults and explicit source overrides.
  version.go: Semantic-version commands, hook trust, and top-level hook lifecycle.
  agent.go: Explicit embedded skill, raw prompt, and metadata-free instruction commands.
  upgrade.go: Native release check, catalog, upgrade, and rollback commands.
  uninstall.go: Cross-platform uninstall command.
documents: {}
tags: [go, cobra, cli]
keywords: [command tree, help docs, exit codes, managed instruction, hook trust, init defaults]
flags: []
status: stable
---

One testable Cobra tree owns all production Mirror command routing and help.
