## Agent

Always read this: /c/GUIHO/superiority/agents/guiho-a-0001-swe.AGENTS.md (C:\GUIHO\superiority\agents\guiho-a-0001-swe.AGENTS.md)
Stop if you can not find it.


﻿# Repository Notes

- The real package lives in `mirror/`; run package commands there unless editing root docs or `ci/`.
- `@guiho/mirror` is a Bun-native CLI-only package. The CLI entrypoint is `mirror/source/guiho-mirror-bin.ts`; Bun compiles `mirror/bin/` for local validation and platform release assets.
- Do not add Node.js runtime imports or public TypeScript API exports. Use Bun APIs for file IO, TOML parsing, process execution, and binary compilation. Keep `semver` for semantic version calculations and `citty` as the sole general CLI parser, router, alias registry, and ordinary usage generator.
- Use Bun, not npm/pnpm/yarn. Install from `mirror/` with `bun install`. Private `@guiho40` packages use Google Artifact Registry from `mirror/.npmrc`; auth helper is `bun _gaa` or `bunx google-artifactregistry-auth`.

## Commands

- Typecheck: `cd mirror && bun run typecheck`
- Test all: `cd mirror && bun test`
- Test one file: `cd mirror && bun test source/guiho-mirror.spec.ts`
- Build binaries: `cd mirror && bun run build` (writes ignored `mirror/bin/`)
- Compile CLI binary: `cd mirror && bun run binary` (writes ignored `mirror/bin/`)
- Avoid `bun _ci` and `bun clean-installation` unless intentionally resetting dependencies; they remove `node_modules` and `bun.lock`.

## CLI Behavior

- Supported forms are `mirror see`, `mirror <semver-or-release-type>`, and `mirror <path-to-package.json> <semver-or-release-type>`.
- Release types are hard-coded in `source/mirror.ts`: `major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, `prerelease`; prerelease bumps use `alpha.1`.
- A release run mutates `package.json`, also mutates sibling `package.build.json` when present, then runs `git add`, `git commit`, `git tag`, `git push`, and `git push --tags`. Test CLI release paths in a disposable fixture repo, not this worktree.

## Gotchas

- There is no lint or formatter config. Existing TS uses strict `tsconfig.json`, single quotes, and no semicolons; match nearby style.
- Generated outputs (`mirror/bin/`, `*.tgz`) are ignored; do not hand-edit them.
- `ci/build-test-publish.sh` clones to `.temp/mirror`, checks out an `@guiho40/mirror@...` tag, authenticates Artifact Registry, then runs `typecheck -> bun test -> build -> binary -> bun publish`. Its explicit-argument branch currently builds `_tag` from undefined `_version`; verify before relying on it.
- `.vscode/terminals.json` references `bun clean-hard`, but `mirror/package.json` does not define that script.

## Documentation Discipline

- `mirror/DOCS.md` is the full package documentation and must describe the behavior that ships.
- Every time code, configuration, CLI behavior, packaging, release automation, agent automation, or user-facing workflow is modified, update `mirror/DOCS.md` before publishing a new version.
- If a change genuinely does not require documentation, state that explicitly during release preparation before publishing.

## Semantic Project Versioning -- GUIHO Mirror

Invoke the guiho-s-mirror agent skill every time the user wants to bump, tag, release, plan, initialize, configure, or troubleshoot semantic project versioning with GUIHO Mirror.

Before editing release docs or changelogs, inspect mirror.config.toml. If [agents].write_changelog is false, skip changelog edits. If it is missing or true, changelog edits are allowed when the project has a changelog.

Use [agents].changelog_path as the changelog file path. If it is missing, use CHANGELOG.md in the project root.

## GUIHO Project

### Identity

| Field | Value |
| --- | --- |
| GUIHO Project ID | g0000 observed in current GUIHO runtime artifacts; confirm before using as a formal registry ID |
| GUIHO Subject ID | TBD - formal subject ID for this component is not declared yet |
| GUIHO Subject Name | Mirror |
| Project Family | guiho |
| Repository Directory | C:\GUIHO\mirror |
| Repository Kind | shared package |
| Parent Project | GUIHO Root (C:\GUIHO\guiho) |
| Parent Component | GUIHO Root |

### Component Purpose

Semantic project versioning and release workflow package for @guiho/mirror.

### Parent Context

- Parent AGENTS: [../guiho/AGENTS.md](../guiho/AGENTS.md)
- Parent TODO: [../guiho/TODO.md](../guiho/TODO.md)
- Local TODO: [./TODO.md](./TODO.md)

For the full project map, sibling components, package index, service index,
project-wide TODOs, and cross-repository coordination rules, read the parent
repository's AGENTS.md GUIHO Project section.

### Local Scope

- Kind: shared package
- Work directory: .
- Primary skills: guiho-s-mirror, guiho-s-0015-bun
- Baseline checks: package-local typecheck/test scripts when present

### Coordination Rules

- This repository is a child of C:\GUIHO\guiho.
- Keep component-specific implementation tasks in the local TODO file.
- Keep cross-component planning and parent delegation in the parent TODO file.
- Read this component's existing local instructions before editing source code.
- Do not publish, deploy, run migrations, rotate secrets, or mutate production resources without explicit user approval.
