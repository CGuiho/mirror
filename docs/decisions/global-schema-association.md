---
name: Global Schema Association
purpose: Record the approved portable association for Mirror's globally persisted schema.
description: Explains why Mirror saves a local schema while committed YAML uses a portable HTTPS modeline.
created: 2026-07-22
owner: mirror-docs-decisions
flags:
  - decision
  - final
tags:
  - mirror
  - schema
  - yaml
keywords:
  - schema.json
  - yaml-language-server
  - file URI
---

# Global Schema Association

## Decision

Mirror saves the exact runtime schema at `~/.guiho/mirror/schema.json`, but
generated and committed `mirror.yaml` files use the canonical raw GitHub HTTPS
schema URL.

## Rationale

YAML language servers support URLs and absolute file locations, but do not
guarantee shell-style `~` expansion. An absolute file URI would expose and bind
a committed configuration to one user's home directory. The portable modeline
therefore supplies automatic editor association, while the deterministic global
copy supports offline editor mappings and native installations without an npm
package.

## Consequences

- `mirror config schema --save --format json` exposes the resolved local path.
- Install, init, and upgrade keep the local schema current.
- The schema is generated locally and does not become a fifteenth release asset.
