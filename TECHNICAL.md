# Technical Notes

## Mirror v3

Mirror v3 is implemented as a Bun/TypeScript ESM CLI and library in `mirror/source/`.

The public library entrypoint is `mirror/source/guiho-mirror.ts`. The CLI entrypoint is `mirror/source/guiho-mirror-bin.ts`, which delegates to the exported CLI command.

The package uses these modules:

- `guiho-mirror-cli.ts`: citty command definitions and process-facing output.
- `guiho-mirror-config.ts`: TOML discovery, schema validation, defaulting, and CLI override merge.
- `guiho-mirror-version.ts`: semantic version validation and target resolution.
- `guiho-mirror-adapters.ts`: package, JSR, and Git read/write primitives.
- `guiho-mirror-plan.ts`: read-only validation and release plan generation.
- `guiho-mirror-executor.ts`: the only layer that applies file writes, commits, tags, or pushes.
- `guiho-mirror-reporter.ts`: text and JSON reports.
- `guiho-mirror-errors.ts`: user-facing errors with stable exit codes.

Configuration lookup order is explicit `--config`, then `mirror.config.toml`, then `config/mirror.config.toml`. Root config wins over nested config.

Supported Git tag templates are intentionally limited to `v{version}` and `{name}@{version}`. Templates with `{name}` require `project.name`, `project.name_source = "package"`, or `project.name_source = "jsr"`.

`mirror version apply` is the only mutating command. Dry runs return before mutation, dirty Git worktrees fail by default, and file outputs combined with Git tags require commit or push behavior so release tags point at release commits.
