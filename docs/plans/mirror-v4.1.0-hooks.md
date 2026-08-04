---
name: Mirror v4.1.0 Hooks Implementation Plan
purpose: Sequence implementation and pull-request delivery for GitHub issue 24.
description: Executable Go, agent-resource, documentation, test, review, validation, and PR plan for Mirror lifecycle hooks.
created: 2026-08-04
owner: mirror-docs-plans
flags: [approved, executed]
tags: [mirror, hooks, go, plan]
keywords: [typed yaml, hook runner, lifecycle ordering, pull request]
---

# Mirror v4.1.0 Hooks Implementation Plan

## Execution Units

1. Freeze the accepted issue and design contracts, including the two hook
   consumers and exact event support matrix.
2. Replace the generic configuration map with typed definitions, canonical
   events, explicit compatibility aliases, strict validation, and schema tests.
3. Add `pkg/hooks` for platform shell execution, isolated JSON context,
   environment variables, results, cancellation, and primary/secondary errors.
4. Add explicit hook trust to `version apply` and keep plan, current, next,
   config, root bootstrap, and dry-run free of command-hook side effects.
5. Wrap the write batch, commit, tag, and push actions without weakening exact
   plans, Git safety, staging scope, or rollback behavior.
6. Route stage errors inside-out through apply, global error, and unconditional
   finalization hooks.
7. Update embedded Mirror agent resources to consume instruction hooks only at
   agent-observable everything, plan, and apply boundaries.
8. Reconcile README, full CLI docs, technical architecture, accepted design,
   TODO, XDocs descriptors, implementation review, and validation evidence.
9. Run focused tests, full tests, vet, configuration, generated help, strict
   XDocs checks, and diff hygiene; repair every finding.
10. Commit and push the dedicated branch, open a pull request linked to issue
    #24, and inspect hosted checks. Do not apply a version or publish a release.

## Review Notes

- The owner approved the design and invited implementation on 2026-08-04.
- The implementation keeps AI interpretation outside the Go runtime.
- Shell commands remain repository-controlled code and require a distinct trust
  choice from release confirmation.
- Internal post-commit/tag/push failures report partial state; they do not claim
  transactional rollback of irreversible effects.

## Stop Conditions

Stop pull-request delivery on any strict-config mismatch, lifecycle-order
failure, JSON corruption, rollback regression, read-only side effect, agent
boundary violation, full Go/vet failure, or invalid XDocs metadata.
