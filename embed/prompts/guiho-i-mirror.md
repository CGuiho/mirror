---
name: guiho-i-mirror
description: Mirror agent instruction block.
purpose: Provide the canonical managed project instruction for Mirror versioning.
created: 2026-07-18
owner: mirror-embed-prompts
flags: []
tags: [mirror, instruction, agents]
keywords: [version plan, version apply]
---

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
