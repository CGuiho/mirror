---
name: Mirror Public Installers And Platform Greeting
purpose: Define the observable fixes for GitHub issues 12 and 13.
description: Requires standalone public installers and a deterministic platform-aware no-argument greeting.
created: 2026-07-20
owner: mirror-docs-todo
flags: []
tags:
  - mirror
  - installer
keywords:
  - curl pipe
  - platform greeting
---

# Mirror Public Installers And Platform Greeting

## Todo Index

- Task: `Mirror Public Installers And Platform Greeting`
- Status: testing
- Index: [todo.md](../../todo.md)
- Validation: [public-installers-and-platform-greeting.md](../validation/public-installers-and-platform-greeting.md)

## Outcome

The public Windows and POSIX commands install Mirror without depending on a
repository checkout, and a bare Mirror invocation identifies Windows, Linux, or
macOS using one deterministic line.

## Scope

### In scope

- Keep the PowerShell installer mechanically aligned with the working RunX
  installer, changing only Mirror identifiers.
- Keep the Bash installer mechanically aligned with the proven XDocs installer,
  changing only Mirror identifiers.
- Document `irm ... | iex` and `curl -fsSL ... | bash` in the public README.
- Print `Hello <platform> - mirror v<version>` for Windows, Linux, and macOS.
- Add focused installer and greeting regressions.

### Out of scope

- New installer frameworks, bootstrap compilers, or alternate package managers.
- Additional greeting decoration, animation, or nondeterministic output.

## Acceptance Signals

- The root `devops/install.sh` contains the complete installer and no relative
  `BASH_SOURCE` delegation.
- The public POSIX installer accepts `curl -fsSL <url> | bash`.
- The public PowerShell installer accepts `irm <url> | iex` under Restricted
  execution policy.
- Bare CLI output names the current supported platform exactly.
- Typecheck, tests, XDocs validation, CI, release publication, and public
  installer verification pass.

## External Trackers

- GitHub: [CGuiho/mirror#12](https://github.com/CGuiho/mirror/issues/12)
- GitHub: [CGuiho/mirror#13](https://github.com/CGuiho/mirror/issues/13)
