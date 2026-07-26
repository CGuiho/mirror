---
subject: mirror-pkg-update
description: Bounded release discovery, cache, leases, and detached update workers.
parent: mirror-pkg
children: []
files:
  catalog.go: Canonical release discovery and target filtering.
  cache.go: Local update cache.
  worker.go: Bounded detached update worker.
documents: {}
tags: [go, updates]
keywords: [cache lease, bounded network]
flags: []
status: stable
---

Foreground startup remains local while guarded workers refresh release metadata.
