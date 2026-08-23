---
name: mirror-uninstall
description: Uninstall the GUIHO Mirror CLI and optionally preserve config or data.
purpose: Provide the one-time uninstall prompt for Mirror.
created: 2026-08-22
owner: mirror
flags: []
tags: [mirror, uninstall]
keywords: [mirror-uninstall, uninstall prompt]
---

# Mirror Uninstall

Uninstall the GUIHO Mirror CLI by running exactly one command, chosen by the host operating system:

- Windows (PowerShell):
  irm https://raw.githubusercontent.com/CGuiho/mirror/main/devops/uninstall.ps1 | iex
- macOS or Linux (POSIX sh):
  curl -fsSL https://raw.githubusercontent.com/CGuiho/mirror/main/devops/uninstall.sh | sh

Alternatively use the built-in command: `mirror uninstall`.

By default, uninstallation removes all Mirror-owned artifacts including the launcher, versioned payloads, `~/.guiho/mirror/`, global skills, the managed instruction block, and the current project's `mirror.yaml`.

Destructive default (removes everything):
```
mirror uninstall --yes
```

Dry run (shows plan without changes):
```
mirror uninstall --dry-run
```

Preserve configuration and data:
```
mirror uninstall --preserve-config --preserve-data --yes
```

Options: `--preserve-config` keeps `mirror.global.yaml` and `mirror.yaml`; `--preserve-data` keeps databases and persistent data; `--dry-run` shows the plan; `--yes` confirms without prompt. Without `--yes` in a non-interactive terminal, uninstallation fails without changes.
