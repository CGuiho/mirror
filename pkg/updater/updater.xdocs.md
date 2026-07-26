---
subject: mirror-pkg-updater
description: Verified download, transactional executable replacement, journals, and rollback.
parent: mirror-pkg
children: []
files:
  upgrade.go: Candidate download, progress, checksum, and verification.
  rollback.go: Backup restoration contract.
  journal.go: Cross-process completion journal.
documents: {}
tags: [go, upgrade]
keywords: [sha256, transactional replacement, windows worker]
flags: []
status: stable
---

Upgrade transitions verify the complete candidate before mutating the installed executable.
