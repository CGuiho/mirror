# Technical Notes

## Mirror v3

Mirror v3 is a Node.js/TypeScript ESM CLI and library published to npm. The public runtime targets **Node >= 20**. Bun is used as the project's dev tool, test runner, and CI builder; the published `library/` output does not import from `bun` at runtime.

The public library entrypoint is `mirror/source/guiho-mirror.ts`. The CLI entrypoint is `mirror/source/guiho-mirror-bin.ts`, which delegates to the exported CLI command.

**Git is optional.** Only `source = "git"`, `output` including `git`, or commit/tag/push operations require Git. Package-only and JSR-only workflows run without Git installed.

The package uses these modules:

- `cli.ts`: citty command definitions and process-facing output.
- `config.ts`: TOML discovery (via `smol-toml`), schema validation, defaulting, and CLI override merge.
- `version.ts`: semantic version validation and target resolution.
- `adapters.ts`: package, JSR, and Git read/write primitives using Node `child_process.execFile`.
- `plan.ts`: read-only validation and release plan generation.
- `executor.ts`: the only layer that applies file writes, commits, tags, or pushes.
- `reporter.ts`: text and JSON reports.
- `errors.ts`: user-facing errors with stable exit codes.

Configuration lookup order is explicit `--config`, then `mirror.config.toml`, then `config/mirror.config.toml`. Root config wins over nested config.

Supported Git tag templates are intentionally limited to `v{version}`, `{name}@{version}`, and `{name}/v{version}`. Templates with `{name}` require `project.name`, `project.name_source = "package.json"`, or `project.name_source = "jsr.json"`.

`mirror version apply` is the only mutating command. Dry runs return before mutation, dirty Git worktrees fail by default, and file outputs combined with Git tags require commit or push behavior so release tags point at release commits.
