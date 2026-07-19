---
name: Mirror Technical Overview
purpose: Explain the current Mirror runtime, configuration, bootstrap, and release architecture.
description: Technical overview for the RFC 0034-compliant Mirror CLI.
created: 2026-07-18
owner: mirror
flags: []
tags:
  - mirror
  - architecture
keywords:
  - TypeBox
  - Citty
  - native binaries
---

# Mirror Technical Overview

The CLI entrypoint is `mirror/source/guiho-mirror-bin.ts`. Raw Citty command
definitions in `source/cli.ts` own routing, metadata, ordinary help, command-tree
help, and Markdown help. TypeBox schemas in `source/schema.ts` validate YAML,
cache data, release payloads, and CLI enum-like inputs.

Core CLI source is Bun-only. The isolated Node ESM npm bootstrap is
`mirror/scripts/mirror-bin.mjs`; it selects, caches, and delegates to a native
binary without containing Mirror versioning logic.

Configuration lookup is:

1. `--config <path>`;
2. `<effective-cwd>/mirror.yaml`;
3. `~/.guiho/mirror/mirror.yaml`.

The update cache is `~/.guiho/mirror/cache.json`. Foreground startup reads it
synchronously and detached update work performs network access. A loaded
configuration path is always reported.

Release automation builds the exact twelve `mirror-<platform>-<arch>` native
assets, using `darwin` for macOS, then adds `guiho-s-mirror.md` and
`guiho-i-mirror.md` for an exact total of fourteen assets. One TypeScript
manifest owns the exact filenames used by builds, workflow upload, and
post-upload verification.

GitHub Release descriptions contain only the exact version's `CHANGELOG.md`
section. The workflow extracts that section through the next level-two heading
and applies it on both release creation and idempotent reruns. Existing releases
have stale extra assets removed, expected assets replaced, and their notes
reconciled before the workflow asserts exactly fourteen unique filenames.
