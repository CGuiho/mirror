# Repository Notes

- The real package lives in `mirror/`; run package commands there unless editing root docs or `ci/`.
- `@guiho40/mirror` is a Bun/TypeScript ESM CLI/library. The source and CLI entrypoint is `mirror/source/mirror.ts`; `tsc` emits `mirror/library/` for `main`/`types`, and Bun compiles `mirror/bin/` for the CLI binary.
- Use Bun, not npm/pnpm/yarn. Install from `mirror/` with `bun install`. Private `@guiho40` packages use Google Artifact Registry from `mirror/.npmrc`; auth helper is `bun _gaa` or `bunx google-artifactregistry-auth`.

## Commands

- Typecheck: `cd mirror && bun run typecheck`
- Test all: `cd mirror && bun test` (currently finds `source/mirror.spec.ts` but runs 0 tests)
- Test one file: `cd mirror && bun test source/mirror.spec.ts`
- Build library: `cd mirror && bun run build` (writes ignored `mirror/library/`)
- Compile CLI binary: `cd mirror && bun run binary` (writes ignored `mirror/bin/`)
- Avoid `bun _ci` and `bun clean-installation` unless intentionally resetting dependencies; they remove `node_modules` and `bun.lock`.

## CLI Behavior

- Supported forms are `mirror see`, `mirror <semver-or-release-type>`, and `mirror <path-to-package.json> <semver-or-release-type>`.
- Release types are hard-coded in `source/mirror.ts`: `major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, `prerelease`; prerelease bumps use `alpha.1`.
- A release run mutates `package.json`, also mutates sibling `package.build.json` when present, then runs `git add`, `git commit`, `git tag`, `git push`, and `git push --tags`. Test CLI release paths in a disposable fixture repo, not this worktree.

## Gotchas

- There is no lint or formatter config. Existing TS uses strict `tsconfig.json`, single quotes, and no semicolons; match nearby style.
- Generated outputs (`mirror/library/`, `mirror/bundle/`, `mirror/bin/`, `*.tgz`) are ignored; do not hand-edit them.
- `ci/build-test-publish.sh` clones to `.temp/mirror`, checks out an `@guiho40/mirror@...` tag, authenticates Artifact Registry, then runs `typecheck -> bun test -> build -> binary -> bun publish`. Its explicit-argument branch currently builds `_tag` from undefined `_version`; verify before relying on it.
- `.vscode/terminals.json` references `bun clean-hard`, but `mirror/package.json` does not define that script.
