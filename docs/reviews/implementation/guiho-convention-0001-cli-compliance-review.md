---
name: GUIHO Convention 0001 CLI Compliance Review
purpose: Determine whether the production Mirror CLI obeys GUIHO CLI Convention 0001.
description: Evidence-backed review of Mirror tooling, flags, configuration, agent artifacts, installation, upgrade, uninstall, release, documentation, and validation behavior against the current CLI convention.
created: 2026-08-16
owner: mirror-docs-reviews-implementation
flags: []
tags:
  - implementation-review
  - cli-convention
  - compliance
  - go
  - cobra
keywords:
  - GUIHO CLI convention
  - Mirror compliance
  - stable launcher
  - release artifacts
  - agent evolution
  - RunX
---

# GUIHO Convention 0001 CLI Compliance Review

## Verdict

**Mirror does not comply with `GUIHO CLI Convention 0001`.**

The production Go/Cobra CLI satisfies important parts of the older GUIHO Go
CLI contract, including the language and parser choice, strict YAML decoding,
the eight native payload targets, checksum generation, most command-tree
construction rules, and the existing Go test suite. The convention adopted on
2026-08-16 adds materially different requirements for RunX, flags,
configuration, initialization, agent evolution, release ownership, stable
launchers, installation, synchronous upgrades, and uninstallation. Mirror has
not yet migrated to those requirements.

This is not a marginal documentation mismatch. Installation, upgrade,
uninstall, configuration, and release architecture all require redesign before
the repository can be declared compliant.

## Review Target And Scope

- Convention: `C:\GUIHO\guiho\docs\conventions\guiho-convention-0001-cli.md`
- Repository: `C:\GUIHO\mirror`
- Production implementation: repository-root Go module
- Reviewed branch: `main`
- Reviewed HEAD: `a65562055d1dd6e879812f5507558dbc39d18f43`
- Upstream state: `main` had no ahead/behind count relative to `origin/main`.
- Review date: 2026-08-16
- Historical `mirror/` Bun/TypeScript package: inspected only where it affects
  repository documentation or generated schema history; it is not treated as
  the production CLI authority.
- Pre-existing working-tree changes were excluded from the implementation
  verdict. The review did not modify CLI behavior.

## Compliance Summary

| Area | Status | Summary |
| --- | --- | --- |
| Go, Cobra, and native Go tooling | Complies | The production CLI uses Go 1.26.5, Cobra 1.10.2, Go tests, formatting, vetting, and native builds. |
| One Cobra command tree | Complies | `main.go` delegates to a fresh Cobra tree built by `cmd.NewRootCommand`. |
| Strict YAML decoding | Partially complies | `KnownFields(true)` and semantic validation exist, but the required global/project configuration model does not. |
| Mirror tooling | Complies | Root `mirror.yaml` exists and `mirror config check` passes. |
| RunX tooling | Does not comply | Root `runx.yaml` is absent; RunX check and list both exit 3. |
| XDocs tooling | Partially complies | Strict metadata, tree, and doctor pass, but tracked project-owned directories are excluded from coverage. |
| Flag contract | Does not comply | Version, help-tree depth, global-flag rendering, and list-valued flags violate the convention. |
| Required command tree | Partially complies | The main groups exist, but agent mutation verbs are `update`, not `upgrade`. |
| `init` and configuration | Does not comply | No separate global configuration, inheritance, agent-evolution policy, dual schemas, or common reconciliation sequence exists. |
| Agent artifacts | Does not comply | The main skill lacks the evolution section and the required install/setup prompt is absent. |
| Installers | Does not comply | No channel selection, canonical GUIHO layout, manifest ownership, stable launcher, complete release transaction, or prescribed staging exists. |
| Upgrade | Does not comply | It self-replaces the executable and schedules Windows completion instead of synchronously activating an immutable payload. |
| Uninstall | Does not comply | Mandatory scripts, preservation options, confirmation, manifest ownership, and complete removal behavior are absent. |
| Release artifact set | Does not comply | CI and publication enforce the obsolete 11-asset contract and omit convention-mandated artifacts. |
| README and CI | Does not comply | They document and test the obsolete installation, version-output, upgrade, and release behavior. |

## Noncompliance Findings

### CLI-001: The mandatory RunX catalog is absent

Severity: **Blocker**

The convention requires a root `runx.yaml` containing every supported project
operation. This repository has no `runx.yaml`. Live validation produced:

```text
no runx.yaml found; checked C:\GUIHO\mirror\runx.yaml, C:\Users\crist\.guiho\runx\runx.yaml
```

Both `runx check --format json` and `runx list --format json` exited with code
3. Development, validation, schema generation, installer testing, packaging,
and release operations currently exist only in README, CI, Go tooling, or agent
instructions rather than in the mandatory catalog.

Required correction: create the root manifest using the current RunX schema,
assign stable global UIDs and scoped IDs, catalog every supported repeatable
workflow, and make both required RunX validations pass.

### CLI-002: XDocs passes only because tracked project-owned directories are excluded

Severity: **High**

`xdocs meta . --documents --strict`, `xdocs tree`, and `xdocs doctor .` all
pass. However, `xdocs.yaml:7-18` excludes `.github` and `.vscode`, while both
directories contain tracked project-owned files. `.github/workflows/ci.yml`
and `.github/workflows/publish.yml` are release-authority automation and are
not generated or vendored output. The tracked `.vscode` directory is likewise
repository-owned developer tooling.

The root index is also incomplete: `XDOCS.md:9-13` lists only `devops`, `docs`,
and the historical `mirror` directory even though the validated tree includes
the owned top-level `cmd`, `embed`, and `pkg` children. The passing XDocs
results apply to the pre-existing dirty `xdocs.yaml`, not independently to the
exact reviewed HEAD.

The convention requires every project-owned directory to have a descriptor
and explicitly prohibits excluding owned operational directories merely to
avoid documenting them. A green XDocs result under an invalid exclusion policy
does not satisfy that requirement.

Required correction: remove project-owned tracked directories from the
exclusion list, add their descriptors and tree links, and rerun strict metadata,
tree, and doctor validation.

### CLI-003: Repository contracts still mandate the obsolete release model

Severity: **High**

Several current repository authorities affirmatively require behavior that
Convention 0001 supersedes:

- `AGENTS.md` describes exactly 11 release assets and direct binary replacement.
- `README.md:152-154` describes exactly 11 assets.
- `embed/skills/guiho-s-mirror/SKILL.md:84-90` tells agents to expect exactly
  eight binaries, one skill ZIP, one instruction, and checksums.
- `.github/workflows/ci.yml:41-67` and
  `.github/workflows/publish.yml:49-56,87-95` enforce that set.
- `TECHNICAL.md:44-60` documents direct executable replacement and the obsolete
  artifact model.

This is a policy-level violation in addition to the implementation defects
below. Following the repository's current local contract cannot produce a
Convention 0001-compliant release.

Required correction: update the repository contract, embedded skill, user
documentation, build verification, and publication workflow together with the
new implementation.

### CLI-004: `--version` does not emit raw SemVer

Severity: **Blocker**

`cmd/root.go:80-85` emits `mirror v<version>` for text output and emits a JSON
envelope when `--format json` is combined with `--version`. The local runtime
probe printed:

```text
mirror vdev
```

The convention requires `-v` and `--version` to print only raw SemVer, with no
CLI name, `v` prefix, label, notice, ANSI content, or alternate JSON shape.
Installers and CI also assert the noncompliant decorated form at
`devops/install.sh:266-270`, `devops/install.ps1:209-214`,
`.github/workflows/ci.yml:50-58,100`, and
`.github/workflows/publish.yml:49-56`.

Required correction: make the top-level version flag output only the raw
version and update all lifecycle verification and tests to match.

### CLI-005: `--help-tree-depth` has the wrong type, default, and range

Severity: **High**

`cmd/root.go:110-113,165` defines the flag as an integer whose default `0`
means unlimited and accepts any positive value. The convention requires a
string-compatible default of `max`, and only `max` or integers greater than 1
are valid.

Runtime evidence:

```text
--help-tree-depth max  -> exit 2, invalid integer
--help-tree-depth 1    -> exit 0
```

Required correction: accept `max` and integers greater than 1, reject 0, 1,
negative values, and malformed values, and expose `max` as the documented
default.

### CLI-006: `--help-tree-global-flags` is missing and global flags repeat by default

Severity: **High**

There is no `--help-tree-global-flags` definition in `cmd/root.go:158-167`.
The runtime probe rejects it as an unknown flag. In addition,
`cmd/helptree.go:120-138` always merges inherited flags into every command's
visible flag set. That is the behavior the convention reserves for the
presence of `--help-tree-global-flags`.

Required correction: add the presence-only Boolean flag, show global flags
once at the tree root by default, and repeat them beneath descendants only
when the flag is present.

### CLI-007: List-valued flags use comma-aware `StringSlice`

Severity: **High**

`cmd/version.go:329-332` defines `--output` and `--auxiliary` with Cobra
`StringSlice`. Their help explicitly allows comma-separated values. The
convention requires Cobra `StringArray`, one full flag occurrence per value,
and preservation of the exact input order without default comma splitting.

Required correction: migrate list-valued CLI flags to `StringArray`, remove
comma-separated semantics from help and tests, and verify repeated space and
equals forms.

### CLI-008: Required agent mutation commands use `update` instead of `upgrade`

Severity: **High**

`cmd/agent.go:41-45` registers `agent skill update`, and
`cmd/agent.go:175-178` registers `agent instruction update`. Convention 0001
requires `upgrade` in both trees and explicitly prohibits `update` there.

Required correction: expose `agent skill upgrade` and
`agent instruction upgrade`, remove the prohibited names, and update tests,
help, docs, prompts, and embedded resources.

### CLI-009: Global and project configuration are not separate contracts

Severity: **Blocker**

The convention requires:

- project `mirror.yaml`;
- global `$HOME/.guiho/mirror/mirror.global.yaml`;
- different schemas for the two files;
- a global baseline with field-by-field project overrides.

`pkg/config/config.go:237-280` instead treats project
`mirror.yaml` and `$HOME/.guiho/mirror/mirror.yaml` as mutually exclusive
locations for the same contract, selects one file, and does not merge them.
`README.md:69-71` documents this fallback behavior.

Required correction: introduce a typed global contract, load and validate both
files, define deterministic inheritance, and report both absolute paths.

### CLI-010: `init` does not perform the mandatory common initialization sequence

Severity: **Blocker**

`cmd/init.go:18-113` only creates or validates one `mirror.yaml`. When a valid
file already exists, lines 51-55 return immediately. It does not:

- verify or reconcile every bundled global skill;
- ensure and reconcile `AGENTS.md` as part of `init`;
- create and validate `mirror.global.yaml`;
- validate both configuration schemas;
- resolve effective evolution policy;
- ask the mandatory policy questions;
- preserve and reconcile global/project answers;
- revalidate the full installed/project state before success.

The plain argument-free command performs some agent-resource bootstrapping, but
that separate behavior does not satisfy the required `init` contract.

Required correction: implement all common initialization steps idempotently
and retain Mirror-specific initialization after them.

### CLI-011: The `agent.evolution` configuration and enforcement policy are absent

Severity: **Blocker**

`pkg/config/config.go:38-47,232-235` has only changelog fields under `agents`.
The schema generator at `pkg/config/config.go:681-687` likewise exposes only
`write_changelog` and `changelog_path`. There is no typed
`agent.evolution.upgrade`, no issue policies for bugs, improvements, and
reviews, and no validation of `disabled`, `always-ask`, or `always-proceed`.

Consequently, `mirror upgrade check`, upgrade execution, and GitHub issue
creation cannot be governed by the required persistent authority model.

Required correction: add the global defaults, project overrides, exact enum
validation, effective-policy calculation, `init` interaction, and agent-facing
enforcement.

### CLI-012: Configuration schemas and examples do not meet the release contract

Severity: **Blocker**

Mirror has one project schema at `mirror/schema/mirror.schema.json` and no
`mirror.global.schema.json`. There is no distinct complete global example.
Neither schema nor complete examples are present in the release matrix.

Worse, generated project configuration references mutable branch content at
`cmd/init.go:145-147`:

```text
https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/schema/mirror.schema.json
```

The convention requires each generated file to reference the exact release's
schema using a version-pinned GitHub Release HTTPS URL, while runtime validation
remains local.

Required correction: create separate embedded project/global schemas and
examples, release them, and generate exact-version schema comments.

### CLI-013: Instruction reconciliation can omit `AGENTS.md`

Severity: **High**

`pkg/maintenance/maintenance.go:305-321` targets existing `AGENTS.md` and
`CLAUDE.md`, creates `AGENTS.md` only when neither exists, and therefore updates
only `CLAUDE.md` when that is the sole existing file. Convention 0001 requires
the managed instruction in project `AGENTS.md`, and `init` must ensure that file
exists.

Required correction: make `AGENTS.md` canonical and mandatory. Any additional
projection must not replace it.

### CLI-014: The main skill lacks the mandatory evolution and lifecycle guidance

Severity: **Blocker**

`embed/skills/guiho-s-mirror/SKILL.md` has no exact
`## CLI Evolution and Feedback` heading. It also lacks the required canonical
issue URL, category guidance, policy behavior, authorized issue-creation flow,
post-upgrade `mirror init`, version re-verification, and successful issue URL
reporting. It does not teach the complete install-from-README and setup
lifecycle required of the main skill.

Required correction: add the mandatory section and complete AI-managed
lifecycle instructions, driven by the effective configuration policy.

### CLI-015: The required main install/setup prompt is absent

Severity: **Blocker**

`cmd/agent.go:244-284` exposes only `guiho-i-mirror`. That file is the managed
instruction source (`embed/prompts/guiho-i-mirror.md:1-24`), not a main
install/setup prompt using the expected `guiho-p-mirror` identity. It does not
explain what Mirror is, how to install it, how to verify installation, and how
to upgrade it as the convention requires.

Required correction: obtain/record confirmation of the main prompt ID, bundle
the prompt separately from the instruction, expose it through `agent prompt`,
and include it in the release manifest.

### CLI-016: Mandatory uninstall scripts do not exist

Severity: **Blocker**

`devops/install.sh` and `devops/install.ps1` exist, but
`devops/uninstall.sh` and `devops/uninstall.ps1` do not. The convention requires
all four lifecycle scripts and equivalent platform outcomes.

Required correction: add both scripts on top of the same ownership,
preservation, confirmation, dry-run, and failure contract as the Cobra
`uninstall` command.

### CLI-017: Installers do not support release channels or exhaustive selection

Severity: **Blocker**

`devops/install.sh:15-35` accepts only `--version` and `--install-dir`.
`devops/install.ps1:1-4` accepts only `-Version` and `-InstallDir`. Neither has
`--channel`/`-Channel` or version/channel mutual exclusion.

For `latest`, both call GitHub's latest-release endpoint rather than paginating
the complete release catalog (`devops/install.sh:54-75` and
`devops/install.ps1:41-50`). Exact input is prefix-stripped and interpolated
without strict SemVer validation.

Required correction: implement exact-version and exact-channel selection,
latest-stable defaulting, exhaustive pagination, complete-release filtering,
and fail-before-change behavior.

### CLI-018: The release set lacks mandatory installation and ownership artifacts

Severity: **Blocker**

`pkg/release/matrix.go:27-34` and `devops/build-binaries.go:71-88` produce only
eight binaries, `guiho-s-mirror.zip`, `guiho-i-mirror.md`, and
`checksums.txt`. Missing convention-mandated release content includes:

- platform launcher artifacts;
- `artifacts.json`;
- project and global configuration schemas;
- complete project and global examples;
- the main install/setup prompt;
- the complete versioned canonical agent artifact set and metadata.

The verifier and publisher enforce this incomplete set rather than detecting
it.

Required correction: define and build a complete self-contained release,
declare every contained and projected path in `artifacts.json`, and checksum
every installation artifact other than `checksums.txt`.

### CLI-019: Installers consume only a partial release and have no ownership manifest

Severity: **Blocker**

Bash downloads only the platform payload, skill ZIP, instruction, and checksum
file at `devops/install.sh:244-255`. PowerShell does the same at
`devops/install.ps1:175-199`. There is no installed manifest under
`$HOME/.guiho/mirror/` and no authoritative mapping of artifact IDs, versions,
checksums, canonical paths, projections, retired artifacts, or ownership.

Required correction: download and verify the complete selected release and use
the selected/installed manifests for installation, repair, replacement,
rollback, and uninstall.

### CLI-020: Installation uses a direct payload in `.local/bin`, not a stable launcher

Severity: **Blocker**

Bash defaults to `$HOME/.local/bin` at `devops/install.sh:6-7`; PowerShell
defaults to `$HOME\.local\bin` at `devops/install.ps1:1-4`. Both install the
versioned application payload directly as the command entry point
(`devops/install.sh:257-273`, `devops/install.ps1:201-220`). Bash also permits
an arbitrary install directory.

Neither installer displays the resolved destination before replacement as
required. Bash prints it only after installation at `devops/install.sh:273`;
PowerShell prints it only after installation at `devops/install.ps1:220`.

There is no stable `$HOME/.guiho/bin/mirror[.exe]` launcher, immutable
`$HOME/.guiho/mirror/versions/<version>/` payload, strictly decoded
`current.json`, previous verified pointer, or launcher fallback.

Required correction: implement the canonical shared binary directory, stable
launcher protocol, immutable payload layout, and atomic relative activation
pointer.

### CLI-021: Installer staging violates the shared `.guiho/.temp` boundary

Severity: **High**

Bash uses unrestricted system `mktemp` at `devops/install.sh:241-242`.
PowerShell uses `[IO.Path]::GetTempPath()` at `devops/install.ps1:171-173`.
Neither creates and validates a strict descendant of
`$HOME/.guiho/.temp/mirror-install-<unique-id>/`.

Required correction: stage exclusively under the shared GUIHO temporary root,
validate ownership before recursive cleanup, and remove only the operation's
unique child after both success and failure.

### CLI-022: Install and reinstall are not complete transactional operations

Severity: **Blocker**

Bash deletes the binary backup before installing skills and instructions
(`devops/install.sh:257-277`). PowerShell does the same at
`devops/install.ps1:201-226`. A later agent-resource or instruction failure can
therefore leave a mixed release with no complete rollback.

There is no manifest-based persistent/disposable path classification, complete
same-version repair, removal of retired artifacts, snapshot of every replaced
projection, rollback of the whole release, or preservation contract for global
configuration, project configuration, user data, and databases.

Required correction: make installation/reinstallation one manifest-driven
transaction that preserves persistent paths and restores every replaceable
artifact on failure.

### CLI-023: Installer PATH management is wrong and can duplicate entries

Severity: **High**

The installers add `.local/bin`, not the required shared `.guiho/bin`. Bash
checks only the current process PATH and blindly appends to `.profile` at
`devops/install.sh:223-228`; rerunning before a profile reload can append a
duplicate entry.

Required correction: update the platform-resolved user-level PATH idempotently
for `$HOME/.guiho/bin/`, without requiring administrator/root access.

### CLI-024: Candidate validation is incomplete and occurs after replacement begins

Severity: **Blocker**

No hidden installation `__self-test` exists. Installers run `--version` only
after copying the candidate into the command path. Upgrades likewise lack a
pre-activation check of native executable format, embedded target, complete
embedded release resources, and hidden self-test. Unix upgrade verifies after
replacement (`pkg/updater/replace_unix.go:10-32`), and Windows verifies in the
replacement helper (`pkg/updater/replace_windows.go:86-117`).

Required correction: validate the staged payload and complete release before
activation, then repeat version and self-test verification through the stable
launcher after activation.

### CLI-025: `upgrade` omits the mandatory first and final recovery blocks

Severity: **Blocker**

`cmd/upgrade.go:23-27` performs release resolution before any recovery
message. Dry run can return at lines 28-38 without a recovery block. The only
recovery text is a filesystem restore description, and the command does not
print a directly executable canonical remote reinstall command first and last
for every terminal outcome.

Required correction: print the two-line platform-specific reinstall block
before network/process/filesystem work and again as the final block, pinned to
the resolved exact version once known.

### CLI-026: Upgrade self-replaces and Windows completion is asynchronous

Severity: **Blocker**

`pkg/updater/upgrade.go:102-121` treats the running executable as the install
target. Unix renames and replaces that path. Windows starts a detached helper
and returns `scheduled` (`pkg/updater/replace_windows.go:20-64`).
`cmd/upgrade.go:77-80` tells the user completion will be reported on the next
run, and `cmd/root.go:125-138` consumes the later completion journal.

The candidate is staged beside the executing binary rather than under a unique
`$HOME/.guiho/.temp/mirror-upgrade-*` directory
(`pkg/updater/upgrade.go:144-152`).

The convention expressly prohibits live-payload overwrite, detached helper
authority, a `scheduled` result, and next-invocation completion.

Required correction: install an immutable payload and complete synchronous
atomic launcher activation and verification in the original invocation.

### CLI-027: Upgrade does not require or reconcile a complete release

Severity: **Blocker**

Upgrade resolution requires only one platform payload and `checksums.txt`.
`cmd/upgrade.go:40-57` downloads one checksum and one binary. Agent resources
are reconciled later from whatever is embedded in that binary, without an
`artifacts.json` authority, schemas, examples, prompt set, retired-artifact
removal, or complete release verification.

Public upgrade flags at `cmd/upgrade.go:85-86` also have no `--channel`.

Required correction: resolve exact version/channel across the complete catalog,
require every mandatory release artifact, verify them all, replace the complete
canonical and projected set, and remove retired manifest-owned artifacts.

### CLI-028: Upgrade concurrency, process, journal, and rollback contracts are incomplete

Severity: **Blocker**

The lock at `pkg/updater/upgrade.go:321-355` has an ownership token, but stale
recovery is based on age and does not prove the owner PID is no longer active.
There is no CLI-owned running-instance registry or verified executable-path
termination of other old Mirror processes. The completion journal at
`pkg/updater/journal.go:14-21` records only a final result, not the required
staging, artifact replacement, activation, verification, rollback, and
completion phases.

Rollback restores the binary but cannot restore a manifest-declared complete
artifact set and projections. Reconciliation failure can leave binary and
agent resources from different release states.

Required correction: implement process-owned locking, verified instance
handling, phase-aware recovery, complete snapshots, and complete rollback.

### CLI-029: `uninstall` does not implement the shared uninstall contract

Severity: **Blocker**

`cmd/uninstall.go:81-82` exposes `--dry-run` and the nonstandard
`--keep-agent-resources`. It lacks `--preserve-config`, `--preserve-data`, and
`--yes`. It deletes without the required interactive confirmation and its dry
run prints vague sentences rather than exact grouped `REMOVE` and `PRESERVE`
targets (`cmd/uninstall.go:32-56`).

Default removal covers only guessed skill paths, instruction blocks, and the
executable. It does not remove the complete CLI home, configuration, cache,
state, persistent data, database paths, project `mirror.yaml`, schemas,
prompts, versions, manifests, and managed projections. It guesses resource
ownership by name instead of using an installed manifest. Windows can report
scheduled success before deletion completes (`cmd/uninstall.go:58-73`).

Required correction: build one manifest-driven uninstallation contract shared
by Cobra and both scripts, with destructive default, preservation options,
exact planning, terminal confirmation, strict noninteractive behavior, and
bounded ownership.

### CLI-030: README lifecycle documentation is incomplete and affirmatively stale

Severity: **High**

README does contain the remote PowerShell and Unix installer commands at
`README.md:14-26`. It does not provide the required final raw
`mirror --version` verification command. It has no final `## Uninstall`
operational section, no remote uninstall commands, no destructive-default
warning, no dry run, and no combined preservation example.

`README.md:128-139` also documents the now-prohibited deferred Windows upgrade,
and `README.md:152-154` documents the incomplete 11-asset set.

The documented verifier command is also incorrect: `README.md:149` and
`AGENTS.md:46` use `--dir`, while
`devops/verify-release-assets/main.go:24` defines `--directory`.

Required correction: rewrite lifecycle documentation after the implementation
is migrated and make `## Uninstall` the final operational section.

### CLI-031: CI and publication prove the obsolete contract, not Convention 0001

Severity: **High**

`.github/workflows/ci.yml:41-67` builds exactly 11 assets and asserts decorated
version output. Installer tests at lines 84-106 and 185-240 install a payload
directly into arbitrary fixture directories. Publication enforces 11 public
assets at `.github/workflows/publish.yml:49-56,87-95`.

There is no CI coverage for stable-launcher fallback, immutable activation,
`artifacts.json`, complete-release installation, channel selection,
pre-activation self-test, synchronous upgrade, running-instance termination,
interrupted transaction recovery, persistent-data preservation, or either
uninstall script. There are no Go tests for the public uninstall behavior.

Required correction: replace obsolete assertions with convention-level
acceptance tests on native runners and explicitly label foreign targets as
build-only.

## Confirmed Compliant Or Partially Compliant Behavior

The following points should be preserved during migration:

- `go.mod:1-10` pins Go, Cobra, pflag, YAML, SemVer, and test dependencies.
- `main.go` remains a thin entrypoint and `cmd.NewRootCommand` creates a fresh
  testable Cobra tree.
- `cmd/root.go:153-167` disables the generated completion command and defines
  only the permitted `-v` shorthand; Cobra owns `-h`. Existing tests reject
  other shorthands.
- Cobra accepts ordinary value flags in both `--key value` and `--key=value`
  forms without custom quote parsing.
- `pkg/config/config.go:295-324` strictly decodes one YAML document using
  `KnownFields(true)` and then performs semantic validation.
- The CLI has no prohibited `install` Cobra command.
- The required root groups `init`, `agent`, `upgrade`, and `uninstall` exist;
  Mirror-specific `config` and `version` groups are valid extensions.
- Help-tree and Markdown help are traversed from the live Cobra tree and expose
  developer context.
- Both platform installers exist, detect the currently supported OS/architecture
  targets, and verify the binary, skill, and instruction checksums they download.
- `pkg/release/matrix.go:16-24` defines the correct eight payload targets,
  including ARMv6, ARMv7, ARM64, macOS, Windows ARM64, and AMD64 V1.
- Release builds set `CGO_ENABLED=0`, `GOAMD64=v1`, `GOARM64=v8.0`, and the
  correct `GOARM` levels.
- Checksum generation is deterministic and excludes `checksums.txt` itself.
- The release verifier rejects missing, unexpected, duplicate, unsorted, and
  mismatched entries inside the current, incomplete release scope.
- The release catalog exhausts pages, rejects drafts and malformed canonical
  tags, deduplicates, and SemVer-sorts releases.
- Upgrade target selection uses the embedded release target, which preserves
  ARMv6 versus ARMv7.
- Upgrade downloads are bounded, timed, streamed, and SHA-256 verified.
- Managed instruction mutations validate markers and preserve surrounding
  content transactionally.
- `mirror config check` passes for the current root `mirror.yaml`.
- Strict XDocs metadata, tree, and doctor pass under the current exclusion
  configuration.
- `gofmt -l .`, `go mod tidy -diff`, `go test -count=1 ./...`, and `go vet ./...`
  pass when the Go build cache and installer fixture have the required Windows
  filesystem access.

## Validation Evidence

| Check | Result |
| --- | --- |
| `git rev-parse HEAD` | `a65562055d1dd6e879812f5507558dbc39d18f43` |
| `mirror config check` through the reviewed Go binary | Passed; loaded root `mirror.yaml` |
| `runx check --format json` | Failed, exit 3: no `runx.yaml` |
| `runx list --format json` | Failed, exit 3: no `runx.yaml` |
| `xdocs meta . --documents --strict` | Passed; 37 descriptors |
| `xdocs tree` | Passed |
| `xdocs doctor .` | Passed; 0 errors, 0 warnings |
| `gofmt -l .` | Passed; no files listed |
| `go mod tidy -diff` | Passed; no diff |
| `go test -count=1 ./...` | Passed after rerun with Git `sh` and the filesystem access required by the public-installer fixture |
| `go vet ./...` | Passed |
| Reviewed binary `--version` | Failed convention: printed `mirror vdev` |
| Reviewed binary `--help-tree-depth max` | Failed convention: exit 2 |
| Reviewed binary `--help-tree-depth 1` | Failed convention: accepted, exit 0 |
| Reviewed binary `--help-tree-global-flags` | Failed convention: unknown flag, exit 2 |

The initial sandboxed Go test attempt failed because its POSIX installer fixture
could not create a temporary directory outside the workspace. The exact suite
was rerun with the required filesystem access and passed; the sandbox failure
is not treated as a source defect.

## Unverified And Residual Risk

- No real user installation, upgrade, rollback, or uninstall was executed
  because those operations mutate user-global state and are unnecessary to
  prove the source-level violations.
- No release was built, tagged, pushed, or published during this review.
- ARMv6 and ARMv7 remain cross-build evidence only in the inspected CI. They
  were not executed on matching hardware here.
- macOS installer equivalence, native Windows ARM64 installation, interrupted
  transaction recovery, concurrent instance termination, persistent-data
  preservation, and complete rollback have no current convention-level runtime
  proof.
- Toolchain versions are pinned and current in the reviewed checkout, but the
  historical fact of whether each was the latest available on the original
  project creation date cannot be reconstructed from repository evidence.
- User confirmation of the CLI home name, main skill name, and main prompt ID
  is not durably recorded. The existing `mirror` and `guiho-s-mirror` names are
  plausible, but the convention requires confirmation rather than inference.

## Required Remediation Order

1. Update the repository-level architecture and local contracts to adopt
   Convention 0001, including RunX and full XDocs coverage.
2. Define the canonical CLI home, main skill name, and main prompt ID as
   confirmed decisions.
3. Design the stable launcher, immutable payload layout, `current.json`,
   installed/release `artifacts.json`, ownership boundaries, persistent data,
   and rollback protocol.
4. Define separate project/global configuration types, schemas, examples,
   inheritance, and `agent.evolution` enforcement.
5. Rebuild `init` and the agent artifacts around that configuration and
   lifecycle contract.
6. Replace installers, upgrade, and uninstall with complete manifest-driven
   transactions and add both uninstaller scripts.
7. Correct the version, help-tree, list-flag, and agent-command contracts.
8. Expand build, verification, CI, publication, README, embedded skill, and
   prompts to the complete release set.
9. Validate native install, reinstall, upgrade, rollback, and uninstall paths
   on matching runners/hardware, then rerun Mirror, RunX, XDocs, Go, and release
   gates.

## Final Determination

The repository is healthy relative to much of its previous Go/Cobra contract,
but **it must not be represented as compliant with GUIHO Convention 0001**.
The current architecture predates and directly conflicts with several of the
new convention's central guarantees. Compliance requires a planned migration,
not a small patch or documentation-only correction.
