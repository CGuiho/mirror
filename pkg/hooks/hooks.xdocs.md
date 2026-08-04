---
subject: mirror-pkg-hooks
description: Typed Mirror command-hook execution, context, reporting, and lifecycle error aggregation.
parent: mirror-pkg
children: []
files:
  hooks.go: Platform command execution, hook sessions, context files, results, and errors.
  replace_other.go: Atomic hook-context replacement on non-Windows platforms.
  replace_windows.go: Windows atomic hook-context replacement through MoveFileExW.
documents: {}
tags: [go, hooks, lifecycle]
keywords: [command hooks, hook context, error hooks, shell execution]
flags: []
status: stable
---

Mirror hook sessions execute trusted command hooks sequentially while preserving
structured context, stdout-safe reporting, cancellation, and primary errors.
