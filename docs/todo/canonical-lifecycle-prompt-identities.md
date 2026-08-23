---
name: Canonical Mirror Lifecycle Prompt Identities
purpose: Track correction of Mirror install and uninstall prompt identities under GUIHO Agent Artifacts Convention 0002.
description: Defines the confirmed prompt IDs, coordinated source and embedded-resource changes, validation, delivery, and local uninstall boundary.
created: 2026-08-23
owner: mirror-docs-todo
flags: []
tags: [mirror, prompts, convention-0002]
keywords: [guiho-p-mirror-install, guiho-p-mirror-uninstall, agent artifacts, uninstall]
---

# Canonical Mirror Lifecycle Prompt Identities

## Status

Testing.

## Confirmed Decision

The human explicitly confirmed these prompt IDs:

- `guiho-p-mirror-install`;
- `guiho-p-mirror-uninstall`.

The filename stem and YAML frontmatter `name` must exactly match each ID. Both
artifacts require a SemVer-compatible `metadata.version` and must be available
through `mirror agent prompt list|show`.

## Scope

- Rename the two repository prompt files and their frontmatter identities.
- Embed the canonical prompt files and expose only prompt-type IDs through the
  prompt command tree.
- Update README, XDocs descriptors, CI assertions, accepted identity decision,
  architecture, and plan references.
- Validate formatting, tests, vet, prompt output, strict XDocs metadata, tree,
  and doctor checks.
- Commit and push the validated correction.
- Follow `guiho-p-mirror-uninstall` to remove the locally installed Mirror CLI
  without deleting shared `.guiho` infrastructure or another CLI's artifacts.

## Plan

A dedicated multi-unit plan is unnecessary. The two conventions and the
human-confirmed IDs completely define this bounded identity correction; the
work is one coordinated compatibility unit.

## Validation Evidence

Pending.
