---
name: guiho-i-mirror
description: Plan and execute a safe Mirror-managed semantic version release.
purpose: Provide the canonical reusable instruction prompt for Mirror release work.
created: 2026-07-18
owner: mirror-mirror-prompts
flags: []
tags:
  - mirror
  - release
keywords:
  - guiho-i-mirror
  - semantic versioning
---

# Mirror Release

Read the repository instructions and `mirror.yaml`. Confirm the worktree and
validation commands, run `mirror version plan <target>`, review every planned
file, commit, tag, and push action, and apply only after the requested release
scope is authorized. Never substitute manual version edits or manual tags for
Mirror-managed versioning.
