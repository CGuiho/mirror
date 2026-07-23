---
subject: mirror-docs-todo
description: Durable task specifications linked from the Mirror TODO index.
parent: mirror-docs
children: []
files: {}
documents:
  global-mirror-schema.md: Tracks global TypeBox-derived schema persistence for GitHub issue 14.
  complete-yaml-configuration-migration.md: Tracks completion of the YAML-only configuration migration for GitHub issue 15.
  citty-cli-migration.md: Defines the required full migration from Mirror's handwritten CLI parser and router to Citty.
  citty-cli-migration-implementation.md: Records the completed Citty migration decisions, changes, and handoff.
  rfc-0034-cli-compliance-migration.md: Defines the required breaking outcome, scope, constraints, and completion signals for full Mirror RFC 0034 compliance.
  rfc-0034-cli-compliance-migration-implementation.md: Records execution of MR-01 through MR-16 and the release handoff.
  upgrade-reliability.md: Defines the required observable, verified self-upgrade, recovery, catalog, installer, and Windows regression outcomes.
  upgrade-reliability-implementation.md: Records upgrade reliability implementation decisions, progress, verification evidence, and handoff.
  public-installers-and-platform-greeting.md: Defines standalone public installer and platform-aware greeting outcomes for GitHub issues 12 and 13.
  background-update-worker-cpu-safety.md: Defines bounded, coalesced, stale-recoverable background update worker behavior for Mirror.
  upgrade-catalog-progress-and-linux-download.md: Defines concise release-list text, streamed progress, and bounded compiled Linux self-upgrades for issues 16 through 18.
tags:
  - todo
  - planning
keywords:
  - mirror
  - RFC 0034
  - mirror.yaml
  - agent namespace
  - citty
  - cli migration
  - argument parsing
  - mirror upgrade
  - recovery command
  - download progress
  - linux upgrade
flags: []
status: stable
---

The `docs/todo/` directory stores detailed task specifications linked from the
root `TODO.md` while keeping the task index concise.
