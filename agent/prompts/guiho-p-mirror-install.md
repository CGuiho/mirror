---
name: guiho-p-mirror-install
description: Install the GUIHO Mirror CLI via the canonical remote installer or a manually verified binary.
purpose: Provide the canonical one-time installation prompt for Mirror.
created: 2026-08-22
owner: mirror-mirror-prompts
flags: []
tags: [mirror, install]
keywords: [guiho-p-mirror-install, install prompt]
metadata:
  version: "1.0.0"
---

# Mirror Install

Install the GUIHO Mirror CLI by running exactly one command, chosen by the host operating system:

- Windows (PowerShell):
  irm https://raw.githubusercontent.com/CGuiho/mirror/main/devops/install.ps1 | iex
- macOS or Linux (POSIX sh):
  curl -fsSL https://raw.githubusercontent.com/CGuiho/mirror/main/devops/install.sh | sh

To install an exact version or a release channel, add --version 'X.Y.Z' or --channel '<name>' to the install.sh command, or -Version 'X.Y.Z' or -Channel '<name>' to the install.ps1 command. Never install Mirror through a package manager (npm, Bun, pip, or similar); no such package exists or is supported.

When the installer finishes, verify with `mirror --version`.

If the installer fails, fall back to a manual binary installation:
1. Download the asset matching the host platform from https://github.com/CGuiho/mirror/releases/latest - for example `mirror-windows-amd64.exe` or `mirror-linux-amd64` - and verify its SHA-256 digest against the release's `checksums.txt`.
2. Place the binary at `$HOME/.guiho/bin/mirror` (`mirror.exe` on Windows), creating the directory when needed.
3. On macOS and Linux, mark it executable with `chmod +x`. Ensure `$HOME/.guiho/bin` is on the `PATH`, then verify with `mirror --version`.

If installation still fails, create an issue at https://github.com/CGuiho/mirror/issues/new.

When installation succeeds, run `mirror init` in your project, complete any interactive reconciliation, and verify with `mirror --version`.
