# Mirror Hooks — Design Document

**Date:** 2026-06-07
**Status:** Draft
**Target version:** v3.3.0 (or v4.0.0 if breaking config schema change)

---

## 1. Motivation

Mirror currently has a strictly deterministic release pipeline with no extension points. Users have no way to run custom scripts (typechecks, changelog generation, notifications, etc.) at defined points in the release workflow. This proposal adds a lifecycle hook system that lets users opt into automated gates and side-effects.

---

## 2. Hook Lifecycle Points

Hooks fire at named lifecycle points during `mirror version apply`. They do **not** fire during read-only commands (`version plan`, `version next`, `version current`).

### 2.1 Ordered Lifecycle (Top-Down)

```
before:everything              # Runs once, before anything else
  │
  ├─ before:plan               # Runs before buildVersionPlan()
  │    buildVersionPlan()      # Plan construction (read-only)
  │    after:plan              # Runs after plan is built
  │
  ├─ before:apply              # Runs before executeVersionPlan()
  │    │
  │    ├─ before:write         # Runs before each file-write batch
  │    │    write-file(s)      # Mutate package.json / jsr.json
  │    │    after:write        # Runs after all file writes
  │    │
  │    ├─ before:commit        # Runs before git commit
  │    │    git-commit         # git add + git commit
  │    │    after:commit       # Runs after git commit
  │    │
  │    ├─ before:tag           # Runs before git tag
  │    │    git-tag            # git tag -m "..."
  │    │    after:tag          # Runs after git tag
  │    │
  │    ├─ before:push          # Runs before git push
  │    │    git-push           # git push + git push --tags
  │    │    after:push         # Runs after git push
  │    │
  │    after:apply             # Runs after executeVersionPlan() completes
  │
  after:everything             # Runs once, after everything else (runs even if an earlier hook fails, see 5.1)
```

### 2.2 Lifecycle Points Reference

| Hook               | When                           | Context                      |
|--------------------|--------------------------------|------------------------------|
| before:everything  | Start of `version apply`       | CLI flags, config path       |
| after:everything   | End of `version apply`         | Full execution result        |
| before:plan        | Before building the plan       | Current version, target      |
| after:plan         | After plan is built            | Full version plan            |
| before:apply       | Before executing the plan      | Full version plan            |
| after:apply        | After plan execution           | Execution result             |
| before:write       | Before file writes             | Paths, current → next ver    |
| after:write        | After all file writes          | Paths, current → next ver    |
| before:commit      | Before git commit              | Commit message, paths        |
| after:commit       | After git commit               | Commit message, paths        |
| before:tag         | Before git tag                 | Tag name                     |
| after:tag          | After git tag                  | Tag name                     |
| before:push        | Before git push                | Include commit, include tags |
| after:push         | After git push                 | Include commit, include tags |

### 2.3 When Hooks Are Skipped

Hooks are **not** run when:
- The action they wrap is not part of the plan (e.g., `before:commit` / `after:commit` if `commit = false`)
- The plan is a dry run (`--dry-run`)

`before:everything` and `after:everything` always run for `version apply` (even dry-run, even `version plan`? No—only `version apply`).

---

## 3. Hook Script Interface

### 3.1 Command Specification

Each hook is a shell command string. Mirror shells out via `node:child_process` (the same `execFile` pattern used in `adapters.ts`).

```toml
[hooks]
before_everything = "npm run typecheck"
before_plan       = ["npm run lint", "npm run typecheck"]
after_apply       = "node scripts/notify-release.js"
```

- A **string** value runs a single command.
- An **array of strings** value runs multiple commands sequentially in the given order.
- The working directory for every hook is the project root (Mirror's resolved `cwd`).
- The shell used is the platform default shell (cmd.exe on Windows, /bin/sh on macOS/Linux). On POSIX, Mirror uses `['/bin/sh', '-c', command]`; on Windows, `['cmd.exe', '/c', command]`.

### 3.2 Environment Variables

Every hook receives the following environment variables:

| Variable               | Always | Description                                           |
|------------------------|--------|-------------------------------------------------------|
| `MIRROR_CWD`           | Yes    | Project root directory                                |
| `MIRROR_CONFIG_PATH`   | Yes    | Path to resolved `mirror.config.toml`                 |
| `MIRROR_SOURCE`        | Yes    | Version source adapter (`package.json`/`jsr.json`/`git`) |
| `MIRROR_OUTPUT`        | Yes    | Comma-separated output adapters                       |
| `MIRROR_CURRENT`       | Plan+  | Current version string (e.g. `1.2.3`)                 |
| `MIRROR_NEXT`          | Plan+  | Next version string (e.g. `1.2.4`)                    |
| `MIRROR_TARGET`        | Plan+  | The release target argument (e.g. `patch`, `2.0.0`)   |
| `MIRROR_PROJECT_NAME`  | Plan+  | Resolved project name (if available)                  |
| `MIRROR_GIT_TAG`       | Plan+  | Rendered git tag (if git output)                      |
| `MIRROR_FILE_PATHS`    | Write+ | Comma-separated file output paths                     |
| `MIRROR_COMMIT_MSG`    | Commit+| Commit message                                       |
| `MIRROR_COMMIT_PATHS`  | Commit+| Space-separated paths being committed                 |
| `MIRROR_TAG`           | Tag+   | Git tag being created                                 |
| `MIRROR_INCLUDE_COMMIT`| Push+  | `true`/`false`                                        |
| `MIRROR_INCLUDE_TAGS`  | Push+  | `true`/`false`                                        |
| `MIRROR_APPLIED`       | After  | `true`/`false` (whether execution actually applied)     |
| `MIRROR_DRY_RUN`       | After  | `true`/`false`                                        |

"Plan+" means available for `before:plan` and all later hooks. "Write+" means available for `before:write` and all later hooks. "After" means `after:apply` and `after:everything`.

### 3.3 Exit Codes

- **Exit code 0**: Success. Pipeline continues.
- **Exit code non-zero**: Failure. Pipeline stops with a `MirrorError` (default behavior, configurable per-hook).

### 3.4 Output Handling

- Hook `stdout` is captured and printed after the hook completes (prefixed with `[mirror:hook:<name>]`).
- Hook `stderr` is captured and printed after the hook completes (prefixed with `[mirror:hook:<name>]`).
- When `--format json` is active, hook output is collected into the JSON result instead of printed directly.

---

## 4. Configuration Schema

### 4.1 TOML Additions (`mirror.config.toml`)

```toml
[hooks]
# Each hook key maps to a TOML string or array of strings.
# Keys are the lifecycle point names with underscores instead of colons.

before_everything = "echo 'Starting release...'"
after_everything  = "echo 'Release complete!'"

before_plan = ["npm run lint", "npm run typecheck"]
after_plan  = "echo 'Plan is ready'"

before_apply = "npm run build"
after_apply  = "node scripts/notify-release.js"

before_write = "echo 'Writing version files...'"
after_write  = "echo 'Files written'"

before_commit = ["npm run format", "echo 'Committing...'"]
after_commit  = "echo 'Committed'"

before_tag   = "echo 'Tagging release...'"
after_tag    = "echo 'Tagged'"

before_push  = "echo 'Pushing...'"
after_push   = "echo 'Pushed'"
```

### 4.2 TypeScript Types Additions

```ts
// In types.ts

export type MirrorHookName =
  | 'before:everything' | 'after:everything'
  | 'before:plan'        | 'after:plan'
  | 'before:apply'       | 'after:apply'
  | 'before:write'       | 'after:write'
  | 'before:commit'      | 'after:commit'
  | 'before:tag'         | 'after:tag'
  | 'before:push'        | 'after:push'

export type MirrorHookCommand = string | string[]

export type MirrorHooksConfig = Partial<Record<MirrorHookName, MirrorHookCommand>>

// In MirrorRawConfig, add:
export type MirrorRawConfig = Partial<{
  // ... existing fields ...
  hooks: Partial<Record<string, MirrorHookCommand>>  // string keys for raw TOML
}>

// In MirrorConfig, add:
export type MirrorConfig = {
  // ... existing fields ...
  hooks: MirrorHooksConfig
}

// New result type for hook execution:
export type MirrorHookResult = {
  name: MirrorHookName
  commands: string[]
  status: 'success' | 'failure' | 'skipped'
  durationMs: number
  exitCode?: number
  stdout?: string
  stderr?: string
}

// Add to MirrorExecutionResult:
export type MirrorExecutionResult = {
  // ... existing fields ...
  hookResults?: MirrorHookResult[]
}
```

### 4.3 Normalization

- Raw TOML hook keys use underscores (`before_everything`). Normalization maps them to colon-separated names (`before:everything`).
- A string value is normalized to a single-element array internally.
- Unknown keys in `[hooks]` are silently ignored (forward compat).

---

## 5. Error Handling

### 5.1 Fail-Fast (Default)

When a hook exits with a non-zero code, Mirror immediately stops the pipeline and throws a `MirrorError`:

```
Hook 'before:plan' failed (exit code 1): npm run typecheck
```

`after:everything` and `after:apply` hooks are **exceptions**: they run even if an earlier hook or action failed, so users can send failure notifications. Both use `try/finally` semantics.

### 5.2 Continue-On-Failure (Future)

A future enhancement could add:

```toml
[hooks]
on_failure = "continue"  # or "stop" (default)

# or per-hook:
before_plan = { command = "npm run lint", on_failure = "continue" }
```

This is **out of scope for the initial implementation** to keep the TOML schema simple and avoid nested inline tables. Users who need this can wrap their script with `|| true`.

---

## 6. Implementation Plan

### 6.1 New Module: `source/hooks.ts`

```
hooks.ts
├── runHook(command, env, cwd) → MirrorHookResult
├── runHooks(name, commands, env, cwd) → MirrorHookResult[]
├── hookEnv(plan, action?) → Record<string, string>           # Build env vars
├── normalizeHooksConfig(raw) → MirrorHooksConfig             # Map underscores → colons
└── mirrorHookNames: MirrorHookName[]                          # All valid hook names
```

### 6.2 Changes to Existing Files

| File            | Changes                                                                 |
|-----------------|-------------------------------------------------------------------------|
| `types.ts`      | Add `MirrorHookName`, `MirrorHookCommand`, `MirrorHooksConfig`, `MirrorHookResult`. Add `hooks` field to `MirrorRawConfig` and `MirrorConfig`. Add `hookResults` to `MirrorExecutionResult`. |
| `config.ts`     | Normalize `hooks` from raw TOML into `MirrorConfig`. Map `_` → `:` keys. |
| `schema.ts`     | Add `[hooks]` section to JSON schema.                                   |
| `executor.ts`   | Wrap `executeVersionPlan()` with before/after:everything and before/after:apply hooks. Wrap individual actions. |
| `plan.ts`       | Wrap `buildVersionPlan()` with before/after:plan hooks.                 |
| `reporter.ts`   | Add hook result reporting (text + JSON modes).                          |
| `cli.ts`        | No structural changes needed; executor handles hooks internally.        |

### 6.3 Execution Flow (Pseudocode)

```ts
// Inside version apply command handler in cli.ts:

const hooks = loadHooksConfig(config)

// 1. before:everything
await runHooks('before:everything', hooks['before:everything'], envEverything)

try {
  // 2. before:plan
  await runHooks('before:plan', hooks['before:plan'], envPlan)
  
  // 3. build plan
  const plan = await buildVersionPlan(target, options)
  
  // 4. after:plan
  await runHooks('after:plan', hooks['after:plan'], envForPlan(plan))

  // 5. before:apply
  await runHooks('before:apply', hooks['before:apply'], envForPlan(plan))

  try {
    // 6. execute plan (with before/after write, commit, tag, push hooks)
    const result = await executeVersionPlanWithHooks(plan, hooks, options)
  } finally {
    // 7. after:apply (always runs)
    await runHooks('after:apply', hooks['after:apply'], envForResult(result))
  }
} finally {
  // 8. after:everything (always runs)
  await runHooks('after:everything', hooks['after:everything'], envEverything)
}
```

### 6.4 Action-Level Hooks Inside Executor

The executor loop gains hook support:

```ts
for (const action of plan.actions) {
  if (action.type === 'write-file') {
    await runHooks('before:write', hooks['before:write'], envForAction(plan, action))
    await writeFile(...)
    await runHooks('after:write', hooks['after:write'], envForAction(plan, action))
  }
  // ... same pattern for commit, tag, push
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests (`guiho-mirror.spec.ts` additions)

- `normalizeHooksConfig` maps keys correctly
- Unknown hook keys are silently dropped
- String commands normalize to arrays
- `hookEnv()` produces correct env vars for each lifecycle point

### 7.2 Integration Tests (fixture repo)

- Hook that echoes a string and succeeds
- Hook that exits with non-zero code stops the pipeline
- Hook env vars contain expected version info
- `after:everything` fires even when a prior hook fails
- Hook stdout/stderr appear in output
- `--dry-run` skips hooks (or does it? TBD)

---

## 8. Open Questions

1. **Should hooks run during `--dry-run`?** Leaning toward **no** — dry-run is read-only by definition, and hooks are side effects. But `before:everything` / `after:everything` could still run as "notification" hooks. Probably simplest to skip all hooks on dry-run.

2. **Should `version plan` (read-only) also support hooks?** No for v1. Hooks add side-effects, and `version plan` is explicitly read-only. Users can run their checks manually before calling `version apply`.

3. **Should `before:write` fire once per batch or once per file?** Once per batch (all file writes share one before/after pair). Individual file hooks would be noisy and rarely useful.

4. **Should we support platform-conditional hooks?** Not in v1. Users can handle this in their scripts.

5. **Should hook command strings support `{version}` interpolation?** Tempting but adds complexity. Environment variables serve the same purpose and are a standard interface.

---

## 9. Migration & Back-Compat

- `hooks` is a new optional top-level key in `mirror.config.toml`. Existing configs without `hooks` work unchanged.
- The config schema version remains `1` (optional fields are backward-compatible).
- No breaking changes to the CLI interface or library API.
- `MirrorExecutionResult` gains an optional `hookResults` field. Consumers that destructure won't break.

---

## 10. Documentation

After implementation, update `mirror/DOCS.md` with:
- New `[hooks]` section reference
- List of all lifecycle points and when they fire
- Environment variable reference
- Example configurations
- Error handling behavior
