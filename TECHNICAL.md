# Technical Notes

## Mirror v3

Mirror v3 is a Bun-native CLI-only package. The public runtime artifact is a compiled native binary; the installed `mirror` command should not require Node.js or Bun at runtime.

The CLI entrypoint is `mirror/source/guiho-mirror-bin.ts`, which delegates to the Bun-native command router. `source/guiho-mirror.ts` is an internal source aggregation used by tests and internal imports, not a public TypeScript API contract.

**Git is optional.** Only `source = "git"`, `output` including `git`, or commit/tag/push operations require Git. Package-only and JSR-only workflows run without Git installed.

The package uses these modules:

- `cli.ts`: internal command router and process-facing output.
- `config.ts`: Bun TOML discovery, schema validation, defaulting, and CLI override merge.
- `version.ts`: semantic version validation and target resolution via `semver`.
- `adapters.ts`: package, JSR, and Git read/write primitives using Bun process execution.
- `runtime.ts`: Bun file, shell, process, and temporary-directory helpers.
- `path.ts`: small cross-platform path helpers used instead of Node.js `path` imports.
- `plan.ts`: read-only validation and release plan generation.
- `executor.ts`: the only layer that applies file writes, commits, tags, or pushes.
- `reporter.ts`: text and JSON reports.
- `errors.ts`: user-facing errors with stable exit codes.

Configuration lookup order is explicit `--config`, then `mirror.config.toml`, then `config/mirror.config.toml`. Root config wins over nested config.

Supported Git tag templates are intentionally limited to `v{version}`, `{name}@{version}`, and `{name}/v{version}`. Templates with `{name}` require `project.name`, `project.name_source = "package.json"`, or `project.name_source = "jsr.json"`.

`mirror version apply` is the only mutating command. Dry runs return before mutation, dirty Git worktrees fail by default, and file outputs combined with Git tags require commit or push behavior so release tags point at release commits.
