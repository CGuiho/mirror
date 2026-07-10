# GUIHO Mirror Documentation

GUIHO Mirror is a deterministic CLI for semantic project versioning. It reads one source of truth, calculates the next semantic version, builds a transparent release plan, and applies that plan to configured outputs such as `package.json`, `jsr.json`, and Git tags.

```text
source -> version engine -> plan -> outputs
```

Mirror is designed for human operators, CI jobs, and AI coding agents that need predictable release behavior instead of ad hoc version edits.

## Package Overview

- Package name: `@guiho/mirror`
- Runtime target: native Bun-compiled CLI binary
- Development runtime: Bun
- Package type: CLI-only
- CLI entrypoint: `source/guiho-mirror-bin.ts`
- Package-manager launcher path: `scripts/mirror-bin.ts`
- Standalone release assets: `bin/guiho-mirror-<os>-<arch>` or `bin/guiho-mirror-<os>-<arch>.exe`

The public package exposes a CLI named `mirror`. It does not maintain a public TypeScript API contract. The native CLI can upgrade itself from GitHub Releases and uninstall its own executable.

Mirror's implementation is Bun-native where Bun provides the runtime primitive. Runtime code uses Bun APIs for file IO, TOML parsing, shell/process execution, and binary compilation. Mirror uses an internal CLI router and keeps `semver` for semantic version calculations; do not add Node.js runtime imports or parser dependencies when Bun provides the capability.

## Core Model

Mirror uses a strict read-plan-apply lifecycle.

- Project: the package, repository, application, or directory being versioned.
- Source: the single adapter Mirror reads the current version from.
- Output: one or more adapters Mirror writes the next version to.
- Target: a release type or exact semantic version requested by the operator.
- Plan: the read-only description of all intended changes before mutation.
- Execution: the application of a previously built plan.

Planning is the main safety boundary. Operators and agents should inspect `mirror version plan <target>` before running `mirror version apply <target>`.

## Supported Version Adapters

### `package.json`

Reads and writes the `version` field in a configured `package.json` file. It can also read the package name when `project.name_source = "package.json"`.

Default path: `package.json`

### `jsr.json`

Reads and writes the `version` field in a configured `jsr.json` file. It can also read the package name when `project.name_source = "jsr.json"`.

Default path: `jsr.json`

### `git`

Reads versions from Git tags and writes release tags. Git is required only when `git` is used as the version source, as an output, or when release commits or pushes are enabled.

Supported tag templates:

- `v{version}`
- `{name}@{version}`
- `{name}/v{version}`

Templates that include `{name}` require a project name from `project.name`, `project.name_source = "package.json"`, or `project.name_source = "jsr.json"`.

## Release Targets

Mirror accepts semver release types and exact semantic versions.

Supported release types:

- `major`
- `premajor`
- `minor`
- `preminor`
- `patch`
- `prepatch`
- `prerelease`

Exact versions are also valid, for example `2.0.0` or `2.0.0-alpha.1`.

Prerelease identifiers come from `[version].prerelease_id` or the `--preid` CLI override. If no identifier is configured, semver prerelease targets use the default semver numeric prerelease format.

## Installation

Install the native binary directly on macOS or Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/install.sh | bash
```

Install the native binary directly on Windows:

```powershell
irm https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/install.ps1 | iex
```

Package-manager installs are also supported:

```bash
bun add -d @guiho/mirror
npm install -D @guiho/mirror
pnpm add -D @guiho/mirror
yarn add -D @guiho/mirror
```

Package-manager installs use a small Bun launcher plus install-time tooling that downloads the matching native binary into `vendor/mirror` on POSIX systems or `vendor/mirror.exe` on Windows. When a package runner such as `bun x` starts without a populated vendor binary, the launcher runs the same installer on demand before executing the native binary. Direct installers are the no-runtime path; package-manager installs require Bun for the launcher and install helper.

The installer prints progress messages so the user knows what is happening during the first-run download. On x64 platforms, installers use the `x64-baseline` variant first, then fall back to the default and `modern` binaries. This avoids "Illegal instruction" crashes on x86_64 CPUs that lack certain instruction-set extensions while still supporting newer variants when requested.

Mirror also self-manages after install:

```bash
mirror upgrade
mirror upgrade check
mirror upgrade list
mirror uninstall --dry-run
```

Bare `mirror` invocations run configured agent automation and show help immediately. Installed native binaries also start a non-blocking background update check when the cache is missing or stale. If a newer release is known on a later run, Mirror prints a cached notice telling the user to run `mirror upgrade`.

## Quick Start

Create a configuration file:

```bash
mirror init package.json
```

Inspect the current version:

```bash
mirror version current
```

Preview a patch release:

```bash
mirror version plan patch
```

Apply the release plan:

```bash
mirror version apply patch --yes
```

When combining file outputs with Git tag output, enable release commits so tags point at the commit containing the updated version files:

```bash
mirror version apply patch --commit --yes
```

## CLI Reference

### Global Flags

Global flags are available on commands that load configuration.

- `--config <path>`: Use an explicit `mirror.config.toml` path.
- `--cwd <path>`: Run as if Mirror started in this directory.
- `--format text|json`: Choose text output or JSON output.
- `--no-color`: Disable ANSI color output.
- `--verbose`: Print full error details and stack traces.
- `--tool agents|claude|all`: Override the configured agent skill target for commands that perform agent setup.
- `--help-tree`: Show the command tree from the current command.
- `--help-docs`: Print Markdown documentation for the current command.

### Override Flags

Version and config commands accept runtime overrides.

- `--source package.json|jsr.json|git`: Override the configured version source.
- `--output <adapter>`: Override outputs. Repeat the flag or comma-separate values.
- `--package-file <path>`: Override `[package].path`.
- `--jsr-file <path>`: Override `[jsr].path`.
- `--preid <identifier>`: Override `[version].prerelease_id`.

### Apply Flags

`mirror version apply` accepts additional flags.

- `--dry-run` or `-dy`: Build and print the plan without applying it.
- `--commit`: Create a release commit when file outputs changed.
- `--push`: Create the release commit when needed, then push release refs.
- `--allow-dirty`: Allow release in a dirty Git worktree.
- `--yes` or `-y`: Apply without interactive confirmation.

### `mirror init`

Creates `mirror.config.toml` in the current working directory. When a configuration file already exists, `mirror init` reconciles missing default keys into it without overwriting user-configured values. Use `--yes` only when you intentionally want to replace the file with freshly generated defaults.

On an interactive terminal, `mirror init` runs a step-by-step wizard for the core fields (version source, outputs, package path, auxiliary package paths, jsr path, git tag template, commit, push). Each prompt shows a default that you accept by pressing Enter. Defaults are source `package.json` and outputs `package.json` + `git`. The Git tag template prompt presents numbered options instead of a free-text field:

```text
Git tag template:
  1. v{version}
  2. {name}@{version}  (default)
  3. {name}/v{version}
Choice [2]:
```

Every answer also has a flag, so the command runs fully non-interactively when flags are provided. In non-TTY environments (CI, AI agents) or with `--non-interactive`/`--yes`, Mirror skips prompts and uses flags + defaults instead of waiting for input.

Init flags: `--source`, `--output`, `--package-file`, `--jsr-file`, `--auxiliary`, `--tag-template`, `--name`, `--preid`, `--commit`, `--push`, `--non-interactive`, `--yes`.

Generated configuration files start with a `#:schema` directive pointing at the bundled JSON Schema (`./node_modules/@guiho/mirror/schema/mirror.config.schema.json`) so editors with Taplo / Even Better TOML provide autocomplete and validation.

```bash
mirror init package.json
mirror init jsr.json
mirror init git
```

Use `--yes` to overwrite an existing configuration file.

### `mirror config`

Validates and inspects configuration.

```bash
mirror config show
mirror config check
mirror config schema
```

- `show`: Prints the resolved configuration after defaults and CLI overrides.
- `check`: Validates configuration, adapter files, Git availability, and supported Git tag templates.
- `schema`: Prints the configuration reference. `--format json` prints a JSON Schema for editor autocomplete; the same schema ships at `schema/mirror.config.schema.json`.

### `mirror agents`

Installs Mirror-aware AI-agent guidance.

```bash
mirror agents install local
mirror agents install global
mirror agents install global --tool all
mirror agents instructions
```

- `install local`: Synchronizes the bundled skill in the project. Default path: `.agents/skills/guiho-s-mirror/SKILL.md`.
- `install global`: Synchronizes the bundled skill globally. Default path: `~/.agents/skills/guiho-s-mirror/SKILL.md`.
- `--tool agents|claude|all`: Selects the skill target. `agents` is the default, `claude` writes `.claude/skills` or `~/.claude/skills`, and `all` writes both targets.
- `instructions`: Creates or updates `AGENTS.md` and/or `CLAUDE.md` with the protected GUIHO Mirror semantic versioning section.

Global skill installation uses the user home directory. Tests and automation can override that home root with `MIRROR_AGENT_HOME`.

Explicit skill installation is authoritative: Mirror removes stale `guiho-as-mirror` and `guiho-s-mirror` skill directories for the selected scope, then writes the bundled `guiho-s-mirror` skill fresh. The installed skill frontmatter includes a `version` field from the installed `@guiho/mirror` package version.

Automatic skill installation is global-only by default. Use `mirror agents install local` when a project-local `.agents/skills/guiho-s-mirror/SKILL.md` or `.claude/skills/guiho-s-mirror/SKILL.md` copy is intentionally needed.

### `mirror version`

Reads, plans, and applies version changes.

```bash
mirror version current
mirror version next <target>
mirror version plan <target>
mirror version apply <target> --yes
```

- `current`: Prints the current version from the configured source.
- `next`: Prints the next version without checking outputs.
- `plan`: Builds and prints the read-only release plan.
- `apply`: Applies the release plan.

### `mirror upgrade`

Upgrades the installed native Mirror binary from GitHub Releases. Source checkouts refuse self-upgrade to avoid replacing the Bun runtime or development launcher by mistake.

```bash
mirror upgrade
mirror upgrade --dry-run
mirror upgrade --version 3.4.0
mirror upgrade --variant modern
mirror upgrade check
mirror upgrade list
```

Flags: `--version <version>`, `--arch <x64|arm64>`, `--variant <baseline|default|modern>`, `--dry-run`, `--format text|json`.

### `mirror uninstall`

Removes the installed native Mirror executable. On Windows, removal is scheduled after the current process exits because the executable cannot delete itself while locked.

```bash
mirror uninstall --dry-run
mirror uninstall
```

Flags: `--dry-run`, `--format text|json`.

## Configuration Reference

Mirror discovers configuration in this order:

1. Explicit `--config <path>`
2. `mirror.config.toml` in the effective current working directory
3. `config/mirror.config.toml` in the effective current working directory

Root configuration takes precedence over nested `config/mirror.config.toml`.

Full configuration example:

```toml
schema = 1

[project]
name = "my-project"
name_source = "package.json"

[version]
scheme = "semver"
source = "package.json"
output = ["package.json", "git"]
prerelease_id = "alpha"

[package]
path = "package.json"
auxiliary_paths = []

[jsr]
path = "jsr.json"

[git]
tag_template = "{name}@{version}"
commit = false
push = false
allow_dirty = false

[agents]
write_changelog = true
changelog_path = "CHANGELOG.md"
auto_agents_md = true
auto_skill_install = true
skill_tool = "agents"
```

### `schema`

Required. Must be `1`.

### `[project]`

- `name`: Optional explicit project name.
- `name_source`: Optional adapter used to read the project name. Supported values are `package.json` and `jsr.json`.

Use `name` for Git-only projects or when the package metadata name should not be used in tags.

### `[version]`

- `scheme`: Required when present. Only `semver` is supported.
- `source`: Required. Supported values are `package.json`, `jsr.json`, and `git`.
- `output`: Required non-empty array. Supported values are `package.json`, `jsr.json`, and `git`.
- `prerelease_id`: Optional prerelease identifier, for example `alpha` or `beta`.

Exactly one source is used. Multiple outputs are allowed.

### `[package]`

- `path`: Optional path to `package.json`. Default: `package.json`.
- `auxiliary_paths`: Optional array of extra `package.json` files that mirror the main package version. Default: `[]`.

The main package path remains the source of truth for package version reads and project name reads. Auxiliary package files are write-only mirrors: when `package.json` is in `[version].output`, Mirror plans and writes the same next version to each auxiliary package file and includes those files in release commits.

### `[jsr]`

- `path`: Optional path to `jsr.json`. Default: `jsr.json`.

### `[git]`

- `tag_template`: Optional tag format. Default: `v{version}`.
- `commit`: Optional release commit default. Default: `false`.
- `push`: Optional release push default. Default: `false`.
- `allow_dirty`: Optional dirty worktree behavior. Default: `false`.

If `push = true`, commit behavior is implied when file outputs are present. If file outputs and Git tag output are combined, Mirror requires commit or push behavior so the tag points at the version commit.

### `[agents]`

Agent settings tell AI coding agents how to prepare release documentation and whether Mirror should install helper guidance automatically.

- `write_changelog`: Optional. Tell agents whether changelog edits are allowed. Default: `true`.
- `changelog_path`: Optional. Changelog file path for agents. Default: `CHANGELOG.md`.
- `auto_agents_md`: Optional. Insert Mirror guidance into `AGENTS.md` and/or `CLAUDE.md`. Default: `true`.
- `auto_skill_install`: Optional. Install `guiho-s-mirror` globally when missing or outdated. Default: `true`.
- `skill_tool`: Optional. Agent skill target for automatic global installs. Supported values are `agents`, `claude`, and `all`. Default: `agents`.

Set `write_changelog = false` when agents must skip changelog edits, even if a changelog exists. Set `changelog_path` when the changelog is not at the project root or when a package inside a monorepo writes release notes elsewhere.

Mirror uses standard agent skill directories:

- Agents local: `.agents/skills/<skill-name>/SKILL.md`
- Agents global: `~/.agents/skills/<skill-name>/SKILL.md`
- Claude Code local: `.claude/skills/<skill-name>/SKILL.md`
- Claude Code global: `~/.claude/skills/<skill-name>/SKILL.md`

## Agent Automation

Mirror can self-provision AI-agent instructions for projects that use standard agent skill directories.

When automation is enabled, project commands check for instruction files and for global `guiho-s-mirror` skill installation. `AGENTS.md` and `~/.agents/skills` are the default. If `skill_tool = "claude"`, automatic global skill installation targets `~/.claude/skills`; if `skill_tool = "all"`, Mirror installs both global targets. If guidance is missing, the legacy `guiho-as-mirror` skill is present, or the installed skill version is older than the bundled skill version, Mirror notifies the user and writes synchronized guidance or skill files. Running `mirror` with no arguments performs this configured setup before showing help. Mirror does not automatically write a local skill file; local installation is explicit.

Use `--tool claude` or `--tool all` as a one-off override for commands that perform agent setup when you do not want to edit `mirror.config.toml`.

Instruction-file automation follows project files already present. If both `AGENTS.md` and `CLAUDE.md` exist, Mirror updates both. If only `CLAUDE.md` exists, Mirror updates it. If only `AGENTS.md` exists, Mirror updates it. If neither file exists, Mirror creates `AGENTS.md` because it is the standard default.

Automation is controlled by `[agents]`.

- Disable instruction-file insertion with `auto_agents_md = false`.
- Disable automatic global skill installation with `auto_skill_install = false`.
- Install Claude Code global skills with `skill_tool = "claude"` or install both tool targets with `skill_tool = "all"`.
- Disable changelog edits by agents with `write_changelog = false`.
- Direct agents to the correct changelog with `changelog_path = "path/to/CHANGELOG.md"`.

The generated instruction section is wrapped in `<!-- BEGIN GUIHO MIRROR - DO NOT EDIT THIS SECTION -->` and `<!-- END GUIHO MIRROR -->` markers so agents know the block is Mirror-managed. It instructs agents to invoke `guiho-s-mirror` for versioning work, inspect `mirror.config.toml`, respect `write_changelog`, and use `changelog_path` for changelog edits. Mirror replaces existing marked Mirror sections so older `guiho-as-mirror` guidance is updated instead of duplicated. Use `mirror agents install local` only when a project-local skill copy is desired explicitly.

## Release Safety Rules

Mirror intentionally separates planning from mutation.

- Always run `mirror version plan <target>` before applying a release.
- Do not hand-edit configured version fields as a substitute for Mirror.
- Do not create release tags manually for Mirror-managed releases unless recovering intentionally.
- Do not apply after failed typecheck or tests.
- Do not push release refs unless requested or configured.
- Do not continue on a dirty Git worktree unless `allow_dirty = true` or `--allow-dirty` was provided intentionally.

`mirror version apply` refuses to mutate unless `--yes` is passed, unless `--dry-run` is used.

## Lifecycle Hooks

Mirror supports lifecycle hooks that run shell commands at defined points during `mirror version apply`. Hooks are configured in the `[hooks]` section of `mirror.config.toml`.

### Lifecycle Tree

```
before:everything              # Runs once, before anything else
  │
  ├─ before:plan               # Runs before buildVersionPlan()
  │    buildVersionPlan()      # Plan construction (read-only)
  │    after:plan              # Runs after plan is built
  │
  ├─ before:apply              # Runs before executeVersionPlan()
  │    │
  │    ├─ before:write         # Runs before each file-write batch
  │    │    write-file(s)      # Mutate package.json / jsr.json
  │    │    after:write        # Runs after all file writes
  │    │
  │    ├─ before:commit        # Runs before git commit
  │    │    git-commit         # git add + git commit
  │    │    after:commit       # Runs after git commit
  │    │
  │    ├─ before:tag           # Runs before git tag
  │    │    git-tag            # git tag -m "..."
  │    │    after:tag          # Runs after git tag
  │    │
  │    ├─ before:push          # Runs before git push
  │    │    git-push           # git push + git push --tags
  │    │    after:push         # Runs after git push
  │    │
  │    after:apply             # Runs after executeVersionPlan() completes (always runs)
  │
  after:everything             # Runs once, after everything else (always runs)
```

### Hook Configuration

```toml
[hooks]
before_everything = "npm run typecheck"
after_everything  = "echo 'Release complete!'"

before_plan = ["npm run lint", "npm run typecheck"]
after_plan  = "echo 'Plan is ready'"

before_apply = "npm run build"
after_apply  = "node scripts/notify-release.js"

before_write  = "echo 'Writing version files...'"
after_write   = "echo 'Files written'"

before_commit = ["npm run format", "echo 'Committing...'"]
after_commit  = "echo 'Committed'"

before_tag   = "echo 'Tagging release...'"
after_tag    = "echo 'Tagged'"

before_push  = "echo 'Pushing...'"
after_push   = "echo 'Pushed'"
```

- Each hook key maps to a string (single command) or array of strings (multiple commands run sequentially).
- Hook names use underscores (`before_everything`) in TOML, which normalizes to colon form (`before:everything`) internally.
- Hook commands run in the project root directory through the default platform shell.
- Action-level hooks (`before:write`, `before:commit`, `before:tag`, `before:push` and their `after:` variants) fire only when the corresponding action is part of the plan.
- Hooks are skipped during `--dry-run`.

### Hook Error Handling

- When a hook exits with a non-zero code, Mirror stops the pipeline and reports the failure.
- `after:apply` and `after:everything` always run, even when a prior hook or action failed. This ensures cleanup and notification hooks fire reliably.

### Hook Environment Variables

Every hook receives `MIRROR_*` environment variables with release context:

| Variable               | Scope        | Description                                           |
|------------------------|--------------|-------------------------------------------------------|
| `MIRROR_CWD`           | Always       | Project root directory                                |
| `MIRROR_CONFIG_PATH`   | Always       | Path to resolved `mirror.config.toml`                 |
| `MIRROR_SOURCE`        | Always       | Version source adapter                                |
| `MIRROR_OUTPUT`        | Always       | Comma-separated output adapters                       |
| `MIRROR_TARGET`        | Always       | The release target argument                           |
| `MIRROR_CURRENT`       | Plan+        | Current version string                                |
| `MIRROR_NEXT`          | Plan+        | Next version string                                   |
| `MIRROR_PROJECT_NAME`  | Plan+        | Resolved project name                                 |
| `MIRROR_GIT_TAG`       | Plan+        | Rendered git tag (if git output)                      |
| `MIRROR_FILE_PATHS`    | Plan+        | Comma-separated file output paths                     |
| `MIRROR_COMMIT_ENABLED`| Plan+        | `true`/`false`                                        |
| `MIRROR_PUSH_ENABLED`  | Plan+        | `true`/`false`                                        |
| `MIRROR_FILE_PATH`     | Write        | Path being written to                                 |
| `MIRROR_FILE_CURRENT`  | Write        | Current version in the file                           |
| `MIRROR_FILE_NEXT`     | Write        | Next version being written                            |
| `MIRROR_COMMIT_MSG`    | Commit       | Commit message                                        |
| `MIRROR_COMMIT_PATHS`  | Commit       | Space-separated paths being committed                 |
| `MIRROR_TAG`           | Tag          | Git tag being created                                 |
| `MIRROR_INCLUDE_COMMIT`| Push         | `true`/`false`                                        |
| `MIRROR_INCLUDE_TAGS`  | Push         | `true`/`false`                                        |
| `MIRROR_APPLIED`       | Results      | `true`/`false` (whether execution actually applied)    |
| `MIRROR_DRY_RUN`       | Results      | `true`/`false`                                        |

"Plan+" means the variable is available starting from `before:plan` and all later hooks. "Write", "Commit", "Tag", and "Push" mean the variable is available at the corresponding action-level hooks. "Results" means `after:apply` and `after:everything`.

## Recommended Agent Release Workflow

When an AI coding agent prepares a Mirror-managed release, it should follow this sequence.

1. Confirm the target and project root.
2. Run `mirror config show` and inspect `allow_dirty`, `write_changelog`, and `changelog_path`.
3. Check `git status --short` when dirty worktrees are not allowed.
4. Run the project typechecker.
5. Run the project test suite.
6. Run `mirror version plan <target>`.
7. Update release documentation when needed.
8. Update `[agents].changelog_path` only when `write_changelog` is not false and the file exists or is part of the release process.
9. Commit release-preparation documentation before applying the version bump.
10. Run `mirror version apply <target> --yes`, adding `--commit` when file outputs and Git tag output are combined.

## Documentation Requirement Before Publishing

Every behavior change must be documented before publishing a new version. This includes changes to CLI commands, configuration fields, release behavior, Git behavior, package contents, agent automation, tests that describe public behavior, and operational workflows.

Before a version is published, update this file and any other relevant user-facing documentation so the published package describes the behavior that is actually shipping. If a code change does not require documentation, the release preparation should still state why no documentation update was needed.

## Internal Source Map

- `source/guiho-mirror.ts`: internal source aggregation for tests and CLI internals, not a public API contract.
- `source/guiho-mirror-bin.ts`: CLI binary entrypoint.
- `source/cli.ts`: internal command router, CLI argument mapping, and process-facing error handling.
- `source/help.ts`: data-driven help text, command-tree output, and Markdown help-doc rendering.
- `source/self-management.ts`: background update checks, update cache, native binary upgrade, and uninstall helpers.
- `source/config.ts`: Bun TOML discovery, schema validation, defaulting, init config generation, init reconciliation, and override merge.
- `source/init.ts`: init answer resolution, interactive prompts (TTY-only), and defaults.
- `source/schema.ts`: JSON Schema for `mirror.config.toml` and the `#:schema` reference.
- `source/types.ts`: public and internal TypeScript types.
- `source/version.ts`: `semver` target validation and next-version resolution.
- `source/adapters.ts`: package, JSR, and Git read/write primitives.
- `source/plan.ts`: validation and read-only release plan construction.
- `source/executor.ts`: mutation layer for file writes, Git commits, tags, and pushes.
- `source/hooks.ts`: lifecycle hook configuration, execution, and environment variable construction.
- `source/path.ts`: small path helpers used instead of Node.js `path` imports.
- `source/runtime.ts`: Bun-native file, process, and shell helpers.
- `source/build-binaries.ts`: multi-target Bun binary compilation script.
- `source/reporter.ts`: text and JSON report formatting.
- `source/agents.ts`: agent skill installation and AGENTS.md guidance automation.
- `source/errors.ts`: user-facing errors with stable exit codes.
- `source/guiho-mirror.spec.ts`: Bun test coverage for configuration, adapters, planning, execution, CLI behavior, Git behavior, and agent automation.
- `skills/guiho-s-mirror/SKILL.md`: bundled AI-agent skill installed by `mirror agents` commands.

## Development Workflow

Run package commands from `mirror/`.

```bash
bun install
bun run typecheck
bun test
bun run build
bun run binary
```

Generated outputs are ignored and should not be hand-edited.

- `bin/`: ignored local compiled binary output and release asset staging.
- `vendor/`: package-manager install destination for the selected native binary.

There is no lint or formatter config. Existing source style is strict TypeScript, ESM imports, single quotes, and no semicolons.

## Testing

The test suite uses `bun test` and `bun:test`.

Current tests cover:

- CLI flag parsing and short aliases.
- Config discovery and validation.
- CLI overrides over config values.
- Package and JSR version reads/writes.
- Semver target resolution.
- Git tag parsing and rendering.
- Release plan construction.
- Apply behavior, dry-run behavior, commits, tags, pushes, and dirty worktree checks.
- Git unavailable behavior.
- Agent automation settings, instruction-file insertion, skill installation, and changelog path guidance.
- Native CLI self-management helpers, command help docs/tree rendering, and package launcher first-run behavior.

Run all tests:

```bash
bun test
```

Run one file:

```bash
bun test source/guiho-mirror.spec.ts
```

## Build and Binary

Compile native binaries:

```bash
bun run binary
```

The binary build writes `bin/mirror` for local validation and platform release assets for Linux, macOS, and Windows across arm64, x64, x64-baseline, and x64-modern targets. The full matrix is:

- `guiho-mirror-linux-arm64`
- `guiho-mirror-linux-x64`
- `guiho-mirror-linux-x64-baseline`
- `guiho-mirror-linux-x64-modern`
- `guiho-mirror-windows-arm64.exe`
- `guiho-mirror-windows-x64.exe`
- `guiho-mirror-windows-x64-baseline.exe`
- `guiho-mirror-windows-x64-modern.exe`
- `guiho-mirror-macos-arm64`
- `guiho-mirror-macos-x64`
- `guiho-mirror-macos-x64-baseline`
- `guiho-mirror-macos-x64-modern`

Do not publish the full `bin/` matrix inside the npm package; upload those files as GitHub release assets and let installers download the matching one. The publish workflow creates the tag release when missing, uploads or replaces `bin/guiho-mirror-*` assets, and verifies that all 12 release assets exist. The compiled binary embeds fallback `guiho-s-mirror` skill content so `mirror agents install local` and `mirror agents install global` still work when adjacent package files are not available.

On x64 platforms, installers and self-upgrade use the `x64-baseline` variant first. The `x64-baseline` variant avoids "Illegal instruction" crashes on x86_64 CPUs that lack certain instruction-set extensions. The `x64` and `x64-modern` variants are available as fallback or explicit opt-in assets.

## Publishing Checklist

Before publishing a new version:

1. Confirm intended changes are committed.
2. Confirm `DOCS.md` reflects all changed behavior.
3. Confirm other relevant docs are updated, including `README.md`, `AGENTS.md`, and the configured changelog path when applicable.
4. Run `bun run typecheck`.
5. Run `bun test`.
6. Run `bun run binary`.
7. Confirm the tag workflow uploads and verifies all 12 generated platform binaries as release assets.
8. Run `mirror version plan <target>`.
9. Commit release documentation updates before applying the version bump.
10. Run `mirror version apply <target> --yes` with the required commit or push flags.

Do not publish a new version when documentation is stale relative to the code being released.

The GitHub Actions CI and publish workflows are Bun-first and do not use Node-based actions or npm/node commands. They use shell `git`, shell Bun installation, Bun commands, and `gh` for GitHub Release asset publication.

## Troubleshooting

### Configuration not found

Run `mirror init package.json`, `mirror init jsr.json`, or `mirror init git` from the project root, or pass `--config <path>`.

### Adapter file not found

Check `[package].path`, `[package].auxiliary_paths`, or `[jsr].path`, or pass `--package-file` or `--jsr-file`.

### Auxiliary package version did not change

Ensure `package.json` is present in `[version].output` and the file is listed in `[package].auxiliary_paths`.

### Unsupported Git tag template

Use one of the supported templates: `v{version}`, `{name}@{version}`, or `{name}/v{version}`.

### Git executable not found

Install Git or remove Git from the configured source/output. Git is required only for Git-based workflows.

### Dirty Git worktree

Commit or stash changes before applying a release, or intentionally enable `allow_dirty = true` or pass `--allow-dirty`.

### File outputs with Git tag output require commit or push

Use `--commit`, `--push`, `[git].commit = true`, or `[git].push = true` so the release tag points at the commit containing updated version files.

### Changelog should not be edited

Set `[agents].write_changelog = false` in `mirror.config.toml`.

### Changelog is not at project root

Set `[agents].changelog_path` to the correct path, for example `changelog_path = "../CHANGELOG.md"` in a package subdirectory.
