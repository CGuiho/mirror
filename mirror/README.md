# 🪞 GUIHO Mirror

Deterministic semantic project versioning for Bun, npm, JSR, and Git.

Mirror reads one version source, calculates the next semantic version, builds a
transparent release plan, and applies that plan to configured outputs such as
`package.json`, `jsr.json`, and Git tags.

```text
source -> version engine -> plan -> outputs
```

Mirror is a CLI-only package. Its native executables are compiled with Bun and
do not require Node.js or Bun at runtime. The package-manager launcher uses Bun
to install and invoke the appropriate native executable.

## Installation

```bash
bun add -d @guiho/mirror
```

Direct native installers are also available:

```bash
# macOS or Linux
curl -fsSL https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/install.sh | bash
```

```powershell
# Windows PowerShell
irm https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/install.ps1 | iex
```

The canonical installers accept exact stable and prerelease versions, print the selected version/asset/URL before download, verify the temporary and installed binaries, replace transactionally, and roll back on failure.

## Quick Start

```bash
mirror init package.json
mirror config check
mirror version current
mirror version plan patch
mirror version apply patch --yes
```

Always inspect `mirror version plan <target>` before applying a release.
Supported targets are `major`, `premajor`, `minor`, `preminor`, `patch`,
`prepatch`, `prerelease`, and exact semantic versions.

## CLI Architecture

Mirror uses [Citty](https://github.com/unjs/citty) for its declarative command
tree, scoped argument parsing, aliases, and ordinary usage output. Domain logic
for version planning, release execution, hooks, configuration, agent automation,
self-management, reporting, and Git behavior remains independent of Citty.

- `-h` and `--help` show contextual Citty usage.
- `-v` and `--version` print the CLI version without loading configuration.
- `--help-tree` and `--help-docs` provide Mirror's extended custom help.
- `--dry-run` and legacy `-dy` preview release or self-management operations.
- `--output` and `--auxiliary` accept repeated or comma-separated values.
- Unknown commands, unknown scoped flags, extra positionals, and missing targets
  exit nonzero with contextual usage and never fall through to a release.

## Command Tree

```text
mirror
|- init [source]
|- config
|  |- show
|  |- check
|  `- schema
|- agents
|  |- install <local|global>
|  `- instructions
|- version
|  |- current
|  |- next <target>
|  |- plan <target>
|  `- apply <target>
|- upgrade
|  |- check
|  `- list
`- uninstall
```

`mirror upgrade` without a nested command performs the default native upgrade.

The command prints current/target/OS/architecture/asset/path/URL before downloading, then streams download, validation, replacement, and verification phases. It replaces and verifies the canonical executable immediately, rolls back on failure, and always prints an exact-version reinstall command plus a separate process-stop command. `mirror upgrade list` returns the complete SemVer-sorted stable and prerelease catalog with channel, date, current/latest markers, and compatible assets.

## Safety

- `version plan` is read-only.
- `version apply` requires confirmation unless `--yes` or `--dry-run` is used.
- Dirty-worktree, commit, tag, push, hook, and cleanup behavior is controlled by
  `mirror.config.toml` and explicit CLI overrides.
- `--push` is externally visible and should only be used when authorized.

## Documentation

See [DOCS.md](./DOCS.md) for the complete configuration schema, adapters,
release lifecycle, hooks, agent automation, native installation, and development
workflow.

## Development

Run package commands from this directory:

```bash
bun install
bun run typecheck
bun test
bun run build
bun run binary
```

Generated `bin/` assets are ignored and must not be edited by hand.
