---
subject: mirror-pkg-maintenance
description: Embedded agent skill, prompt, and metadata-free managed instruction lifecycle.
parent: mirror-pkg
children: []
files: {maintenance.go: "Agent resource operations.", storage.go: "Filesystem storage and managed blocks."}
documents: {}
tags: [go, agents]
keywords: [skill bundle, instruction markers, frontmatter stripping]
flags: []
status: stable
---

Maintenance operations are explicit, idempotent, and operate in both agent
roots. Released prompt metadata is validated separately from the Markdown body
inserted between managed project markers.
