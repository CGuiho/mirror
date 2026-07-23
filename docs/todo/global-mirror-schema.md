---
name: Global Mirror Schema
purpose: Track GitHub issue 14 from implementation through public acceptance.
description: Requirements for persisting Mirror's TypeBox configuration schema for native installations.
created: 2026-07-22
owner: mirror-docs-todo
flags:
  - completed
tags:
  - mirror
  - cli
  - schema
keywords:
  - issue 14
  - schema.json
  - yaml language server
---

# Global Mirror Schema

## Outcome

Mirror derives one JSON Schema from `MirrorRawConfigSchema` and atomically saves
it at `~/.guiho/mirror/schema.json`. `mirror config schema --save`, `mirror
init`, both public installers, both package installers, and successful
self-upgrades refresh it. The npm schema remains equivalent to the TypeBox
source and the release remains exactly fourteen assets.

## Acceptance

- Missing, stale, corrupt, and current global schemas are handled safely.
- JSON output reports `path`, `schemaVersion`, and `status`.
- Generated `mirror.yaml` uses a portable schema URL, never a machine-specific
  home path.
- Native installation works without `node_modules`.
- Tests, typecheck, binary build, installer validation, and public release pass.

## External

- [Mirror issue 14](https://github.com/CGuiho/mirror/issues/14)
- [Mirror 3.6.1 release](https://github.com/CGuiho/mirror/releases/tag/%40guiho/mirror%403.6.1)
