---
name: Mirror RFC 0034 CLI Compliance Migration Plan Review
purpose: Verify that the Mirror RFC 0034 migration plan is executable, safely sequenced, and complete.
description: Reviews the breaking TypeBox, YAML, agent, distribution, and release migration against Mirror's self-hosting and version-safety constraints.
created: 2026-07-18
flags:
  - approved
  - ready-for-execution
tags:
  - review
  - plan
  - cli
keywords:
  - mirror
  - RFC 0034
  - mirror.yaml
  - plan readiness
owner: mirror-docs-reviews-plans
---

# Mirror RFC 0034 CLI Compliance Migration Plan Review

## Verdict

Ready for execution.

## Findings

No blocker or high-severity finding remains.

- Medium, resolved: Removing TOML can strand Mirror's own release flow and
  downstream repositories. MR-01 requires a self-hosting strategy and consumer
  inventory; MR-03 performs the package-local conversion; MR-15 creates a
  downstream handoff without expanding this task.
- Medium, resolved: The config plan initially risked hiding a decision about
  agent settings. It now explicitly deletes only automatic mutation/tool
  selection fields while preserving changelog-domain settings in YAML.
- Medium, resolved: Existing agent code has useful multi-file discovery and
  idempotency but the wrong command shape, defaults, markers, and implicit
  automation. MR-08 specifies the full explicit namespace, both skill targets,
  exact instruction rules, prompt catalog, legacy cleanup, and removal of
  ordinary-command agent mutation.
- Medium, resolved: Current assets use both `guiho-mirror-*` and `macos`. MR-11
  through MR-13 define installer behavior, a Node bootstrap at
  `scripts/mirror-bin.mjs`, and the exact fourteen-name set.
- Low, resolved: Release/version/global-install operations remain outside this
  plan's authority.

## Sequencing Risks

The plan correctly performs baseline/self-hosting analysis before TypeBox and
YAML. YAML precedes command/startup work. Explicit agent resources precede
post-upgrade, installer, and release integration. Downstream migration is a
handoff after the package contract is stable.

## Acceptance Criteria Review

Units cover schema, config, core runtime, Citty, startup/cache, help, agent
behavior, output/exit codes, upgrade, installers, npm bootstrap, assets, docs,
consumer handoff, and full verification. Each high-risk mutation has an
isolated test boundary or approval gate.

## TODO Alignment

The root TODO contains a `todo` RFC 0034 task linked to the specification and
plan. Existing upgrade testing work remains separate and is not marked complete.

## First Executable Unit

MR-01: establish baseline evidence, the TOML consumer inventory, and the
self-hosting strategy before deleting configuration support.

## Recommended Next Skill

Use `guiho-s-0023-plan-executor` with `guiho-s-0034-cli-engineer`.

## References

- [Migration plan](../../plans/rfc-0034-cli-compliance-migration.md)
- [Task specification](../../todo/rfc-0034-cli-compliance-migration.md)
- [TODO.md](../../../TODO.md)
