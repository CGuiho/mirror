---
name: "@guiho/mirror"
purpose: Introduce the published Mirror package and route users to its complete CLI documentation.
description: Package README for the RFC 0034-compliant Mirror CLI.
created: 2026-07-18
owner: mirror-mirror
flags: []
tags:
  - mirror
  - package
keywords:
  - semantic versioning
  - native CLI
---

# @guiho/mirror

Mirror is a Bun-native, TypeScript, Citty, and TypeBox CLI for deterministic
semantic project versioning.

```text
mirror
mirror init
mirror config show
mirror version plan patch
```

With no arguments Mirror prints a deterministic welcome page with product,
platform, architecture, version, help, and any cached stable-update notice.

`mirror config schema --save` persists the editor schema at
`~/.guiho/mirror/schema.json`; installers, upgrades, and `mirror init` refresh
it automatically.

See [`DOCS.md`](DOCS.md) for the complete command, configuration, agent,
upgrade, installer, npm bootstrap, exit-code, and release-asset contracts.
