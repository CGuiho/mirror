---
name: Mirror Init Git Defaults
purpose: Define the Git-first mirror init behavior requested in GitHub issue 26.
description: Tracks default source/output, release commit/push prompt defaults, regression coverage, and release boundary for issue 26.
created: 2026-08-05
updated: 2026-08-05
owner: mirror-docs-todo
flags: [testing]
tags: [mirror, init, configuration]
keywords: [mirror init, git default, Y/n, issue 26]
---

# Mirror Init Git Defaults

## Todo Index

- Task: `Mirror Init Git Defaults`
- Status: testing
- Index: [TODO.md](../../todo.md)
- External: [CGuiho/mirror#26](https://github.com/CGuiho/mirror/issues/26)

## Plan Unit

- Unit: `INIT-26`
- A separate architecture or implementation-plan document is unnecessary for
  this bounded correction to the existing `mirror init` defaults.
- Authority: GitHub issue 26, `cmd/init.go`, init command tests, README,
  `mirror/DOCS.md`, and the embedded Mirror skill.

## Reproduction

In a repository containing `package.json`, `mirror init` selected
`package.json` as the default version source/output before this task. Issue 26
requires Git to be the default source and output instead. The release commit and
push prompts must remain yes-by-default and render `[Y/n]`.

## Scope

### In scope

- Default `mirror init` to `git` source and `git` output regardless of detected
  `package.json` or `jsr.json` files.
- Preserve explicit `--source package.json` and `--source jsr.json` behavior.
- Preserve `v{version}` as option 1 and default tag template.
- Preserve release commit and release-ref push defaults as `true` with `[Y/n]`
  interactive prompts.
- Update user-facing docs and embedded agent guidance.

### Out of scope

- Changing version planning or apply semantics.
- Changing existing valid `mirror.yaml` files.
- Publishing a stable release.

## Acceptance Signals

- A regression test proves `mirror init` in a directory with `package.json`
  still creates `version.source: git` and `version.output: [git]`.
- Explicit package source flags remain authoritative.
- Init prompts still render `Create release commits? [Y/n]` and
  `Push release refs? [Y/n]`.
- Go formatting, tests, vet, config check, and version planning pass.

## Validation

- Focused init regression tests pass for Git defaults in a `package.json`
  directory and explicit package source overrides.
- Full Go tests, vet, `mirror config check`, generated help docs, and command
  tree validation pass locally.
- XDocs validation is blocked by the repository's existing `xdocs.yaml`
  path-shaped exclusions; the same pre-existing blocker is recorded in prior
  validation evidence and is not changed by this task.

## Lifecycle

- Current phase: testing.
- Mirror decision: apply a `prerelease` bump from the current alpha prerelease
  as requested after committing the fix.
