# Technical Notes

## Mirror v3

Mirror v3 is implemented as a Bun/TypeScript ESM CLI and library in `mirror/source/`.

The public library entrypoint is `mirror/source/guiho-mirror.ts`. The CLI entrypoint is `mirror/source/guiho-mirror-bin.ts`, which delegates to the exported CLI command.

The package uses these modules:

- `cli.ts`: citty command definitions and process-facing output.
- `config.ts`: TOML discovery, schema validation, defaulting, and CLI override merge.
- `version.ts`: semantic version validation and target resolution.
- `adapters.ts`: package, JSR, and Git read/write primitives.
- `plan.ts`: read-only validation and release plan generation.
- `executor.ts`: the only layer that applies file writes, commits, tags, or pushes.
- `reporter.ts`: text and JSON reports.
- `errors.ts`: user-facing errors with stable exit codes.

Configuration lookup order is explicit `--config`, then `mirror.config.toml`, then `config/mirror.config.toml`. Root config wins over nested config.

Supported Git tag templates are intentionally limited to `v{version}` and `{name}@{version}`. Templates with `{name}` require `project.name`, `project.name_source = "package"`, or `project.name_source = "jsr"`.

`mirror version apply` is the only mutating command. Dry runs return before mutation, dirty Git worktrees fail by default, and file outputs combined with Git tags require commit or push behavior so release tags point at release commits.
