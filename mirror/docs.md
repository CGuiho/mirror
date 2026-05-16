# Mirror Documentation

This document is a compact reference for the public Mirror v3 behavior.

## Project Model

Mirror uses a small release model:

- Project: the package, repository, application, or directory being versioned.
- Source: the single adapter Mirror reads the current version from.
- Output: an adapter Mirror writes the next version to.
- Plan: the complete read-only description of intended changes.

The executor is the only library layer that applies file or Git mutations.

## Adapters

`package` reads and writes `package.json`.

`jsr` reads and writes `jsr.json`.

`git` reads semantic versions from Git tags, creates release tags, creates release commits when file outputs changed and commit behavior is enabled, and pushes release refs when push behavior is enabled.

## Operational Flags

Global flags:

```text
--help
-h
--version
-v
--config <path>
--cwd <path>
--format text|json
--no-color
```

Version override flags:

```text
--source package|jsr|git
--output package|jsr|git
--package-file <path>
--jsr-file <path>
--preid <id>
```

Apply-only flags:

```text
--dry-run
--commit
--push
--allow-dirty
--yes
```

`--push` implies commit behavior when file outputs changed.
