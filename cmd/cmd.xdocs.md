---
subject: mirror-cmd
description: Cobra command construction, managed-instruction rendering, error mapping, and platform CLI adapters.
parent: mirror
children: []
files:
  root.go: Fresh root command construction, global flags, startup lifecycle, and injected dependencies.
  errors.go: Stable process error categories, exit codes, and post-error final recovery output.
  helptree.go: Deterministic command-tree and Markdown help generation.
  config.go: Configuration commands.
  init.go: YAML configuration initialization with Git-first defaults and explicit source overrides.
  version.go: Semantic-version commands, hook trust, and top-level hook lifecycle.
  agent.go: Explicit embedded skill, canonical prompt registry, and metadata-free instruction commands.
  upgrade.go: Native release check, catalog, platform recovery command, synchronous launcher upgrade, and legacy transition commands.
  selftest.go: Hidden candidate and installed-payload embedded-resource startup verification.
  upgrade_recovery_test.go: First-before-network and final-after-failure recovery-output tests.
  uninstall.go: Cross-platform uninstall command.
documents: {}
tags: [go, cobra, cli]
keywords: [command tree, help docs, exit codes, upgrade recovery, hidden self-test, managed instruction, canonical prompts, hook trust, init defaults]
flags: []
status: stable
---

One testable Cobra tree owns all production Mirror command routing and help.
