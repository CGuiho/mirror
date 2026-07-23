---
name: guiho-s-mirror
description: Use whenever planning, applying, validating, or troubleshooting semantic project versioning with GUIHO Mirror.
purpose: Guide safe Mirror-managed semantic version planning and application.
created: 2026-07-18
owner: mirror-mirror-skills-guiho-s-mirror
flags: []
tags:
  - mirror
  - skill
keywords:
  - semantic versioning
  - mirror.yaml
metadata:
  version: "3.7.4"
---

# GUIHO Mirror

Use Mirror instead of manually editing version fields or creating release tags.

## Required Workflow

1. Read the repository instructions and `mirror.yaml`.
2. Run the repository typecheck and test commands.
3. Run `mirror config check`.
4. Run `mirror version plan <target>` and inspect every planned mutation.
5. Update the configured changelog only when `agents.write_changelog` is not `false`; use `agents.changelog_path` or `CHANGELOG.md`.
6. Commit release preparation before `mirror version apply <target> --yes`.
7. Apply only when version, commit, tag, and push effects are authorized.

Supported targets are `major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, `prerelease`, and exact semantic versions.

## Configuration

Mirror accepts YAML only and resolves configuration in this order:

1. `--config <path>`;
2. `<cwd>/mirror.yaml`;
3. `~/.guiho/mirror/mirror.yaml`.

It does not search parent directories.
