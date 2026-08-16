---
name: GUIHO Convention 0001 CLI Migration Architecture
purpose: Define the cohesive target architecture that resolves every confirmed Mirror compliance violation.
description: Specifies command, configuration, agent, release, installation, upgrade, uninstall, ownership, recovery, documentation, and validation boundaries for the breaking migration.
created: 2026-08-16
owner: mirror-docs-architecture
flags:
  - proposed
  - breaking-change
tags:
  - mirror
  - architecture
  - cli
  - convention-0001
keywords:
  - stable launcher
  - immutable payload
  - complete release
  - artifacts manifest
  - transactional installation
  - transactional upgrade
  - uninstall ownership
---

# GUIHO Convention 0001 CLI Migration Architecture

## Status and Authority

This is the proposed target architecture for the production Go/Cobra Mirror
CLI. It derives from the accepted GUIHO Convention 0001 authority decision and
the 31 confirmed findings in the compliance review. It deliberately replaces
the repository's older exact-11-asset, direct-payload, and self-replacement
contracts. The archived Bun/TypeScript implementation remains historical
evidence only.

The migration is intentionally breaking by explicit user direction. Preserving
an obsolete installation layout or public verb where it conflicts with the
convention is not a design goal. Compatibility may be provided only when it
does not weaken the new invariant or create a second authority.

The following identities are proposed but require explicit human confirmation
before any unit that publishes or installs them may start:

- CLI home name: `mirror`, yielding `$HOME/.guiho/mirror/`;
- main skill ID: `guiho-s-mirror`;
- main install/setup prompt ID: `guiho-p-mirror`.

## Architectural Goals

1. Make the checked-in convention, generated command tree, strict schemas,
   release manifest, and installed manifest mutually consistent authorities.
2. Install one stable launcher and immutable versioned payloads instead of
   replacing a running executable.
3. Treat installation, reinstallation, upgrade, rollback, repair, and
   uninstallation as complete manifest-driven transactions.
4. Separate project and global configuration, including an explicit and
   enforceable agent-evolution policy.
5. Package and reconcile every required agent, schema, example, launcher, and
   executable artifact as one selected release.
6. Make every supported lifecycle independently testable on native platforms
   without mutating a developer's real CLI home or repositories.

## Non-Goals

- Restoring the Bun/TypeScript CLI or a second argument parser.
- Adding Viper, TOML fallback, parent-directory config discovery, or a second
  schema generator.
- Changing semantic-version domain behavior except where Convention 0001
  requires command, configuration, installation, or release integration.
- Publishing a release, mutating production, or applying a version as part of
  architecture or planning.
- Managing secrets, databases, cloud resources, authentication, or network
  infrastructure. This migration introduces none of those concerns.

## System Boundaries

```text
source command tree + typed config + embedded resources
                    |
                    v
 deterministic release builder -> complete release directory
                    |              (artifacts.json + checksums.txt)
                    v
 installer / upgrade transaction -> immutable version directory
                    |                 + installed-artifacts.json
                    v
 stable launcher -> strict current.json -> active payload
                    |                       (fallback: verified previous)
                    v
 full artifact reconciliation -> skills, prompts, instructions, schemas,
                                examples, config defaults, and owned projections
```

The release manifest is authoritative for what a release contains. The
installed manifest is authoritative for what a particular installation owns.
Neither manifest may claim user-authored files, surrounding `AGENTS.md`
content, shared `$HOME/.guiho/` directories, project data, or paths belonging
to other CLIs.

## Source Ownership

- `main.go` remains a thin executable adapter: it constructs build/system
  dependencies, passes `os.Args[1:]` to `cmd.Run`, maps the result through
  `cmd.ExitCode`, and exits. It contains no token recognition, lifecycle
  branching, lock/recovery, resource mutation, network work, or Cobra command
  registration.
- `cmd/` owns pre-Cobra argument classification, lifecycle routing, the one
  Cobra tree, public flags, hidden
  self-test entrypoint, lifecycle orchestration, help generation, and stable
  exit mapping. Its runtime seam injects stdout/stderr, environment/home
  resolution, notice/worker scheduling, Cobra construction, lock/journal
  inspection, lifecycle handling, clock/process/filesystem operations, and
  test event recording; production roots cannot be widened through a public
  test flag or environment variable.
- `pkg/config` owns strict project/global types, schema generation, validation,
  path resolution, policy inheritance, and redacted config reporting.
- `pkg/maintenance` owns embedded-resource validation, atomic skill projections,
  and bounded managed-instruction reconciliation.
- `pkg/release` owns target matrices, artifact IDs, the release manifest,
  checksums, deterministic builds, and exact-set verification.
- `pkg/installstate` owns canonical paths, installed manifests, activation
  pointers, journals, locks, and persistent/disposable classification.
- `pkg/installer` owns one injected install/repair/upgrade/rollback/projection/
  uninstall transaction engine used by normal payload lifecycle commands and a
  hidden non-public payload lifecycle entrypoint.
- `pkg/processes` owns registered-instance identity and bounded termination.
- `internal/launcher` owns launcher protocol behavior without Cobra.
- `embed/` owns the canonical skill, instruction, and main prompt sources that
  are packaged and also compiled into the payload for self-test/recovery.
- `devops/launcher` owns the small target-native launcher entrypoint. `devops/`
  also owns standalone POSIX/PowerShell installer and uninstaller scripts plus
  build/verification tools. The verified staged payload exposes a hidden
  non-public lifecycle entrypoint; no public Cobra `install` command exists.

No component may infer release completeness from hard-coded filenames outside
`pkg/release`, and no lifecycle operation may infer installed ownership from a
name glob.

The release catalog, exact/channel selection, compatibility, and complete-asset
filtering model, golden test vectors, and Go implementation also belong in
`pkg/release`. Bash and PowerShell own phase-zero adapters that implement that
normative model before a payload is available, with parity proved against the
same golden catalog fixtures. `pkg/update` retains only the local cached notice
and bounded nonmutating background check.

## CLI Contract

### Root and help

- `mirror --version` and `mirror -v` print raw SemVer only, followed by a
  newline. Development builds must carry a valid injected SemVer or fail the
  contract build/self-test; display decoration belongs in `mirror version`.
- Every command exposes `--help`, `--help-tree`, `--help-tree-depth`,
  `--help-tree-global-flags`, and `--help-docs` through persistent flags.
- `--help-tree-depth` accepts integer values greater than 1 or the literal
  `max`; the default is `max`.
- Inherited global flags are omitted from help-tree nodes unless
  `--help-tree-global-flags` is supplied.
- Repeated list flags use Cobra/pflag `StringArray` semantics. A comma is data,
  not a separator.
- The exact nested agent tree is `agent skill install|uninstall|upgrade|list|show`,
  `agent instruction apply|remove|upgrade|show`, and
  `agent prompt list|show`. Obsolete `update` spellings and aliases are removed
  and rejected; they do not appear in public or hidden agent trees.

### Initialization

`mirror init` performs one idempotent common sequence:

1. resolve and create only canonical shared/CLI directories;
2. create or validate the strict global configuration;
3. create or validate the strict project configuration at the explicit/current
   repository root only;
4. reconcile the complete installed agent-resource set;
5. reconcile the bounded managed instruction block without replacing
   surrounding content;
6. report absolute project/global config paths and the effective evolution
   policy;
7. run config/self checks and return the stable exit code.

Interactive selections and explicit flags remain authoritative where the
Mirror-specific semantic-version initializer requires them. Schema
associations use immutable, version-pinned release URLs, never a mutable
`raw/main` URL.

When evolution choices are required, init explains `disabled`, `always-ask`,
and `always-proceed`, recommends `always-proceed`, offers it for all four
governed fields, and if declined asks separately about upgrades, bugs,
improvements, and reviews. Existing valid values are preserved; skipped answers
remain `always-ask`; missing required noninteractive answers fail clearly.

### Argument-free behavior

Plain argument-free `mirror` preserves its existing bounded exception. It
resolves the active installed manifest, reconciles only the manifest-declared
global skill projections and current repository's bounded instruction block,
then prints the banner. It does not ask configuration questions, replace the
launcher/payload, perform install/upgrade/version/release effects, or substitute
for full `mirror init`. It uses the same maintenance engine as explicit agent
commands; there is no second resource implementation. It never recovers an
incomplete lifecycle transaction. If pending recovery makes the active
manifest/pointer unsafe, it fails closed before reconciliation and prints the
exact recovery command. Argument-free execution, raw version, help/docs/tree,
and self-test suppress background notices/workers; the exact-output routes also
bypass bootstrap and recovery entirely.

## Configuration Architecture

### Files and path rules

- Project config: `<explicit-or-current-repository>/mirror.yaml`.
- Global config: `$HOME/.guiho/mirror/mirror.global.yaml`.
- `--config` selects only the project file; it never redirects the global
  file. There is no parent search or TOML fallback.
- Both files are single-document YAML, decoded into different Go structs with
  `yaml.Decoder.KnownFields(true)`, then semantically validated.
- Commands that consume configuration report both resolved absolute paths in
  verbose/diagnostic output without exposing secrets.

### Ownership and inheritance

Project configuration owns semantic-version sources, outputs, Git/release
settings, hooks, and optional repository-specific evolution overrides. Global
configuration owns user-wide Mirror agent-evolution defaults and future
user-scoped lifecycle preferences explicitly admitted by its schema.

Inheritance is field-by-field and deterministic:

```text
compiled safe default (always ask)
  <- global agent.evolution fields
  <- project agent.evolution fields
  <- explicit invocation choice, when the command permits one
```

Missing values inherit; an explicit value replaces only its field. Unknown
fields, invalid enum values, ambiguous combinations, and extra YAML documents
fail with configuration exit code 3.

The evolution model contains `agent.evolution.upgrade` and independent
`agent.evolution.issues.bugs|improvements|reviews` fields. Every field accepts
exactly `disabled`, `always-ask`, or `always-proceed`; the safe default is
`always-ask`. The CLI exposes the effective values and per-field provenance in
machine-readable form. The main skill enforces them at the AI-agent operating
boundary; a direct human invocation remains authoritative, and the CLI must not
pretend it can infer whether its caller is an agent.

### Schemas and examples

- `mirror.schema.json` is generated from the project Go type.
- `mirror.global.schema.json` is generated from the global Go type.
- `mirror.example.yaml` and `mirror.global.example.yaml` are deterministic,
  validated fixtures, not hand-maintained approximations.
- Generated schemas are closed, versioned release artifacts. Tests compare
  generated bytes to committed/released bytes and load both example files.
- `init` writes version-pinned schema associations using the selected binary's
  exact SemVer and the canonical release artifact URL.

## Agent Artifact Architecture

The complete set contains one main skill ZIP, one managed instruction prompt,
and one main install/setup prompt. Their IDs and contained paths are declared
in `artifacts.json`.

The main skill must document:

- configuration discovery and strict validation;
- install, upgrade, rollback, repair, and uninstall recovery;
- `agent.evolution` resolution and enforcement;
- the CLI Evolution and Feedback workflow;
- safe use of semantic-version plan/apply commands and existing hook trust
  boundaries.

The main prompt bootstraps or repairs the CLI through the documented remote
installer, runs `mirror init`, verifies raw `mirror --version`, and explains
recovery without assuming an existing working payload. The instruction prompt
defines the bounded `AGENTS.md` block. Reconciliation writes only declared
owned files and exact managed-marker bodies; it never replaces an entire
user-authored instruction file.

`mirror agent skill` acts on one declared skill ID, `agent instruction` acts on
the one managed instruction, and `agent prompt` is read-only inspection.
Same-version skill/instruction upgrade is a repair: it verifies and restores
missing or drifted owned projections.

## Complete Release Contract

The canonical release is manifest-derived. With the accepted eight-target
matrix and proposed identities, the current architecture expects 25 assets:

- 8 statically linked application payloads:
  `mirror-<goos>-<arch>[.exe]` using the existing exact target matrix;
- 8 stable launchers:
  `mirror-launcher-<goos>-<arch>[.exe]` for the same target matrix;
- `guiho-s-mirror.zip`;
- `guiho-i-mirror.md`;
- `guiho-p-mirror.md`;
- `mirror.schema.json` and `mirror.global.schema.json`;
- `mirror.example.yaml` and `mirror.global.example.yaml`;
- `artifacts.json`;
- `checksums.txt`.

The count is a consequence of the manifest, never an independently hard-coded
policy. A changed declared artifact set changes the count and all exact-set
tests together.

`artifacts.json` declares digests for every payload, launcher, resource, schema,
and example, but declares neither its own digest nor a digest for
`checksums.txt`. `checksums.txt` covers `artifacts.json` and every other asset
except itself. The manifest declares, for every managed artifact: stable ID,
release version, digest, size,
platform applicability, canonical installed relative path, projection paths,
persistence/replacement mode, executable mode, contained resource identity,
and retirement behavior. Its schema/version is explicit and strictly decoded.
The manifest cannot contain absolute paths, traversal, duplicate IDs/paths, or
claims outside the CLI/shared ownership boundaries.

The manifest explicitly declares an empty agent-definition set unless Mirror
actually introduces an agent definition; absence is data, not an omitted
category. `installed-artifacts.json` records the selected `artifacts.json`
digest so later repair/uninstall can bind ownership to the exact release
manifest.

Release verification rejects missing, extra, duplicate, unsorted, malformed,
wrong-target, wrong-format, wrongly checksummed, or semantically inconsistent
assets. ARMv6/ARMv7 are labeled build-only unless validation runs on matching
hardware; no cross-build is represented as native execution.

## Canonical Installed Layout

```text
$HOME/.guiho/
  bin/
    mirror[.exe]                         stable launcher
  .temp/
    mirror-install-<uuid>/               disposable, operation-owned
    mirror-upgrade-<uuid>/               disposable, operation-owned
    mirror-uninstall-<uuid>/             disposable, operation-owned
  mirror/
    mirror.global.yaml                   persistent user configuration
    current.json                         atomic active/previous relative pointers
    installed-artifacts.json             ownership and installed digests
    versions/<semver>/
      mirror[.exe]                       immutable platform payload
      artifacts/...                      immutable canonical release resources
    state/                               transaction journals and instance registry
    cache/                               disposable catalog/download cache
    data/                                persistent CLI data, if later introduced
```

The launcher path is the only PATH entry. Installer flags may redirect a
fixture root for tests, but public installation does not support arbitrary
production binary directories that violate the shared layout.

`current.json` contains schema version plus relative active and optional
previous version paths/digests. It is strictly decoded, path-confined, written
through an fsync/flush-and-atomic-rename protocol appropriate to the platform,
and never points outside the Mirror home.

## Stable Launcher Protocol

The launcher is small, dependency-free, and lifecycle-stable. It:

1. finds the canonical Mirror home;
2. strictly reads and validates `current.json`;
3. verifies the active payload identity/digest using trusted installed state;
4. forwards arguments, stdin, stdout, stderr, working directory, and relevant
   environment unchanged;
5. waits for the payload and returns its exact exit code;
6. falls back once to the verified previous payload only when the active target
   is missing, fails integrity, or cannot start; and
7. reports bounded recovery guidance when neither target is startable.

Application payload failures after a successful start are returned unchanged;
they do not trigger fallback. Launcher changes are installer-driven, backward
compatible with supported pointer schemas, and validated before installation.
Ordinary payload upgrades never overwrite the running launcher.

The staged selected payload exposes a hidden, versioned, non-public lifecycle
protocol dispatcher such as `__lifecycle`, backed by `pkg/installer`. It is
intercepted before ordinary Cobra dispatch and is not registered in the public
Cobra tree. It requires a unique operation token and confined staging
authority, and remains absent from help, docs, trees, suggestions, and command
discovery. Installer/uninstaller scripts invoke it
only after they download and verify the complete platform-applicable staged
release, including the checksum graph, strict manifest, selected payload and
launcher, and all target-neutral artifacts. The hidden entrypoint has no
network, catalog-selection, or download responsibility; it revalidates staged
state and executes the offline transaction. This prevents three shell-specific
ownership implementations without adding another binary family or a public
`install` command.

## Shared Transaction Model

Install, reinstall, upgrade, repair, and uninstall use the same state machine:

```text
prepared -> downloaded -> verified -> snapshotted -> installed
         -> projected -> activated -> post-verified -> committed
                                      \-> rolling-back -> rolled-back
```

Each journal phase is durable and idempotently recoverable. Standalone script
phase-zero selection/download may occur before a payload can acquire the lock.
After the staged payload acquires it, its first action is recovery of an
incomplete prior transaction, before installed-state mutation; it then
revalidates all staged state because another operation may have completed
during phase zero. `mirror upgrade`, already executing inside the payload,
acquires the lock and recovers before its own network work. Locks contain an unpredictable
ownership token, PID, process-start identity where available, operation, and
timestamp; stale takeover requires proving the recorded owner is no longer
active, not merely waiting for an age threshold.

All temporary directories are unique strict descendants of
`$HOME/.guiho/.temp/`. Cleanup resolves and verifies the path before recursive
removal and never targets the shared temp root.

Persistent paths are never removed by upgrade/reinstall and are removed by
uninstall only under its explicit preservation policy. Every replaceable
projection is snapshotted before mutation. Failure after snapshot restores the
complete previous installed state, including pointer, projections, manifest,
and PATH edit where applicable.

## Installer and Reinstaller

`devops/install.sh` and `devops/install.ps1` are standalone, non-root entry
scripts. They support exact SemVer and stable/prerelease channel selection,
exhaust the canonical release catalog pagination, reject drafts/malformed or
incomplete releases, print the resolved version and destinations before
mutation, and download the complete platform-applicable staged set: selected
payload/launcher plus every target-neutral ordinary artifact.

Phase zero validates that the manifest, release-catalog asset names, and
checksum filenames describe the complete 25-asset release. It hashes and
verifies every byte it actually downloads; foreign-target bytes are verified by
the release verifier/CI, not falsely claimed as installer-verified.

They verify checksums, manifest semantics, native payload/launcher format and
target, raw payload version, launcher compatibility, embedded resources, and hidden
`__self-test` before activation. They then install the immutable version,
reconcile all manifest projections, atomically activate it, verify raw version
and self-test through the stable launcher, and only then commit/clean backups.

Same-version install is a complete repair. Retired manifest-owned disposable
artifacts are removed; user-authored/persistent paths remain. User PATH is
updated idempotently for `$HOME/.guiho/bin` using the platform's user-level
mechanism. Reruns cannot duplicate entries. After a successful binary
transaction, the installer prints that the managing agent must run
`mirror init` and then verify raw `mirror --version`. The streamed installer
does not attempt interactive init or make installation success depend on setup
questions.

The PATH addition is part of the snapshotted transaction before final
activation. A failed installation may roll back only its own uncommitted PATH
addition. Cleanup and commit occur only after launcher, payload, resources,
projections, PATH, raw version, and self-test all verify.

## Upgrade

Every `mirror upgrade` invocation first completes local-only argument, target/
channel, platform, and recovery-template validation while suppressing update
notices/workers. It then prints the platform-specific two-line remote reinstall
recovery block as its first operational output, before network, lock, recovery,
process, or filesystem work, and again as its final output block. Once the
target is resolved, the final block is pinned to that exact version. Dry-run and
all failure paths obey the same output rule.

Upgrade supports exact version and channel selection, exhausts the release
catalog, and requires a complete release. After the first recovery block it
acquires the process-owned lock, recovers prior journals, and only then begins
catalog/network work. It stages and verifies all assets, snapshots projections,
installs the immutable target, reconciles resources, and atomically updates
`current.json`. It then invokes raw version and hidden self-test through the
stable launcher in the same original command invocation. Dry-run acquires and
inspects the lock but never recovers or mutates; a pending journal makes it fail
closed before network, while a clean state may resolve the catalog to render the
complete plan.

The payload registers each running Mirror instance with PID, process-start
identity, executable path, and installation identity. Before activation,
upgrade may terminate only other verified instances executing the previous
owned payload, never the current upgrader, launcher, child processes, or a PID
whose identity/path no longer matches. Timeouts and refusal are explicit
failures with full rollback. There is no detached Windows completion helper,
`scheduled` result, next-run completion, or live payload overwrite.

## Uninstall

The Cobra command and both standalone scripts share one manifest-driven plan
and semantics:

- destructive default removes all manifest-owned CLI artifacts, CLI home
  state/cache/data/config, installed versions, stable launcher, managed
  projections, and project `mirror.yaml` only when the selected scope and
  ownership proof permit it;
- `--preserve-config`, `--preserve-data`, `--dry-run`, and `--yes` have the
  convention-defined meanings;
- dry run and confirmation display exact grouped `REMOVE` and `PRESERVE`
  targets;
- an interactive terminal requires explicit confirmation unless `--yes`;
- a noninteractive destructive invocation without `--yes` fails before
  mutation;
- shared `$HOME/.guiho/` directories, the shared `.guiho/bin` PATH entry,
  unrelated PATH entries, entire
  `AGENTS.md` files, and other CLIs' resources are always preserved.

The individually unconditional shared preservation targets are
`$HOME/.guiho/`, `$HOME/.guiho/bin/`, `$HOME/.guiho/.temp/`, and the user's
shared `$HOME/.guiho/bin/` PATH entry.

Project configuration scope is the explicitly resolved current project only;
uninstall never searches parents, siblings, or unrelated repositories. A
missing, corrupt, incompatible, or path-unsafe installed ownership manifest
fails closed before destructive mutation and prints repair/recovery guidance.

Self-removal is successful only after the launcher, payload, and all selected
owned artifacts are actually gone. Windows requires a proved native deletion
mechanism or a narrowly scoped installer/uninstaller finalizer whose lifecycle
and completion are synchronous from the caller's perspective. A deferred
"scheduled success" is forbidden. This native feasibility proof is an early
implementation gate, not an assumption.

## Safety, Errors, and Observability

- Stable exits remain 0 success, 1 general, 2 usage, 3 configuration,
  4 network, 5 integrity, and 130 interruption.
- Network responses are bounded by total/inactivity timeouts and size limits.
- Every downloaded object is untrusted until checksum and manifest validation.
- Archive extraction rejects traversal, links, duplicate paths, and unexpected
  files.
- Lifecycle output identifies phase, selected exact version/channel, resolved
  owned paths, and recovery action without leaking environment values.
- Interruptions enter rollback where safe and return 130 after durable state is
  recovered or an exact recovery command is printed.
- Background version checks remain nonblocking and cache-bounded, but never
  mutate installation state or agent resources. They do not start on raw-output,
  argument-free, reserved lifecycle, upgrade, or pre-recovery routes.

## Documentation and Tooling

- Add a root `runx.yaml` that catalogs every development, validation, build,
  installer, upgrade, uninstall, XDocs, and release-verification workflow.
- XDocs must discover tracked project-owned `.github/` and `.vscode/` content
  and the complete root module graph; exclusions are directory names only and
  limited to generated/vendor content.
- `README.md`, `mirror/DOCS.md`, `TECHNICAL.md`, the Go RFC, AGENTS contract,
  embedded resources, schemas/examples, help output, workflows, plans, TODOs,
  reviews, and validation evidence must describe one current architecture.
- README ends with the operational `## Uninstall` section and includes raw
  version verification immediately after install examples.

## Validation Architecture

Tests use a fully redirected fixture home, shared root, temp root, repository,
release server, and process registry. They never touch the developer's real
installation or global agents.

Required layers:

1. unit tests for strict config/manifest/pointer decoding, inheritance, path
   confinement, help/list flags, exit codes, lock ownership, journal recovery,
   and uninstall classification;
2. package integration tests for deterministic release assembly, complete-set
   verification, install/reinstall/repair, activation/fallback, rollback,
   retired artifacts, evolution enforcement, and exact recovery output;
3. standalone POSIX and PowerShell script tests, including streamed entrypoints
   and twice-run repair;
4. native Linux, macOS, Windows AMD64, and available ARM64 launcher/lifecycle
   smoke tests; ARMv6/v7 are explicitly build-only without matching hardware;
5. interruption, concurrent instance, stale-lock/PID-reuse, corrupted pointer,
   incomplete release, checksum failure, projection failure, PATH idempotency,
   and Windows self-uninstall scenarios;
6. Go format, tidy, tests, race-sensitive/concurrency tests where applicable,
   vet, static target builds, config checks, live help generation, RunX checks,
   strict XDocs, exact release verification, and workflow-level acceptance.

## Rollout and Compatibility

The work lands through ordered, independently reviewed pull requests. Source
contracts and test harnesses precede lifecycle mutations; release-manifest and
launcher foundations precede installers/upgrades/uninstall. Each unit keeps
the repository buildable and states whether temporary dual-reading is allowed.

The final integrated state requires one explicitly authorized release.
The first convention-compliant installer detects and reports an older direct
`$HOME/.local/bin/mirror` installation and PATH shadowing, but it never deletes
or mutates that out-of-bound path. After verifying the canonical launcher, the
migration guide gives the user an explicit manual cleanup command. Existing
binaries retain their printed exact-version remote reinstall path; no already-
published binary can be retrofitted.

## Open Approval Gates

1. Confirm the three proposed CLI/skill/prompt identities.
2. Approve the architecture and the intentional breaking replacement of the
   obsolete 11-asset/direct-self-replacement contracts.
3. Before C0001-00 execution, either update the canonical Go CLI skill/contract
   or accept the scoped precedence exception defined below.
4. Before dependent lifecycle units, accept native Windows launcher activation,
   synchronous self-uninstall, and process-identity/termination evidence.
5. Before final compliance/release readiness, accept native macOS launcher,
   process, install, upgrade, rollback, and uninstall evidence.
6. Before release work, separately authorize a Mirror version decision,
   version application, tag, push, publication, and public recovery testing.

### Temporary shared-skill precedence exception

If the canonical Superiority Go CLI skill is not updated before C0001-00, only
the human may accept this exception: owner `guiho-a-0001-swe`; scope Mirror
units C0001-00 through C0001-09; authority Convention 0001 plus the accepted
Mirror authority decision; no reuse by another CLI/task; expiry at the earlier
of the canonical skill update or C0001-09 final release-readiness start; closure
evidence is the updated skill path/version or digest recorded in the parent
coordination TODO and final Mirror validation.

## Traceability

The implementation plan maps every audit finding `CLI-001` through `CLI-031`
to an owned execution unit and acceptance test. The architecture review records
whether this design is sufficient to begin planning; it does not authorize
implementation or release.
