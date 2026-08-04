---
subject: mirror-pkg-versioning
description: Version sources, plans, hook boundaries, outputs, changelog, and Git effects.
parent: mirror-pkg
children: []
files: {versioning.go: "Semantic-version planning and application engine."}
documents: {}
tags: [go, versioning, hooks]
keywords: [package json, jsr, git tags, write hooks, release lifecycle]
flags: []
status: stable
---

Planning is read-only; application performs only explicitly configured effects
and emits typed write, commit, tag, and push hook boundaries.
