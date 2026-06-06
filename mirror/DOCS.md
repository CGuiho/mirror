# GUIHO Mirror Documentation

GUIHO Mirror is a deterministic CLI and TypeScript library for semantic project versioning. It reads one source of truth, calculates the next semantic version, builds a transparent release plan, and applies that plan to configured outputs such as `package.json`, `jsr.json`, and Git tags.

```text
source -> version engine -> plan -> outputs
```

Mirror is designed for human operators, CI jobs, and AI coding agents that need predictable release behavior instead of ad hoc version edits.

## Package Overview

- Package name: `@guiho/mirror`
- Runtime target: Node >= 20
- Development runtime: Bun
- Package type: ESM
- Library entrypoint: `source/guiho-mirror.ts`
- CLI entrypoint: `source/guiho-mirror-bin.ts`
- TypeScript build output: `library/`
- Standalone binary output: `bin/mirror` or `bin/mirror.exe`

The public package exposes a CLI named `mirror` and a TypeScript API for loading configuration, building release plans, reading versions, and applying version changes.

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

Install Mirror as a development dependency:

```bash
bun add -d @guiho/mirror
```

Or with npm:

```bash
npm install -D @guiho/mirror
```

Use the CLI through the package manager or through the installed `mirror` binary.

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

Creates `mirror.config.toml` in the current working directory.

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
- `schema`: Prints the configuration reference.

### `mirror agents`

Installs Mirror-aware AI-agent guidance.

```bash
mirror agents install local
mirror agents install global
mirror agents instructions
```

- `install local`: Writes `.agents/skills/guiho-as-mirror/SKILL.md` in the project.
- `install global`: Writes `~/.agents/skills/guiho-as-mirror/SKILL.md`.
- `instructions`: Creates or updates `AGENTS.md` with the GUIHO Mirror semantic versioning section.

Global skill installation uses the user home directory. Tests and automation can override that home root with `MIRROR_AGENT_HOME`.

Automatic skill installation is global-only by default. Use `mirror agents install local` when a project-local `.agents/skills/guiho-as-mirror/SKILL.md` copy is intentionally needed.

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
- `auto_agents_md`: Optional. Insert Mirror guidance into `AGENTS.md` when present. Default: `true`.
- `auto_skill_install`: Optional. Install `guiho-as-mirror` globally when missing. Default: `true`.

Set `write_changelog = false` when agents must skip changelog edits, even if a changelog exists. Set `changelog_path` when the changelog is not at the project root or when a package inside a monorepo writes release notes elsewhere.

Mirror uses standard agent skill directories:

- Local: `.agents/skills/<skill-name>/SKILL.md`
- Global: `~/.agents/skills/<skill-name>/SKILL.md`

## Agent Automation

Mirror can self-provision AI-agent instructions for projects that use standard agent skill directories.

When automation is enabled, project commands check for `AGENTS.md` and for global `guiho-as-mirror` skill installation. If guidance is missing, Mirror notifies the user and writes the missing global skill or AGENTS section. Mirror does not automatically write a local skill file; local installation is explicit.

Automation is controlled by `[agents]`.

- Disable AGENTS.md insertion with `auto_agents_md = false`.
- Disable automatic global skill installation with `auto_skill_install = false`.
- Disable changelog edits by agents with `write_changelog = false`.
- Direct agents to the correct changelog with `changelog_path = "path/to/CHANGELOG.md"`.

The generated AGENTS section instructs agents to invoke `guiho-as-mirror` for versioning work, inspect `mirror.config.toml`, respect `write_changelog`, and use `changelog_path` for changelog edits. Use `mirror agents install local` only when a project-local skill copy is desired explicitly.

## Release Safety Rules

Mirror intentionally separates planning from mutation.

- Always run `mirror version plan <target>` before applying a release.
- Do not hand-edit configured version fields as a substitute for Mirror.
- Do not create release tags manually for Mirror-managed releases unless recovering intentionally.
- Do not apply after failed typecheck or tests.
- Do not push release refs unless requested or configured.
- Do not continue on a dirty Git worktree unless `allow_dirty = true` or `--allow-dirty` was provided intentionally.

`mirror version apply` refuses to mutate unless `--yes` is passed, unless `--dry-run` is used.

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

Every behavior change must be documented before publishing a new version. This includes changes to CLI commands, configuration fields, TypeScript APIs, release behavior, Git behavior, package contents, agent automation, tests that describe public behavior, and operational workflows.

Before a version is published, update this file and any other relevant user-facing documentation so the published package describes the behavior that is actually shipping. If a code change does not require documentation, the release preparation should still state why no documentation update was needed.

## TypeScript API

Mirror exports types and functions from `source/guiho-mirror.ts`.

Common release-plan API:

```ts
import { applyVersionPlan, buildVersionPlan, executeVersionPlan } from '@guiho/mirror'

const plan = await buildVersionPlan('patch', { cwd: process.cwd() })

console.log(plan.currentVersion)
console.log(plan.nextVersion)
console.log(plan.actions)

await executeVersionPlan(plan, { yes: true })

await applyVersionPlan('minor', { cwd: process.cwd(), yes: true })
```

Configuration and read API:

```ts
import { loadMirrorConfig, readCurrentVersion } from '@guiho/mirror'

const config = await loadMirrorConfig({ cwd: process.cwd() })
const version = await readCurrentVersion(config)
```

Agent automation API:

```ts
import {
  ensureMirrorAgentsInstructions,
  installMirrorSkill,
  runMirrorAgentAutomation,
} from '@guiho/mirror'

await ensureMirrorAgentsInstructions(process.cwd(), true)
await installMirrorSkill('local', { cwd: process.cwd() })
await runMirrorAgentAutomation({ cwd: process.cwd() })
```

The API uses the same configuration discovery and safety rules as the CLI.

## Internal Source Map

- `source/guiho-mirror.ts`: public library export surface.
- `source/guiho-mirror-bin.ts`: CLI binary entrypoint.
- `source/cli.ts`: citty command tree, CLI argument mapping, and process-facing error handling.
- `source/config.ts`: TOML discovery, schema validation, defaulting, init config generation, and override merge.
- `source/types.ts`: public and internal TypeScript types.
- `source/version.ts`: semver target validation and next-version resolution.
- `source/adapters.ts`: package, JSR, and Git read/write primitives.
- `source/plan.ts`: validation and read-only release plan construction.
- `source/executor.ts`: mutation layer for file writes, Git commits, tags, and pushes.
- `source/reporter.ts`: text and JSON report formatting.
- `source/agents.ts`: agent skill installation and AGENTS.md guidance automation.
- `source/errors.ts`: user-facing errors with stable exit codes.
- `source/guiho-mirror.spec.ts`: Bun test coverage for configuration, adapters, planning, execution, CLI behavior, Git behavior, and agent automation.
- `skills/guiho-as-mirror/SKILL.md`: bundled AI-agent skill installed by `mirror agents` commands.

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

- `library/`: TypeScript build output used by `main` and `types`.
- `bin/`: compiled standalone CLI binary output.
- `bundle/`: optional bundled output.

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
- Agent automation settings, AGENTS.md insertion, skill installation, and changelog path guidance.

Run all tests:

```bash
bun test
```

Run one file:

```bash
bun test source/guiho-mirror.spec.ts
```

## Build and Binary

Build the library:

```bash
bun run build
```

Compile the standalone binary:

```bash
bun run binary
```

The compiled binary embeds fallback `guiho-as-mirror` skill content so `mirror agents install local` and `mirror agents install global` still work when adjacent package files are not available.

## Publishing Checklist

Before publishing a new version:

1. Confirm intended changes are committed.
2. Confirm `DOCS.md` reflects all changed behavior.
3. Confirm other relevant docs are updated, including `README.md`, `AGENTS.md`, and the configured changelog path when applicable.
4. Run `bun run typecheck`.
5. Run `bun test`.
6. Run `bun run build`.
7. Run `bun run binary` when the CLI binary is part of the release validation.
8. Run `mirror version plan <target>`.
9. Commit release documentation updates before applying the version bump.
10. Run `mirror version apply <target> --yes` with the required commit or push flags.

Do not publish a new version when documentation is stale relative to the code being released.

## Troubleshooting

### Configuration not found

Run `mirror init package.json`, `mirror init jsr.json`, or `mirror init git` from the project root, or pass `--config <path>`.

### Adapter file not found

Check `[package].path` or `[jsr].path`, or pass `--package-file` or `--jsr-file`.

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
