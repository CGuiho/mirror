Copyright (c) 2026 GUIHO Technologies as represented by CristÃ³vÃ£o GUIHO
All Rights Reserved.

# GUIHO Mirror TODO List

## Parent TODO

- Parent: [../guiho/TODO.md](../guiho/TODO.md)
- Parent AGENTS: [../guiho/AGENTS.md](../guiho/AGENTS.md)
- Local AGENTS: [./AGENTS.md](./AGENTS.md)
- Local context: Semantic project versioning and release workflow package for @guiho/mirror.


## Python Versioning Support

Add support for reading and updating Python package versions in Mirror. Initial planning should clarify which Python metadata files are in scope, such as `pyproject.toml`, `setup.cfg`, `setup.py`, package `__init__.py`, or another project convention.

## Python Source-To-Target Version Sync

Add an option for Python version propagation from a source project to a target project. Initial planning should define what "source" and "target" mean for Python projects, how the target version is selected or derived, and whether this should be a CLI option, configuration field, or both.

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
- Updated: `2026-07-15`
- Outcome: Make self-upgrade an observable, verified installation transaction; provide exact-version recovery after every bare upgrade; and list every published release newest first with channel and asset metadata.
- Spec: [docs/todo/upgrade-reliability.md](docs/todo/upgrade-reliability.md)
- Implementation: [docs/todo/upgrade-reliability-implementation.md](docs/todo/upgrade-reliability-implementation.md)
- Related files:
  - [docs/superpowers/specs/2026-07-15-upgrade-reliability-design.md](docs/superpowers/specs/2026-07-15-upgrade-reliability-design.md) - Approved architecture and behavior contract.
  - [docs/plans/upgrade-reliability-implementation.md](docs/plans/upgrade-reliability-implementation.md) - Executable implementation plan.
  - [docs/reviews/plans/upgrade-reliability-implementation-review.md](docs/reviews/plans/upgrade-reliability-implementation-review.md) - Plan-readiness review and execution verdict.
  - [docs/validation/upgrade-reliability.md](docs/validation/upgrade-reliability.md) - Verification evidence and remaining release gates.
- External: GitHub issue [#9](https://github.com/CGuiho/mirror/issues/9); GitHub issue [#10](https://github.com/CGuiho/mirror/issues/10)
