# 🪞 GUIHO Mirror

**Open source project versioning for Bun, npm, JSR, and Git.**

Mirror is a powerful, deterministic CLI and TypeScript library for semantic project versioning. It reads a single version source, calculates the next semantic version, builds a transparent release plan, and safely applies it to configured outputs like `package.json`, `jsr.json`, and Git tags.

```text
source -> version engine -> plan -> outputs
```

Mirror runs on **Node >= 20** at runtime. Bun is the recommended development tool (build, test, typecheck). Git is required **only** for Git-based workflows (`source: "git"`, `output: ["git"]`, or commit/tag/push operations).

---

## 🚀 Quick Start

### Installation

```bash
npm install -D @guiho/mirror
# or
bun add -d @guiho/mirror
```

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
Creates or reconciles a `mirror.config.toml` file in the current directory.
- `mirror init package.json`
- `mirror init jsr.json`
- `mirror init git`

#### `mirror config`
Validates and inspects configuration.
- `mirror config show`: Prints the resolved configuration.
- `mirror config check`: Validates configuration without output.
- `mirror config schema`: Prints the comprehensive configuration reference.

#### `mirror agents`
Installs Mirror-aware agent guidance for projects that use AI coding agents.
- `mirror agents install local`: Installs the bundled `guiho-as-mirror` skill at `.agents/skills/guiho-as-mirror/SKILL.md`.
- `mirror agents install global`: Installs the bundled `guiho-as-mirror` skill at `~/.agents/skills/guiho-as-mirror/SKILL.md`.
- `mirror agents instructions`: Creates or updates `AGENTS.md` with the GUIHO Mirror semantic versioning section.

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
auto_agents_md = true                  # Optional. Insert Mirror guidance into AGENTS.md when present. Default: true.
auto_skill_install = true              # Optional. Install guiho-as-mirror globally when missing. Default: true.
```

### Agent Automation

Mirror is designed to be safely used by AI agents. Project commands automatically check for `AGENTS.md` and the `guiho-as-mirror` skill, then add the Mirror guidance or install the missing skill when automation is enabled. Running `mirror` with no arguments also performs this configured agent setup before showing help.

Set `write_changelog = false` when agents should skip changelog edits during release preparation. Set `changelog_path = "docs/CHANGELOG.md"` when the changelog is not at the project root. Set `auto_agents_md = false` to opt out of automatic guidance insertion, or `auto_skill_install = false` to opt out of automatic global skill installation.

### Safety & Git Automation

By default, `mirror version apply` prevents accidental mutations:
- Fails on a dirty Git worktree (unless `--allow-dirty` is used).
- Requires `--yes` to skip interactive confirmation (non-interactive environments).
- Never pushes release refs automatically unless configured or `--push` is passed.

When combining file outputs (`package.json`, `jsr.json`) with Git tag output, Mirror requires either `--commit` or `--push` so that the tag attaches to the release commit containing the updated files. For Git-only outputs, `--commit` will not create an empty commit; it simply tags `HEAD`.

---

## 💻 API Reference

Mirror exposes a fully-typed TypeScript API for custom automation scripts.

### Core Lifecycle Methods

```ts
import { buildVersionPlan, applyVersionPlan, executeVersionPlan } from '@guiho/mirror'

// 1. Build a read-only plan for a patch release
const plan = await buildVersionPlan('patch', { cwd: process.cwd() })

// 2. Inspect the plan
console.log(plan.currentVersion) // "1.0.0"
console.log(plan.nextVersion)    // "1.0.1"
console.log(plan.actions)        // Array of actions (write-file, git-commit, etc.)

// 3. Execute the plan manually
const result = await executeVersionPlan(plan, { dryRun: false, yes: true })

// OR: Build and apply in one step
await applyVersionPlan('minor', { cwd: process.cwd(), yes: true })
```

### Reading State

```ts
import { loadMirrorConfig, readCurrentVersion } from '@guiho/mirror'

// Load resolved configuration
const config = await loadMirrorConfig({ cwd: process.cwd() })

// Read the current version using the configured source
const version = await readCurrentVersion(config)
```

---

## 🛠️ Development

Development tasks require Bun and Node >= 20. Run from the `mirror/` directory:

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
