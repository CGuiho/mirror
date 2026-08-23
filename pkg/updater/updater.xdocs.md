---
subject: mirror-pkg-updater
description: Verified candidate download, stable-launcher payload activation, legacy transition, and pointer rollback.
parent: mirror-pkg
children: []
files:
  upgrade.go: Candidate download, progress, staged verification, immutable installation, and synchronous pointer activation.
  rollback.go: Raw-version and hidden self-test verification plus legacy rollback helpers.
  journal.go: Legacy cross-process completion journal retained only for direct-install transition compatibility.
  upgrade_test.go: Download, locking, stable activation, pointer rollback, target, and checksum tests.
  stable_integration_test.go: Native executable proof of launcher dispatch and synchronous older-to-newer activation.
documents: {}
tags: [go, upgrade]
keywords: [sha256, immutable payload, current.json, synchronous activation, legacy Windows bridge]
flags: []
status: stable
---

Stable-layout upgrades verify the complete candidate, install it immutably,
atomically activate its pointer, and verify through the launcher before success.
