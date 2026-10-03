---
name: Mirror Agent Instructions
purpose: Define engineering and release boundaries for the production Mirror CLI.
description: Repository instructions for Go/Cobra Mirror work.
created: 2026-07-26
owner: mirror
flags: []
tags: [mirror, agents, go]
keywords: [cli engineering, validation, release boundary]
---

#### &copy; 2026 [GUIHO](https://guiho.co) as represented by [Cristóvão GUIHO](https://guiho.co/cguiho) All Rights Reserved.

## Agent

Always read `C:\GUIHO\superiority\agents\guiho-a-0001-swe.AGENTS.md`.
Stop if it cannot be found.

## Required CLI Engineering

- Use `guiho-a-0001-swe` as the lifecycle controller for Mirror architecture,
  planning, implementation, review, validation, and release preparation.
- Load and follow `guiho-s-0035-cli-engineer-go` whenever creating, changing,
  reviewing, testing, packaging, installing, or releasing the Mirror CLI.
- Use `guiho-s-xdocs` for structured documentation and `guiho-s-mirror` for
  semantic-version planning or release work.
- Prefer the approved Go/Cobra contract for all Mirror behavior.

# Repository Notes

- The production Go module lives at the repository root. `main.go` is the thin
  executable entrypoint; `cmd/` owns the single Cobra command tree; `pkg/` owns
  domain behavior; `embed/` owns bundled agent resources.
- Mirror is never distributed through a package manager. Agents must install it
  only with the canonical README install commands or a manual verified binary.
- Configuration is YAML only and strictly decoded into typed Go structures.
- Use Go, Cobra, and the standard library. Do not add Viper or a second command
  parser. Builds are static (`CGO_ENABLED=0`).
- Generated outputs in `bin/` are ignored and must not be hand-edited.

## Commands

- Format check: `gofmt -l .`
- Test: `go test -count=1 ./...`
- Vet: `go vet ./...`
- Build the exact release set: `go run ./devops/build-binaries.go --version <version> --commit <sha> --build-date <RFC3339>`
- Verify release assets: `go run ./devops/verify-release-assets --dir bin`
- Configuration check: `go run . config check`
- Command contract: `go run . --help-tree` and `go run . --help-docs`

## CLI Behavior

- Canonical groups are `init`, `config`, `version`, `agent`, `upgrade`, and
  `uninstall`.
- Release targets are `major`, `premajor`, `minor`, `preminor`, `patch`,
  `prepatch`, `prerelease`, or exact SemVer.
- Read `mirror.yaml`; never restore TOML fallback or parent-directory search.
- Ordinary config/version commands never mutate agent resources. Use explicit
  singular `mirror agent ...` commands.
- Plain argument-free `mirror` is the intentional exception: it idempotently
  bootstraps global skills and current-repository managed instructions before
  printing the banner. It must not perform version or release effects.
- `mirror init` defaults to `v{version}`, release commits enabled, and release
  pushes enabled; explicit interactive selections and flags are authoritative.
- Test version-application paths only in disposable fixture repositories.
- A Git-only repository with no version tags may plan/apply an exact initial
  SemVer; relative targets must fail until that canonical seed exists.
- Exit codes are stable: 0 success, 1 general, 2 usage, 3 configuration,
  4 network, 5 integrity, and 130 interruption.

## Delivery Contract

- `pkg/release` owns the exact matrix: 8 native executables, one skill ZIP, one
  instruction prompt, and one checksum manifest (11 assets total).
- Canonical release tags are `mirror/v<semver>` and native asset names use
  `mirror-<goos>-<arch>` with `.exe` on Windows.
- CI and publication are Go-only. Publication remains separately authorized;
  never bump, tag, push, publish, or create a release without explicit approval.
- Installers and upgrades must verify SHA-256 before replacement, preserve a
  rollback path, and reconcile the embedded skill/instruction resources only
  after a successful binary transition.

## Documentation Discipline

- `README.md` is the user entrypoint and `mirror/DOCS.md` is the full behavior
  contract. Update both when user-visible behavior or delivery changes.
- Keep `TECHNICAL.md`, the Go RFC, implementation plan, review, validation, TODO,
  XDocs descriptors, and embedded skill consistent with shipped behavior.

## Semantic Project Versioning

Invoke `guiho-s-mirror` whenever the user requests a bump, tag, release, plan,
initialization, configuration, or semantic-version troubleshooting. Inspect
`mirror.yaml` first. Respect `agents.write_changelog` and `agents.changelog_path`.
`version apply` may commit and push in this repository, so do not run it during
ordinary implementation or validation.

## GUIHO Project

- Repository: `C:\GUIHO\mirror`
- Parent: `C:\GUIHO\guiho`
- Purpose: deterministic semantic project versioning and release workflows.
- Parent instructions: `../guiho/AGENTS.md`
- Parent backlog: `../guiho/TODO.md`
- Local backlog: `TODO.md`
- Keep component work local and cross-component coordination in the parent.
- Do not publish, deploy, migrate, rotate secrets, or mutate production without
  explicit approval.

<!-- BEGIN MIRROR — DO NOT EDIT THIS SECTION -->
## GUIHO Mirror Instruction Block

Run plain `mirror` once in a repository to verify the global Mirror skill and
this bounded instruction block. Repeated runs are idempotent.

Use `mirror version plan <target>` and `mirror version apply <target>` for semantic versioning.
`mirror init` defaults to `v{version}` tags and enables release commits and
pushes; explicit interactive or flag selections remain authoritative.

When `mirror.yaml` defines hooks, follow AI instructions only at the
agent-controlled everything, plan, and apply boundaries. Treat command hooks as
repository code: pass `--run-hooks` or `--skip-hooks` only with explicit
authorization, independently of `--yes`.
<!-- END MIRROR -->
## Mandume

GUIHO Mirror.

Managed by the GUIHO Mandume swarm ([CGuiho/mandume](https://github.com/CGuiho/mandume)); the full worker-registry example lives at `example/AGENTS.md` there.

### Mode

```yaml
execution: dnd  # dnd | interruptible — orchestrator NEVER stops during execution/review
notifications: "off"  # human-facing only; child completion stays enabled
harness: opencode  # only current harness; native background subagents always
tmux-session: mirror  # orchestrator session on su-57; convention = this project's name
```

### Coordination

- GitHub repository: https://github.com/CGuiho/mirror.git
- GitHub Project: [#2 GUIHO](https://github.com/users/CGuiho/projects/2) — authoritative for task state; local Markdown mirrors remote readbacks.
- GitHub component: `mirror` — exact option verified by parent bootstrap.
- Issue ownership: every task is a real issue in its owning repository, attached to this Project with exactly one Component; a draft alone is insufficient.
- Current policy task: [#32](https://github.com/CGuiho/mirror/issues/32); [spec](docs/todo/native-background-worker-policy.md).
- To-do file: `todo.md` (repo root)
- Reserved port: pending — reserve in `apps.md` (`CGuiho/guiho`)

### Workers

| Worker | Class | Model (exact OpenCode ID) | Thinking | Usage |
| --- | --- | --- | --- | --- |
| `mastermind` | mastermind | `xiaomi/mimo-v2.6-pro` (direct Xiaomi API) | provider default, no variant | CG-authorized default; provider/account-dependent |
| `engineer` | workhorse | `xiaomi/mimo-v2.6-pro` (direct Xiaomi API) | provider default, no variant | CG-authorized default; provider/account-dependent |

Both roles follow [canonical Convention 0007](https://github.com/CGuiho/guiho/blob/cd2ce966/conventions/guiho-convention-0007-models.md). MiMo variants=[]: document omission of the variant parameter; thinking is enabled under provider defaults, with no fabricated max/xhigh tier. No guaranteed capacity, second active model or silent fallback. `openai/gpt-6.1-sol#xhigh` is expressly authorized only for this rollout, not a future default. Weekly-pool models need ensured usage and explicit CG run authorization.

### Historical worker pins — inactive

The following former pins are retained history only, never current workers or fallback capacity.

| Worker       | Class      | Model (opencode ID)                                                                                     | Thinking | Usage        |
| ------------ | ---------- | --------------------------------------------------------------------------------------------------------------------- | -------- | ------------ |
| `mastermind` | mastermind | Muse Spark 1.3 Contributor (`vercel/meta/muse-spark-1.3-contributor`, Vercel AI Gateway, first-pick mastermind) | max      | api-always   |
| `engineer`   | workhorse  | DeepSeek V4.1 Flash (`opencode/deepseek-v4-flash`)                                                                    | max      | api-always   |
| `engineer`   | workhorse  | GLM 5.3 Flash (`opencode/glm-5.3-flash`)

> Former order: Muse Spark → GLM → DeepSeek; former GLM thinking/usage: max / api-always. All values in this historical section are inactive.

### Contract

- Read the actual [Convention 0011 §8.1](https://github.com/CGuiho/guiho/blob/cd2ce966/conventions/guiho-convention-0011-agent-readiness.md) and owning instructions. OpenCode is the only currently supported agent harness. Always delegate via its built-in subagent tool under `guiho-s-0440-hand-off`; select an authorized capable native agent with actual required child permissions. General supports broad shell/write work; Explore is read-only by default. Each child has its own configured permissions, not an assumed copy of the parent's; preserve full task authority within those permissions.
- Resolve the authorized exact provider/model and available reasoning variant against the actual catalog and registry; pass them explicitly through the live native tool schema, documenting provider-default omission when no variant exists. Every brief includes Mode: dnd, actual convention/owning context, task identity, exclusive paths, capabilities, acceptance/checks and commit/push authority.
- Use background child sessions and harness completion notifications. Human notifications off does not disable child completion. No native worker polling, sleeping, repeated status loops or file tailing. On completion inspect child identity, errors and timing; verify actual scoped diff, acceptance/checks, owning issue/Project membership/exact Component/Status readbacks and owned commits; integrate and immediately continue the next ready unit without CG.
- Record exact tool/provider/permission failures, fail dependent units safely and continue independent work; select an already-authorized capable native agent where possible. No active OpenCode CLI-worker exception exists, including capability gaps, permission denial or an earlier CLI request; no host permission/config widening or silent model substitution. Other harness adapters are inactive history. CLI workers are dormant only for a future CG-authorized harness actually lacking a native subagent tool. Ordinary Git/gh/Bun/XDocs/RunX CLI tools and launching a primary OpenCode session are distinct from CLI workers.
- Coordinate on main and never ask CG or wait for a wake-up during DND execution/technical review. Resolve reversible questions from evidence, ledger in `docs/questions/`, and continue; actual security/data-loss, impossible-specification or missing-security-authorization blockers go to `docs/issues/` while independent valid units continue. Commit only coherent owned work; preserve unowned edits, secret/production boundaries and existing lifecycle requirements. Child push requires explicit parent authorization; independent human review follows technical review.
- Use the Mandume skills (`guiho-s-mandume` + lifecycle skills) and the Essentials skills (`guiho-s-0001-guiho`, `guiho-s-0004-working-with-cg`, `guiho-s-0040-explorer`, `guiho-s-0032-git-commit`). Conventions: `conventions/` in `CGuiho/guiho` (`apps.md` for ports).
