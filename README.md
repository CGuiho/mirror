# 🪞 GUIHO Mirror

**Open source project versioning for Bun, npm, JSR, and Git.**

Mirror is a powerful, deterministic CLI for semantic project versioning. It reads a single version source, calculates the next semantic version, builds a transparent release plan, and safely applies it to configured outputs like `package.json`, `jsr.json`, and Git tags.

```text
source -> version engine -> plan -> outputs
```

Mirror ships as a **native Bun-compiled CLI binary**. Direct installers run the native binary without requiring Node.js or Bun at runtime. Package-manager installs use a small Bun launcher with install-time and on-demand native binary download. The installed CLI can upgrade and uninstall itself. Git is required **only** for Git-based workflows (`source: "git"`, `output: ["git"]`, or commit/tag/push operations).

---

## 🚀 Quick Start

### Installation

NPM package: [@guiho/mirror](https://www.npmjs.com/package/@guiho/mirror)

```bash
npm install -D @guiho/mirror
# or
bun add -d @guiho/mirror
```

Direct native binary install on macOS/Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/install.sh | bash
```

Direct native binary install on Windows:

```powershell
irm https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/install.ps1 | iex
```

x64 installs prefer the `baseline` binary first, then fall back to default and
`modern`. The installers add the install directory to PATH where possible.

### Initializing

Create a default configuration file for your project type:

```bash
mirror init package.json
# or
mirror init jsr.json
# or
mirror init git
```

### Typical Workflow

```bash
# See current version
mirror version current

# Preview a patch release
mirror version plan patch

# Apply a minor release and create a Git commit & tag
mirror version apply minor --commit --yes

# Upgrade the installed native Mirror CLI
mirror upgrade

# Preview uninstalling the installed native Mirror CLI
mirror uninstall --dry-run
```

---

## 📖 Documentation

Mirror's architecture is based on a predictable read-plan-apply lifecycle, making it safe and easy to automate. It is designed to be easily consumed by humans and AI agents.

### Project Model

Mirror uses a strict release model:
- **Project:** The package, repository, application, or directory being versioned.
- **Source:** The single adapter Mirror reads the current version from.
- **Output:** The adapters Mirror writes the next version to.
- **Plan:** The read-only description of all intended changes before any mutation occurs.

### Adapters

Adapters connect Mirror to different versioning ecosystems:
- `package.json`: Reads/writes the `version` field in a `package.json` file.
- `jsr.json`: Reads/writes the `version` field in a `jsr.json` file.
- `git`: Reads versions from Git tags and creates release tags/commits. Requires Git to be installed and accessible in `PATH`.

### CLI Commands

Mirror provides a concise CLI with three main command groups:

#### `mirror init`
Creates or reconciles a `mirror.config.toml` file in the current directory. On an interactive terminal, `mirror init` asks step-by-step questions (version source, outputs, package path, auxiliary paths, tag template, commit/push) with defaults you accept by pressing Enter. Pass flags to answer non-interactively, and in CI / non-TTY environments it uses flags + defaults without prompting.
- `mirror init` (interactive wizard, or flags + defaults when non-interactive)
- `mirror init package.json` / `mirror init jsr.json` / `mirror init git` (source shortcut)
- Flags: `--source`, `--output`, `--package-file`, `--jsr-file`, `--auxiliary`, `--tag-template`, `--name`, `--preid`, `--commit`, `--push`, `--non-interactive`, `--yes`

Defaults: source `package.json`, outputs `package.json` + `git`.

#### `mirror config`
Validates and inspects configuration.
- `mirror config show`: Prints the resolved configuration.
- `mirror config check`: Validates configuration without output.
- `mirror config schema`: Prints the comprehensive configuration reference. Use `--format json` to print a JSON Schema for editor autocomplete.

#### `mirror agents`
Installs Mirror-aware agent guidance for projects that use AI coding agents.
- `mirror agents install local [--tool agents|claude|all]`: Synchronizes the bundled `guiho-s-mirror` skill locally. The default target is `.agents/skills`; Claude Code uses `.claude/skills`.
- `mirror agents install global [--tool agents|claude|all]`: Synchronizes the bundled `guiho-s-mirror` skill globally. The default target is `~/.agents/skills`; Claude Code uses `~/.claude/skills`.
- `mirror agents instructions [--tool agents|claude|all]`: Creates or updates Mirror guidance in `AGENTS.md` and/or `CLAUDE.md`.

#### `mirror upgrade`
Upgrades the installed native Mirror binary from GitHub Releases.
- `mirror upgrade`: Upgrade to latest compatible release.
- `mirror upgrade check`: Check latest release metadata.
- `mirror upgrade list`: List available release versions.
- Flags: `--version`, `--arch`, `--variant baseline|default|modern`, `--dry-run`, `--format text|json`.

#### `mirror uninstall`
Removes the installed native Mirror executable. On Windows, removal is scheduled after the current process exits.
- `mirror uninstall --dry-run`: Preview the executable that would be removed.
- `mirror uninstall`: Remove the installed native binary.

#### Help output
All commands support:
- `--help`: Text help for the current command.
- `--help-tree`: Tree view from the current command down through subcommands and flags.
- `--help-docs`: Markdown documentation for the current command.

#### `mirror version`
Manages the version lifecycle.
- `mirror version current`: Prints the current project version.
- `mirror version next <target>`: Prints the next version without side-effects.
- `mirror version plan <target>`: Builds and prints the release plan.
- `mirror version apply <target>`: Applies the release plan.

*Targets supported:* `major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, `prerelease`, or an exact semantic version (e.g., `2.0.0`).

### Configuration (`mirror.config.toml`)

Mirror looks for configuration via the `--config <path>` flag, `./mirror.config.toml`, or `./config/mirror.config.toml`.

```toml
schema = 1

[project]
name = "my-project"                    # Optional. Explicit project name.
name_source = "package.json"           # Optional. "package.json" or "jsr.json"

[version]
scheme = "semver"                      # Required. Only "semver" is supported.
source = "package.json"                # Required. "package.json", "jsr.json", or "git"
output = ["package.json", "git"]       # Required. Adapters to write to.
prerelease_id = "alpha"                # Optional. e.g., creates 1.0.1-alpha.0

[package]
path = "package.json"                  # Optional. Override path to package.json
auxiliary_paths = []                    # Optional. Extra package.json files that mirror the main version

[jsr]
path = "jsr.json"                      # Optional. Override path to jsr.json

[git]
tag_template = "{name}@{version}"      # Optional. Supported: "v{version}", "{name}@{version}", "{name}/v{version}"
commit = false                         # Optional. Create release commits. Default: false.
push = false                           # Optional. Push release refs. Default: false.
allow_dirty = false                    # Optional. Allow dirty Git worktree. Default: false.

[agents]
write_changelog = true                 # Optional. Tell agents changelog edits are allowed. Default: true.
changelog_path = "CHANGELOG.md"         # Optional. Changelog file path for agents. Default: "CHANGELOG.md".
auto_agents_md = true                  # Optional. Insert Mirror guidance into AGENTS.md/CLAUDE.md. Default: true.
auto_skill_install = true              # Optional. Install guiho-s-mirror globally when missing or outdated. Default: true.
skill_tool = "agents"                  # Optional. "agents", "claude", or "all". Default: "agents".
```

### Agent Automation

Mirror is designed to be safely used by AI agents. Project commands automatically check for Mirror guidance and the `guiho-s-mirror` skill, then add guidance or install the missing, legacy-named, or outdated skill when automation is enabled. `AGENTS.md` and `.agents/skills` remain the default. Set `skill_tool = "claude"` for Claude Code, or `skill_tool = "all"` to install both `~/.agents/skills` and `~/.claude/skills`.

Use `--tool claude` or `--tool all` as a one-off CLI override when you do not want to edit `mirror.config.toml`.

Instruction-file automation updates both `AGENTS.md` and `CLAUDE.md` when both exist. If only `CLAUDE.md` exists, Mirror updates it. If only `AGENTS.md` exists, Mirror updates it. If neither exists, Mirror creates `AGENTS.md` because it is the standard default. Running `mirror` with no arguments also performs this configured agent setup before showing help.

Set `write_changelog = false` when agents should skip changelog edits during release preparation. Set `changelog_path = "docs/CHANGELOG.md"` when the changelog is not at the project root. Set `auto_agents_md = false` to opt out of automatic guidance insertion, or `auto_skill_install = false` to opt out of automatic global skill installation.

### Safety & Git Automation

By default, `mirror version apply` prevents accidental mutations:
- Fails on a dirty Git worktree (unless `--allow-dirty` is used).
- Requires `--yes` to skip interactive confirmation (non-interactive environments).
- Never pushes release refs automatically unless configured or `--push` is passed.

When combining file outputs (`package.json`, `jsr.json`) with Git tag output, Mirror requires either `--commit` or `--push` so that the tag attaches to the release commit containing the updated files. For Git-only outputs, `--commit` will not create an empty commit; it simply tags `HEAD`.

---

## 🛠️ Development

Development tasks require Bun. Run from the `mirror/` directory:

```bash
cd mirror
bun install
bun run typecheck
bun test
bun run build
bun run binary
```

---

## 🎵 The Origin of the Name

The name **Mirror** was inspired by the music track ["MIRROR" by SleepyThePrince & DJ Dadda](https://www.youtube.com/watch?v=vi0didVAqjU), featured on the album *"Blackout"*.

In a deeper sense, the name also fits the purpose of the library perfectly: just as looking in a mirror reflects an exact snapshot of who we are, this library reflects the exact state and version of whatever you are building.
