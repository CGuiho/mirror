# Mirror v3 Open Source Readiness

## Purpose

Mirror v3 is a full rewrite of Mirror as an open source Bun and TypeScript CLI/library for project versioning.

The goal is open source readiness: predictable behavior, clear commands, safe defaults, documented configuration, testable internals, and publishing to npm and other public package registries.

Mirror versions a subject. A subject is the application, package, repository, or generic directory being released. In TypeScript/Bun projects, the subject is usually the package described by `package.json`. In generic projects, the subject may only exist as a Git repository and its tags.

## Rewrite Boundary

Mirror v3 is a clean break from the current implementation.

No v2 behavior is preserved for compatibility. Existing commands, positional arguments, output text, implicit Git operations, file mutation behavior, and release flow can all be deleted or replaced during implementation.

The current codebase is useful only as historical context. It is not a compatibility contract.

## V3 Scope

Version 3 supports two project categories:

- Bun/TypeScript package projects that keep their version in `package.json`.
- Generic Git projects that keep their version in Git tags.

Version 3 supports two version source types:

- `package.json`
- `git`

Version 3 supports two version target types:

- `package.json`
- `git`

Version 3 supports two Git tag formats:

- `vX.Y.Z`, for unnamed subjects.
- `name@X.Y.Z`, for named subjects.

## Non-Goals For V3

The first open source rewrite should not try to support every language ecosystem.

Out of scope for v3:

- Cargo/Rust version files.
- Python package metadata.
- Go modules.
- Java/Maven/Gradle files.
- changelog generation.
- release notes generation.
- registry publishing.
- GitHub/GitLab release creation.
- plugin systems.

Those can be added after the core versioning model is stable.

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

## Command Model

The executable is `mirror`.

Running `mirror` with no arguments shows top-level help and the installed Mirror CLI version.

Global flags:

```text
mirror --help
mirror -h
mirror --version
mirror -v
```

Global flag behavior:

- `--help` and `-h` print help for the current command scope.
- `--version` and `-v` print the installed Mirror CLI version.
- `--config <path>` loads a specific configuration file.
- `--cwd <path>` runs Mirror as if it started in that directory.
- `--package-json <path>` selects the package file used by `package.json` sources, targets, and name resolution.

`-v` is reserved for version output. Future verbose logging should use `--verbose`, not `-v`.

## Commands

### `mirror current`

Shows the current version for the configured or flagged project.

Examples:

```text
mirror current
mirror current --from package.json
mirror current --from package.json --package-json package.json
mirror current --from git
mirror current --from package.json --name-from package.json
```

Output should be stable and script-friendly by default:

```text
1.2.3
```

If a name is available and the user asks for detailed output, Mirror can also show:

```text
name: @scope/package
version: 1.2.3
tag: @scope/package@1.2.3
```

### `mirror version <target>`

Changes the project version.

`<target>` can be a release increment or an exact semantic version.

Increment targets:

```text
mirror version patch       # 1.0.0 -> 1.0.1
mirror version minor       # 1.0.0 -> 1.1.0
mirror version major       # 1.0.0 -> 2.0.0
mirror version prerelease  # 1.0.0 -> 1.0.1-0
mirror version prepatch    # 1.0.0 -> 1.0.1-0
mirror version preminor    # 1.0.0 -> 1.1.0-0
mirror version premajor    # 1.0.0 -> 2.0.0-0
```

Exact version target:

```text
mirror version 1.2.3
```

The canonical command is `mirror version <target>`. V3 does not support root-level version aliases such as `mirror patch` or positional package path forms such as `mirror ./package.json patch`.

## Flag Syntax

Mirror must support both value syntaxes:

```text
--flag-name flag-value
--flag-name=flag-value
```

Mirror must also support boolean flags:

```text
--dry-run
--push
--allow-dirty
```

Repeated list flags and comma-separated list flags should both work:

```text
mirror version patch --set git --set package.json
mirror version patch --set=git,package.json
```

Internally, both forms normalize to the same array.

## Version Source Flags

`--from` tells Mirror where to read the current version.

Allowed values:

```text
--from package.json
--from git
```

Only one source is allowed in v3.

If `--from package.json` is used, Mirror reads the version from a package file.

If `--from git` is used, Mirror reads the version from Git tags matching the selected tag format.

If no `--from` flag is passed, Mirror reads it from configuration. If neither flags nor configuration define it, the command fails with a clear error.

When `package.json` is used as a source, the package file path comes from `--package-json`, `package_json.path`, or the built-in default `package.json`.

## Version Target Flags

`--set` tells Mirror where to write the new version.

Allowed values:

```text
--set package.json
--set git
```

Examples:

```text
mirror version patch --from package.json --set package.json
mirror version patch --from package.json --set package.json --set git
mirror version patch --from git --set git
```

If no `--set` flag is passed, Mirror reads it from configuration. If neither flags nor configuration define it, the command fails with a clear error.

When `package.json` is used as a target, the package file path comes from `--package-json`, `package_json.path`, or the built-in default `package.json`.

## Subject Name Flags

The subject name is optional for unnamed versioning and required for named Git tags.

Name sources:

```text
--name my-project
--name-from package.json
```

Rules:

- `--name` provides the subject name directly.
- `--name-from package.json` reads the subject name from the package file `name` field.
- If both are provided, `--name` wins.
- When `--name-from package.json` is used, the package file path comes from `--package-json`, `package_json.path`, or the built-in default `package.json`.
- If `tag_format` is `named`, Mirror must resolve a name before creating or reading tags.
- If `tag_format` is `version`, Mirror does not require a name.

## Tag Format

Mirror supports two tag formats in v3.

Unnamed version tag:

```text
v1.2.3
```

Named version tag:

```text
my-project@1.2.3
@scope/package@1.2.3
```

CLI flag:

```text
--tag-format version
--tag-format named
```

Rules:

- `version` creates and reads tags like `v1.2.3`.
- `named` creates and reads tags like `name@1.2.3`.
- `package.json` always stores plain semantic versions like `1.2.3`.
- Git tag formatting must never leak into `package.json`.

## Release Safety

Open source defaults should be safe:

- Do not push commits by default.
- Do not push tags by default.
- Do not modify files when `--dry-run` is passed.
- Fail on a dirty Git worktree by default before changing versions.
- Allow dirty worktrees only with `--allow-dirty`.
- Print the planned actions before applying them.

Remote operations require explicit flags:

```text
--push
--push-tags
```

Automatic pushing is not a v3 default.

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

If both implicit config files exist, Mirror should fail and ask the user to choose one or pass `--config`. This avoids silently using stale configuration.

## Configuration Example

Package project that reads from and writes to `package.json`, then creates a named Git tag:

```toml
version = 1

from = "package.json"
set = ["package.json", "git"]

name_from = "package.json"
tag_format = "named"

[package_json]
path = "package.json"

[git]
commit = true
push = false
push_tags = false
allow_dirty = false
```

Generic Git-only project with unnamed tags:

```toml
version = 1

from = "git"
set = ["git"]

tag_format = "version"

[git]
commit = false
push = false
push_tags = false
allow_dirty = false
```

## Configuration Merge Rules

Mirror resolves command settings in this order:

1. CLI flags.
2. Configuration file values.
3. Built-in defaults.

CLI flags always win over configuration.

Built-in defaults should be minimal. Required values like `from` and `set` should not be guessed in v3.

The package file path is an exception: when `package.json` is explicitly selected as a source, target, or name source, the default path is `package.json`.

## Version Operation Flow

`mirror version <target>` should execute in this order:

1. Resolve `cwd`.
2. Load configuration.
3. Parse and normalize flags.
4. Merge flags with configuration.
5. Validate `from`, `set`, `name`, and `tag_format`.
6. Read the current version from the selected source.
7. Validate that the current version is semantic.
8. Resolve the desired version from `<target>`.
9. Build an action plan.
10. Print the action plan.
11. Stop if `--dry-run` is set.
12. Check Git worktree safety.
13. Apply file updates.
14. Create a Git commit if configured.
15. Create Git tags if configured.
16. Push only if `--push` or `--push-tags` is explicitly set.
17. Print the final version and affected targets.

## Internal Architecture

The rewrite should split the current single-file implementation into focused modules.

Proposed modules:

- `cli`: command definitions, help, and process exit behavior.
- `config`: config discovery, TOML parsing, schema validation, and merge rules.
- `flags`: raw argument normalization.
- `version`: semantic version validation and increment resolution.
- `sources`: version readers such as package JSON and Git tags.
- `targets`: version writers such as package JSON and Git tags.
- `git`: Git status, commit, tag, and push operations.
- `plan`: dry-run action plan generation.
- `errors`: typed user-facing errors with stable exit codes.

The CLI should call library functions rather than holding business logic directly in command handlers.

## Testing Requirements

Version 3 needs tests before public release.

Required coverage:

- Flag parsing for `--flag value`, `--flag=value`, booleans, repeated flags, and comma-separated list flags.
- Config lookup for root config, nested config, explicit config, and duplicate config failure.
- Config merge precedence.
- `package.json` version reading.
- `package.json` version writing in temporary fixtures.
- Git tag version reading in temporary repositories.
- Git tag creation in temporary repositories.
- Named and unnamed tag formats.
- `mirror current`.
- `mirror version <increment>`.
- `mirror version <exact-version>`.
- Dirty worktree handling.
- Dry-run behavior.

Tests should use disposable temporary directories and repositories. Release-path tests must not run against the Mirror repository itself.

## Open Decisions

These decisions should be resolved before implementation starts:

1. Whether `git commit` should be enabled by default when `set = ["git"]`, or only when `git.commit = true`.
2. Whether detailed output should use a flag like `--format json` instead of human-readable multiline text.

## References

- Bun argument parsing: https://bun.sh/docs/guides/process/argv
- Bun TOML support: https://bun.com/docs/runtime/toml
- citty CLI builder: https://www.unjs.dev/packages/citty/
- Clipanion: https://mael.dev/clipanion/
- Commander.js: https://tj.github.io/commander.js/
- yargs: https://yargs.js.org/
- oclif: https://oclif.io/docs/introduction/
