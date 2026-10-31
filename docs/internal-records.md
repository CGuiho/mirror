---
name: Internal Records
purpose: Point agents to the complete internal lifecycle records of this project, which live in the private GUIHO repository because this repository is public.
description: Where the plans, question ledgers, review handoffs, validation evidence and the completed-task archive of mirror are kept now that they have moved out of the public repository.
created: "2026-10-31"
owner: mirror-docs
flags: []
tags:
  - docs
keywords:
  - internal records
  - private repository
  - lifecycle
---

#### &copy; 2026 [GUIHO](https://guiho.co) as represented by [Cristóvão GUIHO](https://guiho.co/cguiho) All Rights Reserved.

# Internal records

The complete internal lifecycle records for this project — plans, question
ledgers, review handoffs, validation evidence and the completed-task archive —
live in the private GUIHO repository `CGuiho/guiho`, under `docs/projects/mirror/`.

Agents working on this project must read them there; they are not duplicated
here because this repository is public.

| Record | Location in `CGuiho/guiho` |
| --- | --- |
| Implementation plans and worker handoffs | `docs/projects/mirror/plans/` |
| DND question ledgers | `docs/projects/mirror/questions/` |
| Review handoffs and human reviews | `docs/projects/mirror/reviews/` |
| Validation evidence | `docs/projects/mirror/validation/` |
| Completed-task archive | `docs/projects/mirror/todo/done/` |

What remains in this repository is user-facing: the README and changelog, the
design, contract and migration documentation, the task specifications under
`docs/todo/`, and the task mirror [`todo.md`](../todo.md). The task list itself
stays authoritative in the bound GitHub Project; `todo.md` mirrors it.
