# 🪞 GUIHO Mirror Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## [3.3.1] - 2026-07-02

### Added
- Added interactive numbered select options for the Git tag template prompt during CLI initialization.
- Added installer console logs and progress messages during the native binary download/installation.

### Changed
- Compiled and supported all 12 platform-native binary variants (including baseline/modern targets for x64/arm64 on Windows, Linux, and macOS).
- Changed default install behavior on x64 platforms to always use the `x64-baseline` binary to avoid instruction set compatibility crashes.

## [3.3.0] - 2026-06-28

### Added

- Added Bun-native multi-target binary compilation, direct native installers, and on-demand package-launcher binary installation for supported platforms.
- Added the renamed bundled `guiho-s-mirror` agent skill with package-version metadata and automated sync/migration from legacy `guiho-as-mirror` installs.

### Changed

- Converted Mirror to a CLI-only Bun-native package using Bun APIs for file IO, TOML parsing, process execution, and binary compilation.
- Updated generated AGENTS guidance, README, DOCS, schema descriptions, CLI reporting, exports, and tests for the `guiho-s-mirror` skill name and versioned sync behavior.
- Updated installation documentation with the npm package link.

### Fixed

- Normalized the npm `bin.mirror` target so npm keeps the CLI entry when publishing the package.

## [3.3.0-alpha.4] - 2026-06-27

### Fixed

- Normalized the npm `bin.mirror` target so npm keeps the CLI entry when publishing the package.

## [3.3.0-alpha.3] - 2026-06-27

### Added

- Added the renamed bundled `guiho-s-mirror` agent skill with package-version metadata in its frontmatter.

### Changed

- Changed Mirror agent skill installation to remove stale `guiho-as-mirror` and `guiho-s-mirror` skill directories before writing the bundled skill.
- Changed automatic agent setup to migrate legacy `guiho-as-mirror` installations and update installed skills when their version is older than the bundled skill version.
- Updated generated AGENTS guidance, README, DOCS, schema descriptions, CLI reporting, exports, and tests for the `guiho-s-mirror` skill name and versioned sync behavior.

## [3.3.0-alpha.2] - 2026-06-11

### Added

- Added Bun-native multi-target binary compilation for Linux, macOS, and Windows release assets.
- Added direct native binary installers for POSIX shells and PowerShell.
- Added package-manager install helper that places the matching native binary under `vendor/`.
- Added on-demand native binary installation from the Bun package launcher so `bun x @guiho/mirror` can recover when install hooks did not populate `vendor/mirror`.

### Changed

- Converted Mirror to a CLI-only package and removed the public TypeScript API contract from package metadata and documentation.
- Replaced Node.js runtime imports with Bun-native file, TOML, process, shell, and binary build APIs.
- Replaced `citty` with Mirror's internal CLI router and replaced `smol-toml` with Bun's native `Bun.TOML` parser, while keeping `semver` for semantic version calculations.
- Changed npm packaging to ship a small Bun launcher and postinstall downloader instead of bundling every platform binary into the package tarball.
- Changed the publish workflow to create or update the tag release and upload compiled native binaries as GitHub release assets before publishing to npm.

## [3.2.1] - 2026-06-09

### Added

- Added lifecycle hooks with before/after hook points around planning, applying, writing, committing, tagging, pushing, and the full execution flow.

### Changed

- Wrapped the generated Mirror `AGENTS.md` guidance in `BEGIN/END GUIHO MIRROR` markers that tell agents not to edit the Mirror-managed block.
- Made Mirror AGENTS guidance detection whitespace-insensitive so markdown formatting that only adds or removes blank lines does not duplicate the section.
- Updated hook tests to use the active Bun runtime instead of requiring a separate `node` binary on `PATH`.

## [3.2.0] - 2026-06-07

### Added

- Added auxiliary package outputs via `[package].auxiliary_paths` so extra `package.json` files mirror the main package version.
- Added an interactive `mirror init` wizard (TTY-only) with defaults you accept by pressing Enter, plus flags for every answer and `--non-interactive` for automation.
- Added new `mirror init` flags: `--output`, `--auxiliary`, `--tag-template`, `--name`, `--commit`, `--push`, `--non-interactive`.
- Added a JSON Schema for `mirror.config.toml`, shipped at `schema/mirror.config.schema.json` and printable via `mirror config schema --format json`.
- Generated config files now include a `#:schema` directive for editor autocomplete.

### Changed

- `mirror init` now reconciles an existing `mirror.config.toml` (adds missing defaults) instead of failing, and `--yes` overwrites with generated defaults.

## [3.1.1] - 2026-06-07

### Changed

- Changed Mirror skill installation paths to the standard `.agents/skills` and `~/.agents/skills` directories.
- Changed automatic skill installation to global-only by default while keeping explicit local installation available through `mirror agents install local`.
- Changed no-argument `mirror` startup to run configured agent setup before showing help.
- Updated documentation, schema text, and tests to describe the standard agent skill directories.

## [3.1.0] - 2026-06-07

### Added

- Added Mirror agent automation commands for installing the bundled `guiho-as-mirror` skill locally or globally.
- Added `mirror agents instructions` to create or update `AGENTS.md` with Mirror semantic versioning guidance.
- Added `[agents]` configuration for changelog behavior, changelog path selection, AGENTS.md insertion, and automatic skill installation.
- Added the bundled `guiho-as-mirror` skill to the published package.
- Added full package documentation in `mirror/DOCS.md` and repository guidance requiring documentation updates before publishing new versions.

### Changed

- Mirror project commands now auto-check Mirror agent guidance and install missing `guiho-as-mirror` skills when enabled.
- Configuration reports and schemas now include resolved agent automation settings.

## [3.0.0] - 2026-05-17

This release marks a major milestone as we prepare for the **initial open-source release** of GUIHO Mirror. We have completely overhauled the error handling experience, modernized the CI/CD publishing pipeline, and hardened the CLI commands for public usage.

### ✨ Features

- **TOML-Based Configuration**: Full support for `mirror.config.toml` for predictable, versionable configurations.
- **Semantic Versioning Engine**: Powerful integration with `semver` for accurate version calculations across major, minor, patch, and prerelease identifiers.
- **Multi-Adapter Support**: Seamlessly reads and writes version updates to `package.json`, `jsr.json`, and Git tags in a single synchronized operation.
- **Comprehensive CLI**: 
  - `mirror init` to scaffold new configurations.
  - `mirror config` to inspect and validate schemas.
  - `mirror version` to manage the lifecycle (current, next, plan, apply).
- **Dry-Run & Plan Mode**: Output a transparent execution plan of what will happen before any mutations occur.
- **Git Automation**: Automated creation of version bumps, commits, tags, and pushes directly from the CLI.
- **Verbose Error Logging**: Added a new `--verbose` flag across the CLI. By default, errors are now clean, succinct, and user-friendly, with full stack traces hidden behind the verbose flag for better developer experience.
- **Dynamic NPM Dist-Tags**: The publishing pipeline now dynamically parses prerelease identifiers (e.g., `alpha`, `beta`) and maps them to npm distribution tags automatically.

### 🐛 Bug Fixes & Improvements

- **Graceful Error Handling**: Completely reworked the error propagation from `citty`. Errors such as invalid targets (e.g. typos like `prerlease`) now fail gracefully with clear messages instead of dumping the raw Bun runtime stack trace.
- **Dirty Worktree Protection**: The apply command now strictly blocks operations on dirty git worktrees unless explicitly bypassed, preventing accidental commits.
- **Interactive Prompts**: Added safe interactive confirmations for applying versions, with a `--yes` flag to bypass for CI environments.
- **NPM Authentication Conflict**: Resolved an issue in the GitHub Actions workflow where `npm publish` would fail due to `always-auth` configurations.

### 🧹 Refactoring & Chores

- **CI/CD Modernization**: Migrated away from legacy shell scripts (`build-test-publish.sh`) and Google Cloud Build (`cloudbuild.yaml`) in favor of a robust GitHub Actions workflow (`publish.yml`).
- **NPM Registry Integration**: Added `actions/setup-node` to the workflow to securely handle NPM registry publishing alongside the primary Bun ecosystem.
- **Cleaned Up Documentation**: Consolidated the `README.md` to the repository root for better visibility on GitHub, ensuring it is automatically copied to the distribution bundle upon publishing.

---

## [3.0.0-alpha.2] - 2026-05-17

### Added
- Initial structure for the v3 open-source release.
- Baseline configuration schema and typescript types.
- Initial support for JSON and Text output formats (`--format=json|text`).
