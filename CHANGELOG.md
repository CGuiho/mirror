# 🪞 GUIHO Mirror Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.5.9] - 2026-07-21

### Fixed

- Made both PowerShell installers read and write instruction files as strict
  UTF-8 without a BOM, preserve Unicode content, repair legacy mojibaked Mirror
  markers, and reconcile exactly one managed block across repeated installs.
- Made installer home overrides honor `HOME` or `USERPROFILE`, keeping skill
  installation isolated in automated and temporary environments.

## [3.5.8] - 2026-07-21

### Fixed

- Moved public Linux installer verification from main-branch CI to the Publish
  workflow after release creation, eliminating the race where CI expected the
  new package version while GitHub still served the previous latest release.

## [3.5.7] - 2026-07-21

### Fixed

- Coalesced concurrent background release checks behind one atomic per-cache
  lease acquired before worker creation, preventing persistent process
  accumulation and sustained CPU use.
- Bounded the complete hidden-worker network check to 15 seconds, guaranteed
  token-owned lease cleanup, and added serialized 30-second stale recovery.
- Isolated all background scheduling failures from foreground commands and made
  concurrent directory creation safe with unique marker files.
- Added 32-way lock and real-process stress coverage proving one worker at peak
  and no worker remaining after bounded completion.

## [3.5.6] - 2026-07-20

### Changed

- Made the no-argument greeting identify the native platform as Windows, Linux,
  or macOS while preserving one deterministic version line.

### Fixed

- Replaced the checkout-only public POSIX wrapper with the proven standalone
  installer so `curl -fsSL .../devops/install.sh | bash` works without a
  repository clone.
- Realigned the public PowerShell installer with RunX and preserved the exact
  Mirror instruction marker when using `irm .../devops/install.ps1 | iex`.
- Added Linux CI coverage for the public curl-to-bash entrypoint and
  cross-platform greeting coverage.

## [3.5.5] - 2026-07-19

### Fixed

- Made `mirror upgrade list` include every published stable and prerelease
  version by default, preserving semantic ordering, channel labels, current and
  latest markers, pagination, compatible-asset metadata, and JSON parity.

## [3.5.4] - 2026-07-19

### Fixed

- Replaced the checkout-only public PowerShell installer wrapper with the
  standalone RunX-proven installer flow so
  `irm https://raw.githubusercontent.com/CGuiho/mirror/main/devops/install.ps1 | iex`
  works even when PowerShell script execution is restricted.
- Added the supported PowerShell install command to the repository README and
  isolated regression coverage for the exact `irm | iex` entrypoint.

## [3.5.3] - 2026-07-19

### Fixed

- Renamed the two GitHub agent assets to `guiho-s-mirror.md` and
  `guiho-i-mirror.md`, with one authoritative manifest enforcing exactly
  fourteen unique release filenames and no extras.
- Fixed the GitHub CLI asset verifier to pass one filter to `--jq`, and made
  reruns reconcile stale assets instead of preserving extras.
- Limited GitHub Release descriptions to the exact version's changelog section
  and idempotently reconciled notes for existing releases.
- Rejected empty, executable, binary, or identity-mismatched Markdown agent
  assets before installers write skill or instruction resources.

## [3.5.2] - 2026-07-19

### Fixed

- Aligned the RFC 0034 task, implementation, review, and validation records on
  completed source and release-workflow readiness.
- Recorded the protected production-environment gate and the current public
  latest/exact-version upgrade-resolution failures without claiming that
  `3.5.1` is already publicly installable.

## [3.5.1] - 2026-07-18

### Fixed

- Made release-version CLI assertions derive from package metadata so stable
  and prerelease bumps keep the RFC suite valid.
- Added subprocess coverage proving cached-notice ordering, parent upgrade
  flags, nested `upgrade --version`, dry-run JSON routing, and prompt-name-only
  output.

## [3.5.0] - 2026-07-18

### Added

- Added full RFC 0034 TypeBox validation, YAML configuration, startup/cache
  lifecycle, generated Developer Context help, singular agent namespace,
  Node-compatible npm bootstrap, and exact fourteen-asset release contract.
- Added `guiho-i-mirror`, dual-tool skill installation, idempotent exact-marker
  instruction actions, stable/prerelease upgrade pagination, and downstream
  YAML migration evidence.
- Added complete paginated `mirror upgrade list` output with semantic ordering, stable/prerelease channels, publication dates, current/latest markers, compatible assets, and structured JSON.
- Added exact-version install and process-stop recovery commands after every bare upgrade outcome, plus native Windows replacement, rollback, delayed-download output, and installer regression coverage.

### Changed

- Replaced TOML configuration, plural agent commands, implicit agent mutation,
  legacy aliases, old release filenames, and the Bun-dependent package launcher
  with the approved breaking RFC 0034 contracts.
- Changed `mirror upgrade` to print its complete plan before downloading, stream download/validation/replacement/verification phases, and commit update cache only after canonical verification.
- Hardened the canonical PowerShell and POSIX installers with exact-version resolution, native/version validation, transactional replacement, canonical verification, rollback, and plan-first output; devops installers now delegate to those scripts.

### Fixed

- Replaced unverified scheduled Windows replacement with immediate rename-and-swap; only deletion of a verified old backup may be deferred.
- Prevented false success when the canonical executable remains outdated and preserved the previous executable when replacement or verification fails.

## [3.5.0-alpha.0] - 2026-07-14

### Added

- Added Citty as Mirror's runtime CLI parser and declared the complete root and nested command hierarchy through one declarative command tree.
- Added a package-local README and durable implementation and validation records for the Citty migration.

### Changed

- Replaced handwritten flag parsing, positional collection, and top-level command dispatch with Citty-owned scoped arguments, aliases, routing, and ordinary usage rendering.
- Updated CLI tests, package documentation, AGENTS guidance, bundled skill guidance, and XDocs descriptors for the Citty architecture.
- Isolated Windows test fixtures under `C:\tmp` so unrelated ancestor agent instructions cannot affect repository tests.

### Fixed

- Preserved contextual usage errors, `-dy`, repeated `--output` and `--auxiliary` values, global version behavior, and hidden update-worker behavior through narrow compatibility adapters.
- Made self-upgrade return an explicit already-up-to-date result when the requested version matches the installed version.

## [3.4.2] - 2026-07-14

### Added

- Added Claude Code agent support with `--tool agents|claude|all`, `agents.skill_tool`, `CLAUDE.md` guidance sync, and `.claude/skills` installation paths.
- Added native CLI self-management with `mirror upgrade`, `mirror upgrade check`, `mirror upgrade list`, and `mirror uninstall`.
- Added `--help-tree` and `--help-docs` output for command trees and Markdown command documentation.

### Changed

- Changed install scripts and package launchers to prioritize the native `mirror` CLI, support all x64 variants with baseline-first fallback, and print first-run native binary install notices.
- Removed Node-based GitHub Actions and the production approval gate from native binary CI/publish workflows; workflows now use shell, Bun, git, and `gh` only.
- Updated the bundled `guiho-s-mirror` skill to prefer the installed native CLI.

### Fixed

- Fixed recognized command groups such as `mirror version` being reported as unknown, added `-h` contextual help at every command scope, and made incomplete commands print their relevant help after the usage error.
- Fixed Node-free CI/publish workflow checkout by applying the `mirror/` working directory only after the repository has been checked out.

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
