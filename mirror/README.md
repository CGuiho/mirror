# Mirror

Mirror is an open source Bun and TypeScript CLI/library for semantic project versioning.

It reads one version source, calculates the next semantic version, builds a release plan, then applies that plan to configured outputs such as `package.json`, `jsr.json`, and Git tags.

```text
source -> version engine -> plan -> outputs
```

## Install

```sh
bun add -d @guiho/mirror
```

The package exposes the `mirror` executable and a TypeScript library entrypoint at `@guiho/mirror`.

## Commands

```sh
mirror
mirror init package
mirror init jsr
mirror init git
mirror config show
mirror config check
mirror version current
mirror version next patch
mirror version plan patch
mirror version apply patch --yes
```

`mirror version current`, `mirror version next`, and `mirror version plan` are read-only. `mirror version apply` is the only command that mutates files or Git state.

## Configuration

Mirror looks for configuration in this order:

1. `--config <path>`
2. `./mirror.config.toml`
3. `./config/mirror.config.toml`

Package project example:

```toml
schema = 1

[project]
name_source = "package"

[version]
scheme = "semver"
source = "package"
output = ["package", "jsr", "git"]
prerelease_id = ""

[package]
path = "package.json"

[jsr]
path = "jsr.json"

[git]
tag_template = "{name}@{version}"
commit = false
push = false
allow_dirty = false
```

Supported adapters are `package`, `jsr`, and `git`.

Supported Git tag templates are:

- `v{version}`
- `{name}@{version}`

## Version Targets

Mirror supports exact semantic versions and these release targets:

- `major`
- `premajor`
- `minor`
- `preminor`
- `patch`
- `prepatch`
- `prerelease`

Prerelease targets use numeric prereleases by default, such as `1.0.1-0`. Pass `--preid alpha` or set `version.prerelease_id = "alpha"` to produce versions such as `1.0.1-alpha.0`.

## Safety

`mirror version apply <target>` prints the plan before applying it. It requires `--yes` in non-interactive usage, fails on dirty Git worktrees by default, and never pushes release refs unless `--push` is passed or configured.

When file outputs and Git tag output are combined, Mirror requires `--commit` or `--push` so the tag points at the release commit. For Git-only projects, `--commit` does not create an empty commit; Mirror tags the current `HEAD`.

## Library

```ts
import { buildVersionPlan, applyVersionPlan } from '@guiho/mirror'

const plan = await buildVersionPlan('patch', { cwd: process.cwd() })
await applyVersionPlan('patch', { cwd: process.cwd(), yes: true })
```

## Development

Run package commands from this directory.

```sh
bun install
bun run typecheck
bun test
bun run build
bun run binary
```
