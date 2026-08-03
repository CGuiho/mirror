---
subject: mirror-devops
description: Go release build, verification, notes extraction, and standalone installers with POSIX shell support, Windows architecture fallbacks, and metadata-free managed instructions.
parent: mirror
children:
  - mirror-devops-extract-release-notes
  - mirror-devops-verify-release-assets
files:
  build-binaries.go: Build the exact 11-asset release set from the Go manifest.
  install.ps1: Null-safe standalone Windows installer with layered architecture detection, transactional rollback, and prompt frontmatter stripping.
  install.sh: POSIX sh Linux and Darwin installer with verified assets, transactional replacement, and prompt frontmatter stripping.
documents:
  xdocs-overview.md: Generated companion overview for DevOps automation.
tags: [automation, go, release]
keywords: [static binaries, checksums, installer, posix sh, curl pipe, invoke-expression, architecture fallback, stage-aware errors, frontmatter stripping]
flags: []
status: stable
---

DevOps tooling consumes the production Go contract and never publishes the legacy package.
