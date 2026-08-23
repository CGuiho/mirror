---
subject: mirror-pkg
description: Framework-independent Mirror domain packages.
parent: mirror
children:
  - mirror-pkg-config
  - mirror-pkg-hooks
  - mirror-pkg-launcher
  - mirror-pkg-maintenance
  - mirror-pkg-release
  - mirror-pkg-semver
  - mirror-pkg-update
  - mirror-pkg-updater
  - mirror-pkg-versioning
files: {}
documents: {}
tags: [go, domain]
keywords: [configuration, hooks, stable launcher, versioning, upgrades, release matrix]
flags: []
status: stable
---

Domain packages are independent of Cobra presentation and have package-local tests.
