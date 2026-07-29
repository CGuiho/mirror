---
subject: mirror-devops
description: Go release build, verification, notes extraction, and null-safe standalone installers with stage-aware failures.
parent: mirror
children:
  - mirror-devops-extract-release-notes
  - mirror-devops-verify-release-assets
files:
  build-binaries.go: Build the exact 11-asset release set from the Go manifest.
  install.ps1: Null-safe standalone Windows amd64 and arm64 installer with stage-aware failures and transactional rollback.
  install.sh: Verified standalone Linux and Darwin installer.
documents:
  xdocs-overview.md: Generated companion overview for DevOps automation.
tags: [automation, go, release]
keywords: [static binaries, checksums, installer, invoke-expression, stage-aware errors]
flags: []
status: stable
---

DevOps tooling consumes the production Go contract and never publishes the legacy package.
