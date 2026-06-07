# 🪞 GUIHO Mirror Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
