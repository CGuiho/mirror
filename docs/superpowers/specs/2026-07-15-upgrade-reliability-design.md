---
name: Mirror Upgrade Reliability Design
purpose: Define the approved implementation contract for reliable Mirror self-upgrades, exact-version recovery, and complete release discovery.
description: "Specifies the architecture, output contracts, transactional replacement, rollback, installer hardening, release catalog, tests, ownership, and delivery gates for GitHub issues #9 and #10."
created: 2026-07-15
flags:
  - final
  - decision
  - implementation-ready
tags:
  - cli
  - reliability
  - release
  - versioning
keywords:
  - mirror upgrade
  - mirror upgrade list
  - Windows executable replacement
  - exact-version installer
  - rollback
  - GitHub issue 9
  - GitHub issue 10
owner: mirror-docs-superpowers-specs
---

# Mirror Upgrade Reliability Design

## Summary

Mirror's self-upgrade must be a verified installation transaction, not a
successful download followed by an unobserved replacement attempt. A successful
`mirror upgrade` means the canonical executable path already contains the
resolved target and a fresh process launched from that path reports the target
version. Only deletion of the renamed old executable may continue after the
command exits.

This design also makes the operation observable before and during the long
download, prints an exact-version recovery command after every bare upgrade
attempt, and turns `mirror upgrade list` into a complete paginated catalog of
published stable and prerelease versions.

The design is the implementation contract for:

- [GitHub issue #9](https://github.com/CGuiho/mirror/issues/9), the P0
  replacement, verification, output-order, and catalog defect; and
- [GitHub issue #10](https://github.com/CGuiho/mirror/issues/10), the mandatory
  exact-version recovery instructions.

## Confirmed Failure and Root Cause

Mirror 3.4.1 downloaded the 3.4.2 Windows baseline asset and reported:

```text
Upgrade downloaded. Replacement is scheduled after this mirror process exits.
```

A later `mirror --version` still returned `3.4.1`. Inspection found three
abandoned pairs of `.mirror-upgrade-<pid>-<asset>.exe` and
`.mirror-upgrade-<pid>.ps1` beside `mirror.exe`. No replacement helper remained
running. The download was successful; the canonical executable was never
replaced.

The current implementation in `mirror/source/self-management.ts` creates a
PowerShell script, spawns it with ignored input and output, optionally calls an
untyped `unref()`, and immediately returns `scheduled: true`. It has no helper
startup handshake, retry result, durable error channel, version verification,
or rollback. It also writes successful update-cache state before replacement.

The current `mirror/source/cli.ts` waits for `upgradeSelf()` to finish before
printing the plan, which means the header and selected asset appear only after
the slow download. The current catalog performs one unpaginated GitHub Releases
request and returns only normalized version strings in server order.

The packaged Windows installer has a related reliability defect: one broad
`try`/`catch` covers the HTTP request, binary check, destination replacement,
and completion. A filesystem or verification error is therefore misreported as
an unavailable candidate and silently retried.

## Goals

- Print an immediate upgrade heading and a fully resolved plan before the
  release asset download begins.
- Show `Downloading...`, `Replacing...`, and `Verifying...` in that order while
  the operation runs.
- Replace the canonical executable during the upgrade transaction.
- Verify the downloaded binary before mutation and verify the canonical path
  after mutation.
- Roll back to the original executable on any replacement or canonical
  verification failure.
- Write successful cache state only after canonical verification.
- Print an exact, copy-paste installation command pinned to the resolved target
  after every bare `mirror upgrade` attempt, including success, failure,
  already-current, and dry-run outcomes.
- Provide a separate process-stop command for lock recovery.
- List every published Mirror release, newest semantic version first, with
  stable/prerelease classification and compatible-asset information.
- Keep text and JSON behavior deterministic and testable.

## Non-goals

- This work does not redesign semantic project versioning, `version plan`, or
  `version apply`.
- This work does not redesign `mirror uninstall`; its Windows removal behavior
  remains separate from the upgrade transaction.
- This work does not add a Node.js runtime dependency or a second CLI parser.
- This work does not create a stable launcher/versioned-payload architecture.
  That remains a possible future hardening project, not the urgent repair.
- This work does not introduce mandatory release checksums. Native-format and
  exact-version execution checks are required now; signed checksums may be
  added later without changing the transaction contract.

## Approved Architecture

Self-management is split into resolution, execution, and presentation rather
than returning one opaque result after all work has finished.

```text
CLI command
  -> resolve upgrade plan
  -> emit plan
  -> download and validate candidate
  -> transactionally replace canonical executable
  -> launch canonical executable and verify version
  -> commit cache state
  -> clean old backup now or schedule backup deletion only
  -> emit result and recovery instructions
```

### Module ownership

| Area | Owning path | Responsibility |
| --- | --- | --- |
| Upgrade domain | `mirror/source/self-management.ts` | Release resolution, candidate selection, catalog pagination, artifact validation, swap, rollback, cache commit, and recovery data. |
| CLI orchestration | `mirror/source/cli.ts` | Citty handlers, immediate text events, final text rendering, single-document JSON rendering, and nonzero failure status. |
| Shared contracts | `mirror/source/types.ts` | Upgrade plan, event, result, recovery, and release-catalog types. |
| Runtime primitives | `mirror/source/runtime.ts` | Checked subprocess execution and any narrow filesystem/process primitive shared by upgrade and tests. |
| Windows installer | `mirror/install.ps1` | Exact-version native installation, transactional destination replacement, verification, and rollback on Windows. |
| POSIX installer | `mirror/install.sh` | Exact-version native installation, transactional destination replacement, verification, and rollback on Linux/macOS. |
| Duplicate installer entrypoints | `devops/install.ps1`, `devops/install.sh` | Thin delegation to the canonical `mirror/install.*` contract when used from a checkout; no independent selection or replacement logic. |
| Automated coverage | `mirror/source/guiho-mirror.spec.ts` and `.github/workflows/ci.yml` | Domain, CLI, installer, subprocess, and real Windows executable-swap regressions. |
| Public behavior | `mirror/DOCS.md`, root/package READMEs, help metadata, and XDocs descriptors | Shipped commands, output, recovery, catalog fields, and operational guarantees. |

No generic token parser or manual command router is added. Citty remains the
only ordinary parser and router.

## Upgrade Plan Contract

Resolution happens before the binary body is downloaded. It may fetch release
metadata to identify an existing compatible asset. The selected release
metadata supplies the exact `browser_download_url` that execution will use.

The domain plan has this conceptual shape:

```ts
type MirrorUpgradePlan = {
  currentVersion: string
  targetVersion: string
  targetTag: string
  releaseUrl: string
  platform: 'windows' | 'linux' | 'macos'
  arch: 'x64' | 'arm64'
  variant: 'baseline' | 'default' | 'modern'
  asset: string
  downloadUrl: string
  executablePath: string
  temporaryPath: string
  backupPath: string
  upToDate: boolean
  dryRun: boolean
  recovery: MirrorUpgradeRecovery
}
```

Temporary and backup names are unique, live in the canonical executable's
directory, and never overwrite a previous abandoned artifact. Keeping all swap
paths in one directory guarantees a same-volume rename transaction.

### Target resolution

- `mirror upgrade` resolves the latest published stable GitHub release.
- All ordering and equality checks use the existing `semver` dependency rather
  than a handwritten numeric split. A bare upgrade never downgrades: if the
  installed version is semantically newer than the latest stable release, the
  outcome is `up-to-date` and recovery pins the installed version.
- `mirror upgrade --version <version>` resolves that exact normalized semantic
  version, including its complete prerelease identifier.
- Explicit versions may intentionally install an older release; the output
  still calls the operation an installation from current to target.
- Draft releases are never eligible.
- A prerelease is selected only through an explicit exact version unless a
  future separately specified channel flag opts into prereleases.
- An exact release without a compatible asset fails during planning, before a
  binary download or canonical mutation.
- Candidate preference remains baseline, default, modern for x64 unless
  `--variant` changes the order. Arm64 uses its single platform asset.
- If the latest-release metadata request fails before a target can be resolved,
  recovery pins the installed current version and marks its source as
  `fallback-current`; output must not pretend that a newer target was found.

## Event and State Contract

The operation records ordered lifecycle events. Every event has `sequence`,
`phase`, `status`, and `message`. `sequence` is a one-based integer in emission
order; `message` is a concise human-readable explanation. The common phase
names, in order, are:

1. `plan`
2. `download`
3. `validate`
4. `replace`
5. `verify`
6. `cache`
7. `cleanup`

Each phase status is exactly one of `started`, `succeeded`, `skipped`, or
`failed`. The final outcome is exactly one of:

- `upgraded`
- `up-to-date`
- `dry-run`
- `rolled-back`
- `failed`

`rolled-back` means the target was not installed, canonical mutation began,
and the previous executable was successfully restored and verified. It exits
nonzero. `failed` means the target was not installed and either no rollback was
required or rollback could not complete. It also exits nonzero.

There is no `scheduled` successful replacement state. `cleanupPending: true`
may be returned only after the canonical executable has passed verification and
only when removal of the renamed backup must wait for the old process to exit.
Cache or cleanup failures that occur after canonical verification are recorded
as post-install warnings: final outcome remains `upgraded`, the relevant event
is marked `failed`, and the result states exactly what remains incomplete.

## Human Output Contract

Text output is flushed as each lifecycle boundary begins. The initial heading
is printed immediately, before release resolution. The resolved plan is printed
before the release asset body is requested.

### Successful upgrade

```text
------------------------------------------------------------
  Upgrading the CLI
------------------------------------------------------------
Resolving target...
  current : 3.4.1
  target  : 3.4.2
  os      : windows
  arch    : x64
  binary  : guiho-mirror-windows-x64-baseline.exe
  path    : C:/Users/crist/.local/bin/mirror.exe
  url     : https://github.com/CGuiho/mirror/releases/download/%40guiho%2Fmirror%403.4.2/guiho-mirror-windows-x64-baseline.exe
------------------------------------------------------------
Downloading...
Validating...
Replacing...
Verifying...
Upgrade complete: 3.4.1 -> 3.4.2

If the new version is not active, install Mirror 3.4.2 directly:
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((Invoke-RestMethod 'https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/install.ps1'))) -Version '3.4.2'"

If Mirror is still running and blocks installation, stop it first:
  powershell.exe -NoProfile -Command "Get-Process mirror -ErrorAction SilentlyContinue | Stop-Process -Force"
```

If backup deletion must wait, one factual line may follow the success result:

```text
Cleanup pending: the verified upgrade is active; the old backup will be removed after this process exits.
```

That line never says replacement is scheduled.

### Already current

The heading, plan result, and recovery block remain visible. Download,
validate, replace, verify, cache, and cleanup events are skipped.

```text
Already up to date: 3.4.2

If the current installation needs repair, install Mirror 3.4.2 directly:
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((Invoke-RestMethod 'https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/install.ps1'))) -Version '3.4.2'"
```

### Failure

The command prints the specific failed phase and error, rolls back when any
canonical mutation occurred, prints recovery instructions, and exits nonzero.
It never prints `Upgrade complete` or a successful scheduled message.

```text
Replacing...
Upgrade failed during replacement: access to the canonical executable was denied.
Rollback complete: Mirror 3.4.1 remains active.

Install Mirror 3.4.2 directly:
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((Invoke-RestMethod 'https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/install.ps1'))) -Version '3.4.2'"

If Mirror is still running:
  powershell.exe -NoProfile -Command "Get-Process mirror -ErrorAction SilentlyContinue | Stop-Process -Force"
```

Recovery instructions are not hidden by `--verbose`. A dry run also prints the
resolved plan and pinned recovery instructions but performs no download,
validation, replacement, verification, cache write, or cleanup.

## JSON Contract

`--format json` writes exactly one JSON document to stdout and never mixes a
banner, progress text, cached update notice, or recovery prose into stdout.
Live human progress is a text-mode feature; JSON preserves the same lifecycle
as an ordered `events` array in its final document.

Successful shape:

```json
{
  "schemaVersion": 1,
  "command": "mirror upgrade",
  "outcome": "upgraded",
  "plan": {
    "currentVersion": "3.4.1",
    "targetVersion": "3.4.2",
    "targetTag": "@guiho/mirror@3.4.2",
    "platform": "windows",
    "arch": "x64",
    "variant": "baseline",
    "asset": "guiho-mirror-windows-x64-baseline.exe",
    "downloadUrl": "https://github.com/CGuiho/mirror/releases/download/%40guiho%2Fmirror%403.4.2/guiho-mirror-windows-x64-baseline.exe",
    "executablePath": "C:/Users/crist/.local/bin/mirror.exe",
    "dryRun": false,
    "upToDate": false
  },
  "events": [
    { "sequence": 1, "phase": "plan", "status": "succeeded", "message": "Resolved Mirror 3.4.2 and the compatible Windows x64 baseline asset." },
    { "sequence": 2, "phase": "download", "status": "succeeded", "message": "Downloaded the planned release asset." },
    { "sequence": 3, "phase": "validate", "status": "succeeded", "message": "The temporary executable reports Mirror 3.4.2." },
    { "sequence": 4, "phase": "replace", "status": "succeeded", "message": "Replaced the canonical executable through a same-directory backup." },
    { "sequence": 5, "phase": "verify", "status": "succeeded", "message": "The canonical executable reports Mirror 3.4.2." },
    { "sequence": 6, "phase": "cache", "status": "succeeded", "message": "Committed verified update-cache state." },
    { "sequence": 7, "phase": "cleanup", "status": "succeeded", "message": "Removed the old executable backup." }
  ],
  "result": {
    "installedVersion": "3.4.2",
    "rolledBack": false,
    "cacheUpdated": true,
    "cleanupPending": false,
    "warnings": []
  },
  "recovery": {
    "targetVersion": "3.4.2",
    "targetSource": "resolved",
    "installCommand": "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"& ([scriptblock]::Create((Invoke-RestMethod 'https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/install.ps1'))) -Version '3.4.2'\"",
    "stopProcessCommand": "powershell.exe -NoProfile -Command \"Get-Process mirror -ErrorAction SilentlyContinue | Stop-Process -Force\""
  },
  "error": null
}
```

Failures use the same top-level fields, set `outcome` to `rolled-back` when the
previous canonical executable was restored and verified or `failed` otherwise,
mark the failed event, include rollback state, populate a structured error with
`phase`, `code`, and `message`, and exit nonzero. Expected operational failures
still produce the single JSON document; stderr is reserved for unexpected
diagnostics requested through `--verbose`.

If discovery fails before a complete plan exists, `plan` is `null`, `result`
is `null`, the `plan` event is failed, and recovery uses the installed version
with `targetSource: "fallback-current"`. Text output visibly labels this as a
repair reinstall of the installed version, not as the undiscovered upgrade
target:

```text
Target discovery failed: GitHub Releases returned 503 Service Unavailable.

Repair reinstall for installed Mirror 3.4.1 (upgrade target was not resolved):
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((Invoke-RestMethod 'https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/install.ps1'))) -Version '3.4.1'"

If Mirror is still running:
  powershell.exe -NoProfile -Command "Get-Process mirror -ErrorAction SilentlyContinue | Stop-Process -Force"
```

Partial or invented target metadata is never emitted as a completed plan.

The JSON schema is additive after version 1. Removing or renaming these fields
requires a schema-version change.

## Download Validation

The selected asset is written to the unique same-directory temporary path. A
download is acceptable only when:

1. the HTTP response succeeds for the exact planned URL;
2. the file is nonempty and has the expected platform-native magic;
3. the temporary executable can be launched with `--version` within a bounded
   timeout; and
4. stdout reports exactly the normalized target semantic version.

On POSIX, executable permission is applied before the temporary version check.
Validation failure deletes the temporary file when possible, leaves the
canonical path untouched, records a failed `validate` event, prints recovery,
and exits nonzero.

## Immediate Replacement Transaction

### Windows

The approved Windows transaction is rename-and-swap, not an unobserved helper
replacement:

1. Preflight the canonical executable and unique backup path.
2. Rename the running canonical `mirror.exe` to the backup path.
3. Rename the already validated temporary executable to canonical
   `mirror.exe`.
4. Launch the new canonical path with `--version` and require the exact target.
5. Commit cache state.
6. Attempt to delete the backup. If the running image lock prevents deletion,
   schedule or spawn a helper for backup deletion only.

If step 2 fails because the platform, permissions, filesystem, antivirus, or
sharing mode does not permit renaming the running image, no canonical mutation
has occurred. The command fails nonzero and prints the pinned installer command.
It does not fall back to claiming a scheduled upgrade.

If step 3 fails, rename the backup back to the canonical path before returning.
If step 4 fails, move the invalid canonical binary to a unique failed-artifact
path or delete it, restore the backup to the canonical path, and verify the
restored version. The result reports whether rollback completed.

If rollback itself fails, preserve every recoverable artifact, report their
exact paths, set a distinct rollback-failed error code, print the installer and
process-stop commands, and exit nonzero. Never destroy the only known-good
binary.

### POSIX

POSIX uses the same transaction and result contract. Apply executable mode to
the temporary binary, rename the canonical binary to a backup, rename the
temporary binary to canonical, verify canonical `--version`, roll back on
failure, and delete the backup after success.

### Cleanup helper boundary

A detached helper is permitted only to delete a backup that is no longer the
canonical executable. Helper creation failure does not invalidate a verified
upgrade; it sets `cleanupPending: true`, leaves the backup path in the result,
and permits a later cleanup attempt. Replacement and verification never depend
on that helper.

## Cache Commit Timing

The update cache is commit metadata, not optimistic intent.

- Do not write target-as-current cache state after download alone.
- Do not write it after temporary validation alone.
- Write it only after the canonical executable reports the target version.
- Cache writes are atomic. If cache writing fails after canonical verification,
  the installed upgrade remains valid, final outcome remains `upgraded`, exit
  status remains zero, `cacheUpdated` is false, and the result contains an
  `UPGRADE_CACHE_FAILED` warning. The command must not claim the cache was
  updated.
- A failed atomic cache write preserves the cache state that existed before the
  attempt.
- Already-current and dry-run outcomes do not mutate cache state solely to make
  the command appear successful.

## Recovery Command Contract

Recovery is generated from the same normalized target, platform, architecture,
variant, repository, and canonical installer contract used by planning. It is
data first (`MirrorUpgradeRecovery`) and rendered by text or JSON presentation;
the CLI does not assemble unrelated ad hoc strings in error handlers.

The common recovery shape contains exactly these fields:

```ts
type MirrorUpgradeRecovery = {
  targetVersion: string
  targetSource: 'resolved' | 'fallback-current'
  installCommand: string
  stopProcessCommand: string
}
```

### Windows

For target `3.4.2`, the canonical Windows recovery command below is deliberately
safe to paste from PowerShell, Command Prompt, or Git Bash because it launches
PowerShell itself and contains no caller-shell variable expansion. Generation
substitutes another validated exact semantic version only where `3.4.2`
appears:

```text
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((Invoke-RestMethod 'https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/install.ps1'))) -Version '3.4.2'"
```

The separate stop command is:

```text
powershell.exe -NoProfile -Command "Get-Process mirror -ErrorAction SilentlyContinue | Stop-Process -Force"
```

The installation command is printed first. The output then says to run the stop
command only if a live Mirror process blocks installation, followed by an
instruction to rerun the same pinned install command.

### Linux and macOS

For target `3.4.2`, the canonical POSIX recovery command is:

```text
curl -fsSL https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/install.sh | bash -s -- --version '3.4.2'
```

The separate stop command is:

```text
pkill -x mirror
```

Exact versions are validated semantic versions before interpolation, so stable
and prerelease identifiers remain intact and shell-control characters are
rejected rather than escaped into commands.

Recovery is included after the default `mirror upgrade` action and its flags.
It is not appended to the informational `mirror upgrade check` or
`mirror upgrade list` subcommands.

## Full Release Catalog

`mirror upgrade list` returns the complete set of valid published Mirror GitHub
releases independently of performing an upgrade.

### Retrieval and normalization

- Request `per_page=100` and follow GitHub pagination until no next page exists.
- Exclude drafts.
- Include stable releases and prereleases.
- Normalize only tags matching Mirror's supported tag shape and a valid semantic
  version. Preserve both normalized `version` and original `tag`.
- Record skipped malformed releases as JSON warnings rather than crashing or
  presenting them as installable versions.
- Sort with `semver.rcompare`, newest semantic version first. Use publication
  time only as a deterministic tie-breaker.
- Determine the highest non-prerelease semantic version as `latestStable`.
- Mark the version embedded in the running CLI as `current` when it exists in
  the catalog.
- Derive `channel` as `stable` when no prerelease tuple exists; otherwise use
  the first prerelease identifier, including `alpha`, `beta`, `rc`, or another
  explicit identifier.
- Determine compatible asset availability using the same platform,
  architecture, and variant candidate builder used by upgrade planning.

Conceptual release record:

```ts
type MirrorAvailableRelease = {
  version: string
  tag: string
  channel: string
  prerelease: boolean
  publishedAt: string
  releaseUrl: string
  current: boolean
  latestStable: boolean
  compatible: boolean
  compatibleAsset?: string
}
```

### Text output

Columns are aligned for the returned data and do not truncate the version or
channel label:

```text
AVAILABLE MIRROR VERSIONS

VERSION              CHANNEL   PUBLISHED    MARKERS          ASSET
3.5.0-alpha.0        alpha     2026-07-14                    yes
3.4.2                stable    2026-07-14   latest-stable    yes
3.4.1                stable    2026-07-10   current          yes
```

`ASSET` is `yes`, `no`, or the selected asset name when verbose output is
requested. Empty catalogs print an explicit no-published-releases message and
return success. API failures return nonzero with the GitHub status and do not
present a partial page as a complete catalog.

### JSON output

JSON uses a complete-catalog wrapper. `command` contains the full command,
`latestStableVersion` is explicit, and `complete: true` means every GitHub page
was retrieved successfully. The `releases` array contains the complete ordered
catalog rather than a summary:

```json
{
  "schemaVersion": 1,
  "command": "mirror upgrade list",
  "currentVersion": "3.4.1",
  "latestStableVersion": "3.4.2",
  "complete": true,
  "platform": "windows",
  "arch": "x64",
  "variant": "baseline",
  "pagesFetched": 2,
  "releaseCount": 31,
  "releases": [
    {
      "version": "3.5.0-alpha.0",
      "tag": "@guiho/mirror@3.5.0-alpha.0",
      "channel": "alpha",
      "prerelease": true,
      "publishedAt": "2026-07-14T20:00:00Z",
      "releaseUrl": "https://github.com/CGuiho/mirror/releases/tag/%40guiho%2Fmirror%403.5.0-alpha.0",
      "current": false,
      "latestStable": false,
      "compatible": true,
      "compatibleAsset": "guiho-mirror-windows-x64-baseline.exe"
    }
  ],
  "warnings": []
}
```

Each release contains the same channel, date, marker, compatibility, asset,
tag, and URL information as text output. API failure returns nonzero and no
wrapper with `complete: true`; a partial page set is never labeled complete.

## Installer Reconciliation and Hardening

`mirror/install.ps1` and `mirror/install.sh` are the canonical installer
implementations and recovery-command targets. `devops/install.*` must stop
carrying an independent asset naming and replacement algorithm; when retained,
they delegate to the canonical scripts from a checkout.

Both canonical installers must:

1. accept an explicit exact version while retaining `latest` for ordinary
   first-time installation;
2. normalize and validate stable and prerelease semantic versions;
3. resolve the same candidate order as self-upgrade;
4. print the selected version, platform, architecture, asset, URL, and
   destination before the long download;
5. keep HTTP candidate-not-found handling separate from filesystem,
   permission, replacement, and verification failures;
6. validate the downloaded native format and temporary executable version;
7. replace the destination transactionally through a same-directory backup;
8. execute the installed canonical binary with `--version` and require the
   requested version;
9. restore the backup on replacement or verification failure;
10. exit nonzero with a specific failure and preserved recovery state;
11. remove temporary artifacts and successful backups when possible; and
12. never print `Installed` before canonical version verification.

Tests must execute the exact command templates printed by Mirror. A command is
not accepted merely because it looks syntactically correct.

## Failure Codes and Artifact Policy

Expected operational errors and warnings use stable codes so text, JSON, tests,
and support instructions agree:

- `UPGRADE_RESOLUTION_FAILED`
- `UPGRADE_ASSET_UNAVAILABLE`
- `UPGRADE_DOWNLOAD_FAILED`
- `UPGRADE_DOWNLOAD_INVALID`
- `UPGRADE_TEMP_VERSION_MISMATCH`
- `UPGRADE_RENAME_CURRENT_FAILED`
- `UPGRADE_INSTALL_FAILED`
- `UPGRADE_CANONICAL_VERSION_MISMATCH`
- `UPGRADE_ROLLBACK_FAILED`
- `UPGRADE_CACHE_FAILED` (post-install warning)
- `UPGRADE_CLEANUP_PENDING` (post-install warning)

Temporary downloads are deleted after pre-mutation failures. After a rollback
failure, known-good backups and failed canonical artifacts are preserved and
reported. Successful upgrades may temporarily retain only the renamed old
backup when the running-image lock delays deletion.

## Test Strategy

### Domain unit tests

- Stable, exact, downgrade, and full prerelease target normalization.
- Baseline/default/modern and arm64 asset selection from release metadata.
- Missing compatible asset failure before download.
- Ordered event state for up-to-date, dry-run, success, and every failure phase.
- Temporary native-format and exact-version validation.
- Cache write only after canonical verification.
- Rollback after install rename failure and canonical version mismatch.
- Rollback-failed artifact preservation.
- Recovery generation for Windows, Linux, macOS, stable, prerelease,
  already-current, dry-run, and pre-resolution failure.

### CLI tests

- A local HTTP fixture delays the asset body; the subprocess test proves the
  heading, plan, URL, and `Downloading...` are observable before the body is
  released.
- Text phases appear in the required order and success appears only after
  canonical verification.
- Failure output includes phase, reason, rollback result, pinned installer, and
  separate stop command.
- Recovery is printed after success, failure, already-current, and dry-run.
- JSON success and failure each produce one parseable stdout document with no
  banner or progress prose.
- `-v`/`--version`, Citty routing, and scoped `upgrade --version` remain
  distinct and regression-tested.

### Catalog tests

- More than one GitHub page is exhausted.
- Drafts are excluded and prereleases remain visible.
- Semantic ordering handles stable, alpha, beta, rc, and numeric prerelease
  components correctly.
- Current and latest-stable markers are independent.
- Publication dates, original tags, release URLs, compatible assets, missing
  assets, warnings, and JSON counts are preserved.
- A failed later page does not return an apparently complete partial catalog.

### Installer tests

- Exact stable and exact prerelease installation.
- Candidate fallback only on an unavailable HTTP asset.
- Permission and destination replacement errors are not mislabeled as missing
  assets.
- Installed-version mismatch restores the prior executable.
- The printed Windows and POSIX recovery commands install the requested fixture
  version into an isolated directory.

### Real Windows subprocess test

A `windows-latest` CI job builds two fixture native executables representing an
old and target version, runs the old executable from a temporary canonical path,
performs the upgrade against a local release server, and then launches the
canonical path again. The test passes only when the second launch reports the
target. It also covers rename denial, rollback, stale artifact cleanup, and
backup-cleanup deferral.

Mock-only Windows path tests are insufficient for closing issue #9.

## Implementation Sequence

1. Add typed plan, event, result, recovery, and catalog contracts.
2. Extract release metadata resolution and shared candidate selection.
3. Implement complete catalog pagination and rendering.
4. Add progress-aware upgrade orchestration without changing Citty routing.
5. Implement temporary execution validation and transactional swap/rollback.
6. Move cache mutation after canonical verification.
7. Generate and render recovery data on every bare upgrade outcome.
8. Harden canonical installers and reconcile `devops/install.*` delegation.
9. Add unit, CLI, installer, and real Windows subprocess tests.
10. Update help, package documentation, READMEs, changelog preparation, and
    affected XDocs descriptors.
11. Run the full release gate before choosing and applying a new version.

Each step keeps the repository runnable and must not hand-edit generated
`mirror/bin/`, `library/`, `bundle/`, or `vendor/` output.

## Release and Issue Gates

No implementation issue is closed when source code merely lands. Both issues
remain open until a newly published native binary has passed live installation
validation.

Before release:

- `bun run typecheck` passes from `mirror/`.
- `bun test` passes from `mirror/`.
- `bun run build` and `bun run binary` pass from `mirror/`.
- focused XDocs metadata/doctor/tree validation passes for changed modules.
- Windows CI proves canonical replacement and fresh `--version` behavior.
- installer tests prove exact stable and prerelease recovery commands.
- package documentation describes the behavior that will ship.
- `mirror version plan <target>` is reviewed before any version mutation.

The repository is already at a local `3.5.0-alpha.0` tag. That tag must not be
reused or moved. Release preparation chooses a later semantic version only
after implementation validation; this design intentionally does not preselect
`3.5.0-alpha.1` versus stable `3.5.0`.

After publication:

1. Install or retain a known older Windows binary in an isolated canonical
   path.
2. Run its `mirror upgrade` against the published release and observe the plan
   and live phase output.
3. Run a fresh canonical `mirror --version` and confirm the published target.
4. Run `mirror upgrade list` and confirm the published stable/prerelease record,
   channel, date, markers, and compatible asset.
5. Execute the printed exact-version recovery command in an isolated install
   directory and confirm the requested version.
6. Attach the release and validation evidence to issues #9 and #10.
7. Close both issues only after all preceding checks pass.

## Acceptance Criteria

- A successful Windows upgrade leaves the canonical `mirror.exe` at the target
  version before success is printed.
- A fresh process launched from the canonical path reports the target version.
- Replacement or verification failures roll back or clearly report a
  rollback-failed state without false success.
- Only deletion of a verified old backup may be deferred.
- The heading and resolved plan are visible before the asset download, and the
  required phase messages are flushed in order.
- Cache state never claims an unverified installation.
- Every bare upgrade outcome contains exact-version installation recovery and a
  separate process-stop command in text and structured JSON.
- Canonical installers verify the installed exact version and roll back on
  failure.
- `mirror upgrade list` returns every valid published release across all pages,
  newest semantic version first, with channel, publication date, markers, and
  compatible-asset information.
- Unit, CLI, installer, catalog, and real Windows subprocess tests pass.
- Published-binary validation completes before issues #9 and #10 close.

## Rejected Alternatives

### Keep the existing scheduled replacement and improve its message

Rejected because the helper has already disappeared without replacing the
canonical binary. Better wording cannot turn an unverified background attempt
into a successful upgrade.

### Treat download completion as upgrade completion

Rejected because the installed command remains old. Download success is only a
mid-transaction event.

### Use a detached helper for replacement and verification

Rejected as the primary path because the originating command cannot honestly
claim canonical success without observing the result. A helper is allowed only
for deletion of a noncanonical old backup after verified replacement.

### Print only `latest` recovery commands

Rejected because recovery must reproduce the resolved target exactly, including
prerelease identifiers, and remain stable if a newer release appears later.

### Return GitHub's first releases page as the catalog

Rejected because `upgrade list` promises all available published versions and
must not silently truncate or trust server ordering.

## References

- [Mirror issue #9](https://github.com/CGuiho/mirror/issues/9)
- [Mirror issue #10](https://github.com/CGuiho/mirror/issues/10)
- [Mirror package documentation](../../../mirror/DOCS.md)
- [Mirror source descriptor](../../../mirror/source/source.xdocs.md)
- [Mirror documentation descriptor](../../docs.xdocs.md)
