---
name: Complete YAML Configuration Migration
purpose: Track GitHub issue 15 through repository-wide removal of the obsolete configuration contract.
description: Requirements for making mirror.yaml the sole active and documented Mirror configuration.
created: 2026-07-22
owner: mirror-docs-todo
flags:
  - completed
tags:
  - mirror
  - yaml
  - migration
keywords:
  - issue 15
  - mirror.yaml
  - TOML removal
---

# Complete YAML Configuration Migration

## Outcome

Runtime discovery was already YAML-only. This task completes the migration by
removing the obsolete filename from tracked source, tests, plans, validation,
and historical design prose, converting the remaining command-schema display
from TOML notation to YAML, and requiring downstream consumers to use
`mirror.yaml`.

## Acceptance

- Mirror discovers, creates, reconciles, and documents only `mirror.yaml`.
- `mirror config schema` renders YAML-shaped examples.
- A repository-wide obsolete-filename scan returns no matches.
- RunX and XDocs receive an explicit downstream configuration handoff.

## External

- [Mirror issue 15](https://github.com/CGuiho/mirror/issues/15)
- [Mirror 3.6.1 release](https://github.com/CGuiho/mirror/releases/tag/%40guiho/mirror%403.6.1)
