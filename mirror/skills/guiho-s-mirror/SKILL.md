---
name: guiho-s-mirror
version: 3.5.0-alpha.0
description: Use this skill whenever the user asks to version, bump, release, tag, initialize, configure, or troubleshoot a project with GUIHO Mirror (`@guiho/mirror`). This includes Bun, npm, JSR, package.json, jsr.json, Git tag, semantic versioning, changelog, release-plan, prerelease, and "what version comes next" workflows, even when the user only says "cut a patch" or "prepare a release" without naming Mirror.
purpose: Guide safe semantic-version planning and release workflows through the Mirror CLI.
created: 2026-06-27
owner: mirror-mirror-skills-guiho-s-mirror
flags:
  - semantic-project-versioning
tags:
  - versioning
  - release
  - cli
keywords:
  - mirror
  - semantic versioning
  - citty
  - release plan
---

# GUIHO Mirror

GUIHO Mirror is a deterministic CLI for semantic project versioning. It reads one version source, calculates the next semantic version, builds a transparent read-only plan, and applies the plan to configured outputs such as `package.json`, `jsr.json`, and Git tags.

```text
source -> version engine -> plan -> outputs
```

Use Mirror for project versioning work instead of ad hoc edits to version fields, manual tag creation, or package-manager-specific version commands. The value of Mirror is that the agent and user can see the intended release plan before anything mutates.

## Command Selection

Choose the installed native CLI first:

1. Use `mirror` when the CLI is installed on the system.
2. Use `bun run source/guiho-mirror-bin.ts` only inside a Mirror source checkout while developing Mirror itself.
3. Use `bunx @guiho/mirror` only as a last-resort bootstrap path when no native CLI is installed yet.

When unsure, run a cheap availability check (`mirror --help`) and then reuse the working command consistently. Run `mirror --help`, `mirror <command> --help`, `mirror --help-tree`, or `mirror <command> --help-docs` for command-specific details when needed.

Mirror ships as a Bun-compiled native self-sufficient CLI binary. The installed `mirror` command should not require Node.js or Bun at runtime. It can check for updates, upgrade itself with `mirror upgrade`, and remove its native binary with `mirror uninstall`. Bun is required for Mirror project development and binary compilation. Git is required only for Git-based workflows: `source = "git"`, `output = ["git"]`, commits, tags, or pushes.

Mirror uses Citty for its declarative command tree, scoped flags, aliases, and ordinary usage. `-h` and `--help` show contextual command help, while `-v` and `--version` print the CLI version without loading project configuration. Unknown commands, unknown scoped flags, and missing targets exit nonzero and must never be treated as release targets. `--output` and `--auxiliary` accept repeated or comma-separated values; `-dy` remains the compatibility alias for `--dry-run`.

## Native Upgrade and Recovery

`mirror upgrade` resolves and prints the current version, target version, operating system, architecture, selected asset, canonical path, and exact download URL before the long download begins. It then streams `Downloading...`, `Validating...`, `Replacing...`, and `Verifying...`. Success means a fresh process launched from the canonical executable path already reports the exact target; Mirror rolls back on replacement or verification failure. Only deletion of a verified old backup may be deferred.

After every bare upgrade outcome, preserve and report the exact-version installer command and separate process-stop command emitted by Mirror. Do not replace the pinned version with `latest`. Use `mirror upgrade list` to inspect every published stable and prerelease version newest first, including its channel, date, current/latest markers, and compatible asset. Use `--format json` when an agent needs the complete typed plan/events/result/recovery or catalog envelope.

## Release Workflow

When the user asks to bump, release, tag, or version a project, follow this sequence exactly. The ordering matters because the release tag should land on a commit that includes the release preparation, and the version apply step should only happen after validation and planning.

1. Confirm the target and project root.
   - Use the user's requested target: `major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, `prerelease`, or an exact semver like `2.0.0`.
   - If the target is ambiguous, ask before mutating anything.
   - Work from the project root containing `mirror.config.toml`, `package.json`, `jsr.json`, or `.git` as appropriate.

2. Inspect Mirror configuration.
   - Run `<mirror> config show`.
   - Read the resolved `[git] allow_dirty` value.
   - Read the resolved `[agents] write_changelog` value.
   - Read the resolved `[agents] changelog_path` value.
   - If config loading fails, stop and report the configuration problem instead of improvising a release.

3. Verify Git cleanliness when required.
   - If `allow_dirty = false` or the setting is absent, check the worktree with `git status --short`.
   - If the worktree is dirty, stop before typecheck, tests, plan, docs, changelog, commit, or apply. Tell the user the worktree is not clean and that they need to commit or stash changes first.
   - If `allow_dirty = true`, note that the configuration allows a dirty worktree and continue carefully.

4. Run the project type checker.
   - Prefer the project's existing script or documented command.
   - Common Bun projects use `bun run typecheck`.
   - Fix type errors before continuing. Do not apply a version bump while the typecheck is failing.

5. Run the project test suite.
   - Prefer the project's existing script or documented command.
   - Common Bun projects use `bun test`.
   - Fix test failures before continuing. Do not apply a version bump while tests are failing.

6. Build the release plan before editing release docs.
   - Run `<mirror> version plan <target>`.
   - Capture the `nextVersion` from the plan output.
   - Treat the plan as the source of truth for release documentation, changelog headings, and the final apply step.

7. Update release documentation if the project has it.
   - Update documentation files that are part of the project's release process.
   - Reference the planned `nextVersion` where appropriate.
   - Keep unrelated documentation untouched.

8. Update the changelog if present and enabled.
   - If `[agents].write_changelog = false`, skip changelog edits even when `CHANGELOG.md` exists.
   - If changelog writing is enabled or absent, use `[agents].changelog_path` as the changelog file path; if it is missing, use `CHANGELOG.md` in the project root.
   - Add an entry headed by the planned `nextVersion`.
   - Summarize the actual release changes; do not invent changes that are not in the repository history or current diff.

9. Commit release-preparation changes before applying the bump.
   - Commit docs, changelog, and other pending release-preparation changes before running `version apply`.
   - Use a message like `docs: prepare release <nextVersion>` unless the repo has a stricter convention.
   - This pre-apply commit keeps release notes and documentation before the eventual version tag.

10. Apply the version bump.
    - Run `<mirror> version apply <target> --yes`.
    - If configured outputs include both file outputs (`package.json` or `jsr.json`) and Git output, include `--commit` unless the configuration already enables release commits or the user intentionally uses `--push`. Mirror requires the tag to attach to a commit containing updated version files.
    - Do not use `--push` unless the user explicitly requested pushing or the project configuration intentionally enables it.

## Safety Rules

- Never skip `version plan`; planning is the point where the user and agent can see what will happen before mutations.
- Never hand-edit `package.json` or `jsr.json` version fields as a substitute for Mirror when Mirror is configured for the project.
- Never create Git tags manually for a Mirror-managed release unless the user is intentionally recovering from a failed release and understands the state.
- Do not proceed past a dirty worktree when `allow_dirty` is false.
- Do not apply a version bump after failed typecheck or tests.
- Do not push release refs unless explicitly requested or configured.
- When an exact version is requested, still run `version plan <exact-version>` first.
- When the plan output is surprising, stop and explain the mismatch instead of forcing the release.

## Initialization Workflow

When the user asks to set up Mirror in a project:

1. Identify the version source the project should use.
   - Use `package.json` for npm/Bun package versioning.
   - Use `jsr.json` for JSR package versioning.
   - Use `git` when tags are the source of truth.
2. Run `<mirror> init` (interactive wizard) or pass flags to answer non-interactively.
   - `<mirror> init package.json`, `<mirror> init jsr.json`, or `<mirror> init git` set the source directly.
   - Flags: `--source`, `--output`, `--package-file`, `--jsr-file`, `--auxiliary`, `--tag-template`, `--name`, `--preid`, `--commit`, `--push`, `--non-interactive`, `--yes`.
   - Defaults are source `package.json` and outputs `package.json` + `git`. For agents and CI, always pass flags or `--non-interactive` so init never waits for prompts.
3. If `mirror.config.toml` already exists, `init` reconciles missing defaults without overwriting user-configured values.
4. Review `mirror.config.toml` with the user if outputs, auxiliary package paths, tag templates, commits, or pushes need customization.
5. Validate with `<mirror> config check` and inspect with `<mirror> config show`.
6. Run `<mirror> version current` and a harmless `<mirror> version plan patch` to confirm the lifecycle works.

## Configuration Reference

Mirror searches for configuration via `--config <path>`, `./mirror.config.toml`, or `./config/mirror.config.toml`.

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

Supported version sources and outputs are `package.json`, `jsr.json`, and `git`. Supported Git tag templates are `v{version}`, `{name}@{version}`, and `{name}/v{version}`.

Use `[package].auxiliary_paths` for extra package.json files that should mirror the main package version when `package.json` is in `[version].output`.

Agent automation options default to true. Set `write_changelog = false` to tell agents to skip changelog edits, `changelog_path = "docs/CHANGELOG.md"` to specify the changelog file, `auto_agents_md = false` to stop Mirror from inserting its instruction section, `auto_skill_install = false` to stop Mirror from installing `guiho-s-mirror` globally when missing, and `skill_tool = "claude"` or `skill_tool = "all"` to target Claude Code skill directories. Use `--tool claude` or `--tool all` as a one-off override.

## CLI Reference

Common commands:

```bash
mirror init
mirror init package.json
mirror init jsr.json
mirror init git
mirror config show
mirror config check
mirror config schema
mirror config schema --format json
mirror agents install local
mirror agents install global
mirror agents install global --tool all
mirror agents instructions
mirror version current
mirror version next <target>
mirror version plan <target>
mirror version apply <target> --yes
```

Supported targets are `major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, `prerelease`, or an exact semantic version such as `2.0.0`.

## Mirror Project Development

When working inside the Mirror project repository itself, run development commands from the `mirror/` directory:

```bash
cd mirror
bun install
bun run typecheck
bun test
bun run build
bun run binary
```

Use these for development validation. For release validation, still follow the release workflow above.

## Response Style

When reporting a Mirror release result, include:

- The target requested.
- The current version and planned next version.
- Whether typecheck and tests passed.
- Which docs or changelog files changed, if any.
- The final apply command that ran.
- Whether commits, tags, or pushes were created.

Keep the explanation short and operational. The user usually needs to know what version was planned, what was mutated, and whether anything remains for them to do.
