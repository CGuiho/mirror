---
name: Mirror Publish Channel Acceptance Plan
purpose: Correct the release workflow so stable and prerelease publications are validated against the right GitHub release pointers.
description: Defines the minimal workflow, regression, documentation, release, and public-evidence steps for channel-aware publish acceptance.
created: 2026-07-23
owner: mirror-docs-plans
flags:
  - approved
tags:
  - release
  - ci
  - planning
keywords:
  - tag-pinned installer
  - latest stable
  - prerelease
  - public acceptance
  - Mirror 3.7.4
---

# Mirror Publish Channel Acceptance Plan

## Scope

The Publish workflow currently installs the canonical unpinned public installer
for every tag and compares the installed stable `latest` version with the tag's
expected version. That is valid for a newly published stable release but makes a
correct prerelease fail because GitHub's latest pointer intentionally remains on
the latest stable release.

This correction changes only the public acceptance contract. Release creation,
the exact fourteen assets, version-scoped notes, and the previous-stable
command-upgrade gate remain unchanged.

## Ordered Units

### PA-01 - Channel-aware public acceptance

- Owner: `.github/workflows/publish.yml`
- After the release exists, fetch `devops/install.sh` from the exact release tag
  and execute it with `--version "$expected_version"` for every stable or
  prerelease publication.
- For stable versions only, assert that GitHub's latest release tag equals the
  current tag and separately execute the canonical unpinned `main` installer.
- Skip all latest-pointer assertions and unpinned installation for prereleases.
- Preserve the previous stable installation followed by
  `mirror upgrade --version "$expected_version"` for both channels.
- Acceptance: prereleases cannot fail merely because stable `latest` points
  elsewhere, while stable releases still prove the public latest pointer.

### PA-02 - Regression contract

- Owner: `mirror/source/guiho-mirror.spec.ts`
- Assert that the workflow fetches the installer at `GITHUB_REF_NAME`, passes
  the exact expected version, gates latest checks on stable SemVer, verifies the
  current latest tag, retains the previous-stable exact-current upgrade, and
  has no production environment approval.
- Acceptance: a future workflow regression that moves the unpinned installer
  outside the stable-only block fails the Bun test suite.

### PA-03 - Documentation and validation

- Owners: `mirror/DOCS.md`, `docs/validation/`, and xdocs descriptors.
- Document the three independent gates: exact tag for every channel, latest
  pointer only for stable, and previous stable to exact current.
- Run typecheck, the complete Bun suite, native build, and strict xdocs checks.
- Acceptance: durable documentation and validation evidence match the shipped
  workflow.

### PA-04 - Patch release

- Owner: Mirror-managed versioning and GitHub Actions.
- Add only the 3.7.4 changelog section, run `mirror config check`, inspect
  `mirror version plan patch`, and apply the approved patch release.
- Monitor CI and Publish through the public acceptance gates.
- Verify exactly fourteen assets, version-only release notes, successful
  tag-pinned installation, stable latest installation, and previous-stable
  exact-current upgrade.
- Acceptance: `main` is clean and synchronized, Mirror 3.7.4 is the public
  stable release, and every required workflow is green.

## Stop Conditions

- Stop before release if typecheck, tests, build, xdocs, configuration check, or
  version plan fails.
- Do not weaken the exact-asset or version-scoped-note gates.
- Do not replace the previous-stable command upgrade with installer-only
  acceptance.
