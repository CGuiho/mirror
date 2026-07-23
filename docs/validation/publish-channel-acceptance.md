---
name: Mirror Publish Channel Acceptance Validation
purpose: Record local and public evidence that Mirror publications use channel-correct installer acceptance.
description: Verifies exact tag installation for every release, stable-only latest validation, previous-stable exact-current upgrade, release assets, notes, CI, and repository state for Mirror 3.7.4.
created: 2026-07-23
owner: mirror-docs-validation
flags:
  - validated
tags:
  - mirror
  - release
  - validation
keywords:
  - Mirror 3.7.4
  - tag-pinned installer
  - latest stable
  - prerelease
  - GitHub Actions
---

# Mirror Publish Channel Acceptance Validation

## Summary

Mirror 3.7.4 corrects the publication acceptance contract without weakening the
existing release gates. The public stable release proved all three independent
paths:

1. the installer script fetched from the exact `@guiho/mirror@3.7.4` tag
   installed exact version 3.7.4;
2. GitHub's stable latest pointer named the same tag and the canonical unpinned
   installer installed 3.7.4;
3. public Mirror 3.7.3 upgraded itself to exact 3.7.4.

The workflow regression also requires prereleases to execute the first and third
paths while skipping the stable latest-pointer and unpinned-installer block.

## Local Results

| Check | Result |
| --- | --- |
| `bun run typecheck` | passed |
| `bun test` | passed; 57 tests, 0 failures, 335 assertions |
| `bun run build` | passed; 12 native and 14 total release assets |
| Workflow YAML parse | passed through `Bun.YAML.parse` |
| `xdocs meta docs/plans --documents --strict` | passed |
| `xdocs meta mirror --strict` | passed; seven descriptors |
| `xdocs tree` | passed; parent/child tree valid |
| `xdocs doctor docs/plans` | passed; 0 errors and 0 warnings |
| `xdocs doctor mirror/source` | passed; 0 errors and 0 warnings |
| `mirror config check --format json` | passed with `"ok"` |
| `mirror version plan patch --format json` | passed; planned 3.7.3 to 3.7.4 |

The broader `xdocs meta mirror --documents --strict` scan remains outside this
change's touched scope because the pre-existing `mirror/LICENSE.md` companion
has no YAML frontmatter. All changed descriptors and documents passed strict
metadata validation.

## Workflow Regression Contract

`mirror/source/guiho-mirror.spec.ts` now fails if the Publish workflow stops
doing any of the following:

- fetches `devops/install.sh` at `GITHUB_REF_NAME`;
- invokes that script with `--version "$expected_version"`;
- contains a stable-only latest block;
- checks the latest release tag against `GITHUB_REF_NAME`;
- keeps the unpinned `main` installer inside that stable-only block;
- selects the previous release from stable, non-draft releases;
- upgrades the previous stable binary with exact `"$expected_version"`.

The Publish run executed the regression with 57 passing tests and 320
assertions on Ubuntu.

## Public Release Evidence

| Evidence | Result |
| --- | --- |
| CI | [run 30046816517](https://github.com/CGuiho/mirror/actions/runs/30046816517), passed on Ubuntu and Windows |
| Publish | [run 30046818735](https://github.com/CGuiho/mirror/actions/runs/30046818735), passed |
| Release | [Mirror 3.7.4](https://github.com/CGuiho/mirror/releases/tag/%40guiho/mirror%403.7.4), stable and latest |
| Assets | exactly 14 unique RFC 0034 assets, including both `.md` agent assets |
| Notes | exactly the 3.7.4 changelog section |
| Exact tagged installer | resolved and verified Mirror 3.7.4 |
| Stable latest installer | latest pointer resolved and verified Mirror 3.7.4 |
| Previous stable installer | resolved and verified Mirror 3.7.3 |
| Public command upgrade | `Upgrade complete: 3.7.3 -> 3.7.4` |
| Public progress | reached `100.0% (89.5 MiB/89.5 MiB)` |
| Schema | exact-tag, latest, and upgraded installations persisted the global schema |

The repository's existing protected `production` environment was preserved.
Its deployment review was approved for this release before the Publish job ran.

## Prerelease Readiness

The 3.7.4 release is stable, so its public run intentionally exercised the
stable-only block. Prerelease behavior is guarded structurally by the Bun
workflow regression: a version containing `-` bypasses that block, while the
tag-pinned exact install and previous-stable exact-current command upgrade
remain outside it. This removes the former false comparison between a
prerelease expected version and GitHub's stable latest pointer.

## Readiness

Mirror 3.7.4 is accepted. Local validation, Ubuntu CI, Windows running-binary
replacement, release publication, exact assets, scoped notes, exact tagged
installation, stable latest installation, and public 3.7.3-to-3.7.4 command
upgrade are green.
