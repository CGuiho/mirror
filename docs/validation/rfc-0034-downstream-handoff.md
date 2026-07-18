---
name: Mirror RFC 0034 Downstream YAML Handoff
purpose: Preserve the consumer inventory that must migrate after Mirror removes TOML support.
description: Inventory of GUIHO repositories that still contain legacy Mirror TOML configuration.
created: 2026-07-18
owner: mirror-docs-validation
flags: []
tags:
  - validation
  - migration
keywords:
  - mirror.yaml
  - downstream consumers
---

# Mirror RFC 0034 Downstream YAML Handoff

## Required Follow-up

Each listed path must be replaced by a repository-owned `mirror.yaml` using the
new schema. The owning repository must load its own instructions and Mirror
skill, validate `mirror config check`, and review `version plan` before release.
Mirror does not retain a fallback for these consumers.

| Repository | Current path |
| --- | --- |
| brain | `C:\GUIHO\brain\mirror.config.toml` |
| guiho-admin-core | `C:\GUIHO\guiho-admin-core\core\mirror.config.toml` |
| guiho-admin-ui | `C:\GUIHO\guiho-admin-ui\ui\mirror.config.toml` |
| guiho-core | `C:\GUIHO\guiho-core\core\mirror.config.toml` |
| guiho-main | `C:\GUIHO\guiho-main\mirror.config.toml` |
| guiho-ui | `C:\GUIHO\guiho-ui\mirror.config.toml` |
| liga40-core | `C:\GUIHO\liga40-core\mirror.config.toml` |
| liga40-main | `C:\GUIHO\liga40-main\mirror.config.toml` |
| liga40-redirect-core | `C:\GUIHO\liga40-redirect-core\mirror.config.toml` |
| nante40-main | `C:\GUIHO\nante40-main\mirror.config.toml` |
| runx | `C:\GUIHO\runx\mirror.config.toml` |
| superiority | `C:\GUIHO\superiority\mirror.config.toml` |
| suraia | `C:\GUIHO\suraia\suraia\mirror.config.toml` |
| turmab40 | `C:\GUIHO\turmab40\turmab40\mirror.config.toml` |
| xdocs | `C:\GUIHO\xdocs\mirror.config.toml` |

This is a point-in-time inventory captured on 2026-07-18. No consumer file was
modified by the Mirror package migration.
