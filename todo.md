---
name: GUIHO Mirror TODO
purpose: Track active and completed local Mirror engineering work.
description: Component task ledger and durable handoff links.
created: 2026-05-16
owner: mirror
flags: []
tags: [mirror, todo]
keywords: [tasks, plans, reviews, validation]
---

Copyright (c) 2026 GUIHO Technologies as represented by Cristovao GUIHO
All Rights Reserved.

# GUIHO Mirror TODO List

## PowerShell Invoke-Expression Installer Hardening

- Status: testing
- Created: `2026-07-28`
- Updated: `2026-07-28`
- Outcome: Make the public Windows `irm .../devops/install.ps1 | iex`
  entrypoint null-safe, report the exact failing installer stage, and exercise
  the real `Invoke-Expression` path in Windows CI.
- Spec:
  [docs/todo/powershell-invoke-expression-installer.md](docs/todo/powershell-invoke-expression-installer.md)
- External: GitHub issue
  [#19](https://github.com/CGuiho/mirror/issues/19)
- Testing: focused Windows PowerShell parser, Go contract, and stage-aware
  `Invoke-Expression` failure checks pass; full Go tests, vet, exact 11-asset
  verification, configuration/help contracts, and two complete offline
  `Invoke-Expression` installations also pass.
- Review:
  [docs/reviews/implementation/powershell-invoke-expression-installer-review.md](docs/reviews/implementation/powershell-invoke-expression-installer-review.md)
- Validation:
  [docs/validation/powershell-invoke-expression-installer.md](docs/validation/powershell-invoke-expression-installer.md)

## Parent TODO

- Parent: [../guiho/TODO.md](../guiho/TODO.md)
- Parent AGENTS: [../guiho/AGENTS.md](../guiho/AGENTS.md)
- Local AGENTS: [./AGENTS.md](./AGENTS.md)
- Local context: Semantic project versioning and release workflow package for @guiho/mirror.

## Mirror Go Production Migration

- Status: completed locally; publication not requested
- Created: `2026-07-25`
- Completed: `2026-07-26`
- Outcome: Make the repository-root Go/Cobra CLI the production, CI, installer,
  and publication authority with strict YAML, embedded resources, safe native
  maintenance, and exactly 11 release assets.
- RFC: [docs/rfc/mirror-go-rewrite-rfc.md](docs/rfc/mirror-go-rewrite-rfc.md)
- Plan: [docs/plans/mirror-go-production-migration.md](docs/plans/mirror-go-production-migration.md)
- Review: [docs/reviews/implementation/mirror-go-production-migration-review.md](docs/reviews/implementation/mirror-go-production-migration-review.md)
- Validation: [docs/validation/mirror-go-production-migration.md](docs/validation/mirror-go-production-migration.md)
- Result: Local Go tests, vet, exact-set cross-build, verifier, Windows native
  smoke, and offline PowerShell installer passed. Hosted platform validation and
  any release remain separate, explicitly authorized work.
- Added behavior: plain Mirror performs idempotent skill/instruction bootstrap;
  init defaults to `v{version}` with commit and push enabled.
- Initial Git-only projects can apply an exact first version without a manual
  seed tag; relative increments remain rejected until that tag exists.


## Mirror 3.6.0 Global Schema And YAML Completion

- Status: completed
- Created: `2026-07-22`
- Updated: `2026-07-23`
- Outcome: Persist the TypeBox-derived schema globally, complete the YAML-only
  migration, standardize the welcome/update lifecycle, and release Mirror 3.6.0.
- Specs:
  - [Global Mirror Schema](docs/todo/global-mirror-schema.md)
  - [Complete YAML Configuration Migration](docs/todo/complete-yaml-configuration-migration.md)
- Plan: [Mirror 3.6.0 Schema And YAML Plan](docs/plans/mirror-3.6.0-schema-and-yaml.md)
- Review: [Implementation Review](docs/reviews/implementation/mirror-3.6.0-schema-and-yaml-review.md)
- Validation: [Validation Report](docs/validation/mirror-3.6.0-schema-and-yaml.md)
- External: GitHub issues [#14](https://github.com/CGuiho/mirror/issues/14)
  and [#15](https://github.com/CGuiho/mirror/issues/15)
- Release: [`@guiho/mirror@3.6.1`](https://github.com/CGuiho/mirror/releases/tag/%40guiho/mirror%403.6.1)
- Result: Both issues are closed after exact-asset, public Linux installer, and
  isolated Windows installer/schema acceptance.

## Python Versioning Support

Add support for reading and updating Python package versions in Mirror. Initial planning should clarify which Python metadata files are in scope, such as `pyproject.toml`, `setup.cfg`, `setup.py`, package `__init__.py`, or another project convention.

## Python Source-To-Target Version Sync

Add an option for Python version propagation from a source project to a target project. Initial planning should define what "source" and "target" mean for Python projects, how the target version is selected or derived, and whether this should be a CLI option, configuration field, or both.

## Mirror 3.7.3 Upgrade Catalog And Linux Download

- Status: completed
- Created: `2026-07-23`
- Completed: `2026-07-23`
- Outcome: Simplify `upgrade list`, stream visible download progress, and remove
  the unbounded Bun-compiled Linux download wait without weakening transactional
  replacement.
- Spec: [docs/todo/done/upgrade-catalog-progress-and-linux-download.md](docs/todo/done/upgrade-catalog-progress-and-linux-download.md)
- Plan: [docs/plans/upgrade-catalog-progress-and-linux-download.md](docs/plans/upgrade-catalog-progress-and-linux-download.md)
- Decision: [docs/decisions/streamed-upgrade-download.md](docs/decisions/streamed-upgrade-download.md)
- Review: [docs/reviews/implementation/upgrade-catalog-progress-and-linux-download-review.md](docs/reviews/implementation/upgrade-catalog-progress-and-linux-download-review.md)
- Validation: [docs/validation/upgrade-catalog-progress-and-linux-download.md](docs/validation/upgrade-catalog-progress-and-linux-download.md)
- Archive: [docs/todo/done/done.md](docs/todo/done/done.md)
- External: GitHub issues [#16](https://github.com/CGuiho/mirror/issues/16),
  [#17](https://github.com/CGuiho/mirror/issues/17), and
  [#18](https://github.com/CGuiho/mirror/issues/18)
- Release: [Mirror 3.7.3](https://github.com/CGuiho/mirror/releases/tag/%40guiho/mirror%403.7.3)
- Result: All three issues are closed after public 3.7.2-to-3.7.3 command
  upgrade, visible 89.5 MiB progress, exact assets, scoped notes, and green CI.

## Citty CLI Migration

- Status: completed
- Created: `2026-07-14`
- Updated: `2026-07-14`
- Outcome: Replace Mirror's handwritten argument parsing and command routing with Citty while preserving release safety, command compatibility, contextual help, native distribution, and domain behavior.
- Spec: [docs/todo/citty-cli-migration.md](docs/todo/citty-cli-migration.md)
- Implementation: [docs/todo/citty-cli-migration-implementation.md](docs/todo/citty-cli-migration-implementation.md)
- Validation: [docs/validation/citty-cli-migration.md](docs/validation/citty-cli-migration.md)

## Mirror Upgrade Reliability

- Status: testing
- Created: `2026-07-15`
- Updated: `2026-07-19`
- Outcome: Make self-upgrade an observable, verified installation transaction; provide exact-version recovery after every bare upgrade; and list every published release newest first with channel and asset metadata.
- Spec: [docs/todo/upgrade-reliability.md](docs/todo/upgrade-reliability.md)
- Implementation: [docs/todo/upgrade-reliability-implementation.md](docs/todo/upgrade-reliability-implementation.md)
- Related files:
  - [docs/superpowers/specs/2026-07-15-upgrade-reliability-design.md](docs/superpowers/specs/2026-07-15-upgrade-reliability-design.md) - Approved architecture and behavior contract.
  - [docs/plans/upgrade-reliability-implementation.md](docs/plans/upgrade-reliability-implementation.md) - Executable implementation plan.
  - [docs/reviews/plans/upgrade-reliability-implementation-review.md](docs/reviews/plans/upgrade-reliability-implementation-review.md) - Plan-readiness review and execution verdict.
  - [docs/validation/upgrade-reliability.md](docs/validation/upgrade-reliability.md) - Verification evidence and remaining release gates.
- External: GitHub issue [#9](https://github.com/CGuiho/mirror/issues/9); GitHub issue [#10](https://github.com/CGuiho/mirror/issues/10)

## RFC 0034 CLI Compliance Migration

- Status: superseded by Mirror Go Production Migration
- Created: `2026-07-18T18:48:11+02:00`
- Updated: `2026-07-19`
- Outcome: Historical Bun/TypeScript migration record retained as evidence. Its
  runtime, npm, tag, and fourteen-asset contracts are no longer production
  authority; see the Go migration above.
- Spec: [docs/todo/rfc-0034-cli-compliance-migration.md](docs/todo/rfc-0034-cli-compliance-migration.md)
- Related files:
  - [docs/plans/rfc-0034-cli-compliance-migration.md](docs/plans/rfc-0034-cli-compliance-migration.md) - Approved step-by-step migration plan.
  - [docs/reviews/plans/rfc-0034-cli-compliance-migration-review.md](docs/reviews/plans/rfc-0034-cli-compliance-migration-review.md) - Ready-for-execution plan review.
  - [docs/todo/rfc-0034-cli-compliance-migration-implementation.md](docs/todo/rfc-0034-cli-compliance-migration-implementation.md) - Implementation record for MR-01 through MR-16.
  - [docs/reviews/implementation/rfc-0034-cli-compliance-migration-review.md](docs/reviews/implementation/rfc-0034-cli-compliance-migration-review.md) - Delivery-readiness implementation review.
  - [docs/validation/rfc-0034-cli-compliance-migration.md](docs/validation/rfc-0034-cli-compliance-migration.md) - Full verification evidence.
  - [docs/validation/rfc-0034-downstream-handoff.md](docs/validation/rfc-0034-downstream-handoff.md) - Consumer migration inventory.

## Mirror Public Installers And Platform Greeting

- Status: testing
- Created: `2026-07-20`
- Updated: `2026-07-20`
- Outcome: Make both public installer pipes standalone and reliable, and report the current platform in Mirror's deterministic no-argument greeting.
- Spec: [docs/todo/public-installers-and-platform-greeting.md](docs/todo/public-installers-and-platform-greeting.md)
- Related files:
  - [docs/validation/public-installers-and-platform-greeting.md](docs/validation/public-installers-and-platform-greeting.md) - Local, CI, release, and public installation evidence.
- External: GitHub issue [#12](https://github.com/CGuiho/mirror/issues/12); GitHub issue [#13](https://github.com/CGuiho/mirror/issues/13)

## Mirror Background Update Worker CPU Safety

- Status: completed
- Created: `2026-07-21T21:58:07+02:00`
- Updated: `2026-07-21`
- Outcome: Mirror `3.5.9` preserves its nonblocking release check while guaranteeing one bounded worker per cache, stale recovery, deterministic exit, foreground failure isolation, and idempotent UTF-8 PowerShell installation.
- Spec: [docs/todo/background-update-worker-cpu-safety.md](docs/todo/background-update-worker-cpu-safety.md)
- Related files:
  - [docs/validation/background-update-worker-cpu-safety.md](docs/validation/background-update-worker-cpu-safety.md) - Concurrency, process-count, timeout, stale-lock, CI, and release evidence.
