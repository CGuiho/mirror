# Mirror v3 Open Source Readiness

## Purpose

Mirror v3 is a complete rewrite of Mirror as an open source Bun and TypeScript CLI/library for project versioning.

The goal is open source readiness: predictable behavior, clear commands, safe defaults, documented configuration, testable internals, and publishing to npm and other public package registries.

Mirror versions a project. A project is the package, application, repository, or generic directory being released.

## Rewrite Boundary

Mirror v3 is a clean break from the current implementation.

No existing command, positional argument, output format, Git behavior, file mutation behavior, or release flow is preserved for compatibility. The current codebase is historical context only. It is not a compatibility contract.

## Product Model

Mirror should expose a small vocabulary:

- **Project**: the thing being versioned.
- **Source**: the single place Mirror reads the current version from.
- **Output**: a place Mirror writes the new version to.
- **Adapter**: the implementation that reads or writes a specific system, such as `package` or `git`.
- **Plan**: the exact set of actions Mirror will perform before it mutates anything.

The model is:

```text
source -> version engine -> plan -> outputs
```

Mirror reads the current version from one source, calculates the next version, builds a plan, then applies that plan to one or more outputs.

## V3 Scope

Version 3 supports three project categories:

- Bun/TypeScript package projects that keep their version in `package.json`.
- JSR TypeScript package projects that keep their version in `jsr.json`.
- Generic Git projects that keep their version in Git tags.

Version 3 supports three adapters:

- `package`: reads and writes `package.json`.
- `jsr`: reads and writes `jsr.json`.
- `git`: reads Git tags, creates Git tags, creates release commits, and pushes release refs when requested.

Version 3 supports semantic versioning only.

Out of scope for v3:

- Cargo/Rust version files.
- Python package metadata.
- Go modules.
- Java/Maven/Gradle files.
- changelog generation.
- release notes generation.
- GitHub/GitLab release creation.
- plugin systems.

Registry publishing is in scope for Mirror's own release pipeline, but generic registry publishing commands are out of scope for the first v3 implementation.

## Distribution Targets

Mirror v3 will be published as an open source package to npm and JSR.

Package identity:

```text
@guiho/mirror
```

Registries:

- npm package under the `@guiho` scope: https://www.npmjs.com/~guiho
- JSR package under the `@guiho` scope: https://jsr.io/@guiho

The npm package is the primary CLI distribution because npm-compatible package managers support executable package bins.

The JSR package is the primary TypeScript source distribution for users who want to import Mirror as a library from JSR-compatible tooling.

Mirror's release metadata must keep these files in sync:

- `package.json`
- `jsr.json`
- Git tags

The release version must be identical across npm, JSR, and Git.

## Publishing Metadata

The npm package must use the scoped public package name:

```json
{
  "name": "@guiho/mirror",
  "publishConfig": {
    "access": "public"
  }
}
```

Scoped npm packages need explicit public access when published publicly. The release path should use either `publishConfig.access = "public"` or `npm publish --access public`.

The JSR package must include `jsr.json`:

```json
{
  "name": "@guiho/mirror",
  "version": "0.0.0",
  "exports": "./source/guiho-mirror.ts"
}
```

`jsr.json.version` must be updated during release just like `package.json.version`.

JSR supports publishing TypeScript source directly. The v3 implementation should keep the public library entrypoint in TypeScript and avoid requiring generated `.js` and `.d.ts` files for JSR publishing.

Library entrypoints must use the full library name instead of generic `index.ts` files. For Mirror v3, the public source entrypoint is `source/guiho-mirror.ts`.

Recommended publish commands:

```text
npm publish --access public
npx jsr publish
```

Recommended CI direction:

- use GitHub Actions for npm publishing with provenance when configured.
- use GitHub Actions OIDC for JSR publishing after linking the JSR package to the GitHub repository.
- do not use local machines as the normal release path once CI publishing is configured.

## CLI Framework Decision

Mirror v3 should use `citty` unless implementation testing shows a blocking limitation.

Reasons:

- It supports nested subcommands.
- It has generated usage/help.
- It supports boolean and value arguments.
- It has async command handlers.
- It is small enough for a Bun-first CLI.
- Its command definition model is simpler than full frameworks like oclif.

Alternatives considered:

- Bun `util.parseArgs`: good for zero dependencies, but Mirror needs commands, subcommands, generated help, and future growth.
- Clipanion: strong TypeScript command model and battle-tested through Yarn, but more structured than Mirror needs for the first rewrite.
- Commander.js and yargs: mature, but Node-oriented and less aligned with a Bun-first design.
- oclif: too heavy for v3 and explicitly Node-oriented.

## Command Design

The executable is `mirror`.

Running `mirror` with no arguments prints top-level help and the installed Mirror CLI version.

Commands:

```text
mirror
mirror init package
mirror init jsr
mirror init git
mirror config show
mirror config check
mirror version current
mirror version next <target>
mirror version plan <target>
mirror version apply <target>
```

There are no root-level release aliases. Commands like `mirror patch`, `mirror minor`, and `mirror 1.2.3` are not part of v3.

### `mirror init package`

Creates `mirror.config.toml` for a Bun/TypeScript package project.

The generated config uses:

- `package` as the version source.
- `package` as a version output.
- `git` as an optional output only if the user confirms during init or edits the config later.
- the package name from `package.json`.

### `mirror init jsr`

Creates `mirror.config.toml` for a JSR TypeScript package project.

The generated config uses:

- `jsr` as the version source.
- `jsr` as a version output.
- `git` as an optional output only if the user confirms during init or edits the config later.
- the package name from `jsr.json`.

### `mirror init git`

Creates `mirror.config.toml` for a generic Git-tagged project.

The generated config uses:

- `git` as the version source.
- `git` as the only output.
- an unnamed tag template by default.

### `mirror config show`

Prints the resolved configuration after defaults and CLI overrides.

This command is read-only.

### `mirror config check`

Validates that Mirror can operate in the current project.

Checks include:

- config file exists and parses.
- config schema version is supported.
- source adapter is valid.
- output adapters are valid.
- package file exists when the package adapter is used.
- JSR config file exists when the JSR adapter is used.
- Git repository exists when the Git adapter is used.
- tag template is valid.
- project name can be resolved when the tag template needs it.

This command is read-only.

### `mirror version current`

Reads the current version from the configured source.

Default output is script-friendly:

```text
1.2.3
```

Structured output can be requested with `--format json`.

### `mirror version next <target>`

Calculates the next version without checking output state and without writing anything.

Examples:

```text
mirror version next patch
mirror version next minor
mirror version next major
mirror version next prepatch
mirror version next preminor
mirror version next premajor
mirror version next prerelease
mirror version next prepatch --preid alpha
mirror version next 1.2.3
```

Supported targets:

- `patch`
- `minor`
- `major`
- `prepatch`
- `preminor`
- `premajor`
- `prerelease`
- exact semantic versions such as `1.2.3`

### `mirror version plan <target>`

Builds the full release plan without writing anything.

The plan includes:

- current version.
- next version.
- source used.
- package files to update.
- Git tags to create.
- release commit that would be created when commit behavior is enabled.
- refs that would be pushed when push behavior is enabled.

This command is read-only and should be the safest way to inspect a release.

### `mirror version apply <target>`

Applies the release plan.

This is the only command that mutates files, Git tags, commits, or remote refs.

Examples:

```text
mirror version apply patch
mirror version apply patch --dry-run
mirror version apply patch --commit
mirror version apply patch --push
mirror version apply 1.2.3 --commit
```

## Operational Flags

Mirror should keep normal release commands clean. Project policy belongs in `mirror.config.toml`; operational behavior belongs in flags.

Global operational flags:

```text
--help
-h
--version
-v
--config <path>
--cwd <path>
--format text|json
--no-color
```

Apply-only operational flags:

```text
--dry-run
--commit
--push
--allow-dirty
--yes
```

Configuration override flags:

```text
--source package|jsr|git
--output package|jsr|git
--package-file <path>
--jsr-file <path>
--preid <id>
```

`--source` overrides `version.source`.

`--output` overrides `version.output`. It can be passed more than once:

```text
mirror version plan patch --source package --output package --output git
mirror version apply patch --source package --output package --output git --commit
```

`--package-file` overrides `package.path`.

`--jsr-file` overrides `jsr.path`.

`--preid` overrides `version.prerelease_id`.

Flag syntax must support both value forms:

```text
--config mirror.config.toml
--config=mirror.config.toml
--source package
--source=package
--preid alpha
--preid=alpha
```

Boolean flags do not require values:

```text
--dry-run
--commit
--push
--allow-dirty
```

## Commit And Push Semantics

Mirror does not create release commits by default.

`--commit` means:

- apply the version plan.
- stage files that Mirror changed.
- create a local release commit when file outputs changed.
- create configured Git tags after the release commit exists.
- do not push.

`--push` means:

- enable commit behavior when file outputs changed.
- apply the version plan.
- create the local release commit when needed.
- create configured Git tags.
- push the release commit and release tags created by Mirror.

`--push` is therefore stronger than `--commit`. A user does not need to pass both.

There is no raw push-only release mode. Pushing a release without creating the release commit would either push nothing useful or create a tag pointing at the wrong tree. Mirror should prevent that.

If the configured outputs include both a file output and a Git tag output, Mirror must not create the Git tag until the file change is committed. In that case, `mirror version apply <target>` without `--commit` or `--push` fails before making changes.

If the configured outputs are Git-only, `--commit` does not create an empty commit. Mirror creates the configured tag on the current `HEAD`. With `--push`, Mirror pushes the created tag.

## Safety Semantics

Open source defaults should be safe:

- `mirror version current`, `next`, and `plan` are always read-only.
- `mirror version apply` is the only mutating command.
- `--dry-run` makes `apply` read-only and prints the same plan that would be applied.
- dirty Git worktrees fail by default.
- `--allow-dirty` allows Mirror to continue in a dirty worktree.
- remote pushes never happen unless `--push` is passed or configured.
- Mirror prints the plan before applying it.
- destructive or ambiguous plans fail before mutation.

`--yes` skips interactive confirmation. It does not weaken validation.

## Configuration Format

Mirror v3 should use TOML:

```text
mirror.config.toml
config/mirror.config.toml
```

Reasons:

- TOML supports comments.
- TOML is readable for non-TypeScript projects.
- TOML avoids executing user code.
- TOML is less ambiguous than YAML.
- Bun has first-class TOML parsing support.

Lookup order:

1. Explicit `--config <path>`.
2. `./mirror.config.toml`.
3. `./config/mirror.config.toml`.

The top-level configuration file takes precedence over the nested configuration file. If both `./mirror.config.toml` and `./config/mirror.config.toml` exist, Mirror uses `./mirror.config.toml`.

The nested configuration file is a fallback for projects that prefer to keep tool configuration under `config/`.

## Configuration Schema

Package project:

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

JSR package project:

```toml
schema = 1

[project]
name_source = "jsr"

[version]
scheme = "semver"
source = "jsr"
output = ["jsr", "git"]
prerelease_id = ""

[jsr]
path = "jsr.json"

[git]
tag_template = "{name}@{version}"
commit = false
push = false
allow_dirty = false
```

Generic Git project:

```toml
schema = 1

[project]
name = "my-project"

[version]
scheme = "semver"
source = "git"
output = ["git"]
prerelease_id = ""

[git]
tag_template = "v{version}"
commit = false
push = false
allow_dirty = false
```

Config rules:

- `schema` is required.
- `version.source` must name exactly one adapter.
- `version.output` must contain at least one adapter.
- `version.prerelease_id` is optional.
- `--preid` overrides `version.prerelease_id`.
- if no prerelease identifier is configured or passed, prerelease targets use numeric prerelease versions such as `1.0.1-0`.
- if a prerelease identifier is configured or passed, prerelease targets use named prerelease versions such as `1.0.1-alpha.0`.
- `project.name` provides a literal project name.
- `project.name_source = "package"` reads the project name from `package.json`.
- `project.name_source = "jsr"` reads the project name from `jsr.json`.
- `git.tag_template` supports `{name}` and `{version}`.
- a template containing `{name}` requires a resolved project name.
- `git.push = true` implies `git.commit = true` when file outputs changed.
- CLI flags override config values.

## Tag Templates

Mirror should use tag templates instead of a small enum like `named` or `version`.

Supported v3 templates:

```text
v{version}
{name}@{version}
```

Examples:

```text
v1.2.3
my-project@1.2.3
@scope/package@1.2.3
```

`package.json` always stores plain semantic versions like `1.2.3`. Git tag formatting must never leak into package metadata.

## Version Operation Flow

`mirror version apply <target>` should execute in this order:

1. Resolve `cwd`.
2. Discover and load configuration.
3. Parse operational flags.
4. Merge flags with configuration.
5. Validate source, outputs, project name, and tag template.
6. Read the current version from the source.
7. Validate that the current version is semantic.
8. Resolve the next version from `<target>`.
9. Build a complete plan.
10. Validate safety preconditions.
11. Print the plan.
12. Stop if `--dry-run` is set.
13. Ask for confirmation unless `--yes` is set.
14. Apply file outputs.
15. Create a release commit when commit behavior is enabled and file outputs changed.
16. Create Git tags.
17. Push release refs only when push behavior is enabled.
18. Print the final version and affected outputs.

## Internal Architecture

The rewrite should split the implementation into focused modules:

- `cli`: command definitions, help, and process exit behavior.
- `config`: discovery, TOML parsing, schema validation, and merge rules.
- `version`: semantic version validation and increment resolution.
- `adapters/package`: package name/version reads and package version writes.
- `adapters/jsr`: JSR package name/version reads and JSR version writes.
- `adapters/git`: tag discovery, tag creation, commit creation, and push behavior.
- `plan`: action plan generation.
- `executor`: the only layer allowed to mutate files or Git state.
- `reporter`: text and JSON output.
- `errors`: typed user-facing errors with stable exit codes.

The CLI should call library functions rather than holding business logic directly in command handlers.

Architectural rule:

```text
Only the executor mutates the world.
```

Everything before execution should be pure planning, validation, or reporting when practical.

## Testing Requirements

Version 3 needs tests before public release.

Required coverage:

- config lookup for explicit config, root config, nested config, and root-over-nested precedence.
- config schema validation.
- config merge precedence.
- operational and override flags for `--dry-run`, `--commit`, `--push`, `--allow-dirty`, `--yes`, `--source`, `--output`, `--package-file`, `--jsr-file`, and `--preid`.
- package version reading.
- package version writing in temporary fixtures.
- package name reading.
- JSR version reading.
- JSR version writing in temporary fixtures.
- JSR package name reading.
- Git tag version reading in temporary repositories.
- Git tag creation in temporary repositories.
- tag templates for `v{version}` and `{name}@{version}`.
- `mirror config show`.
- `mirror config check`.
- `mirror version current`.
- `mirror version next <target>`.
- `mirror version plan <target>`.
- `mirror version apply <target>`.
- dirty worktree handling.
- dry-run behavior.
- commit behavior.
- push-implies-commit behavior.
- Git-only release behavior without empty commits.

Tests should use disposable temporary directories and repositories. Release-path tests must not run against the Mirror repository itself.

## Open Decisions

These decisions should be resolved before implementation starts:

1. Whether `mirror version apply` should require interactive confirmation by default or only for plans that touch Git.
2. Whether `git.commit = true` should be allowed in config, or whether committing should only be controlled by `--commit` and `--push`.
3. Whether JSON output should be supported in v3 for all commands or only read-only commands.

## References

- Bun argument parsing: https://bun.sh/docs/guides/process/argv
- Bun TOML support: https://bun.com/docs/runtime/toml
- citty CLI builder: https://www.unjs.dev/packages/citty/
- Clipanion: https://mael.dev/clipanion/
- Commander.js: https://tj.github.io/commander.js/
- yargs: https://yargs.js.org/
- oclif: https://oclif.io/docs/introduction/
- npm scoped public packages: https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/
- npm package scope, access, and visibility: https://docs.npmjs.com/package-scope-access-level-and-visibility/
- npm provenance: https://docs.npmjs.com/generating-provenance-statements
- JSR publishing packages: https://jsr.io/docs/publishing-packages
- JSR package configuration: https://jsr.io/docs/package-configuration
