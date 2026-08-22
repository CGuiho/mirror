---
name: Remove Legacy TypeScript Implementation
purpose: Delete the archived Bun/TypeScript Mirror implementation now that Go/Cobra is the production authority.
description: Remove all TypeScript code and its build/publish scaffolding from the repository.
created: 2026-08-16
owner: mirror
flags: []
tags: [mirror, cleanup, typescript]
keywords: [legacy removal, bun, typescript]
---

Copyright (c) 2026 GUIHO Technologies as represented by Cristovao GUIHO
All Rights Reserved.

# Remove Legacy TypeScript Implementation

## Status

completed (`2026-08-16`)

## Scope

Delete every TypeScript file and TypeScript-only build/publish artifact:

- `mirror/source/**` (28 tracked `.ts` files, including specs)
- `mirror/tsconfig.json`, `mirror/tsconfig.build.json`
- `mirror/package.json`, `mirror/bun.lock`
- `mirror/jsr.json`, `mirror/.npmignore`, `mirror/.npmrc`
- `devops/compile.sh` (legacy Bun compile of `source/guiho-mirror-bin.ts`)
- Untracked generated/tooling directories on disk: `mirror/library/`,
  `mirror/.temp/`, `mirror/node_modules/`, `mirror/bin/`

Explicitly preserved:

- `mirror/schema/mirror.schema.json` (referenced by
  `pkg/config/config_test.go` and the `cmd/init.go` schema URL)
- `mirror/skills/`, `mirror/prompts/`, `mirror/install.sh`,
  `mirror/install.ps1`, `mirror/mirror.yaml`, `mirror/README.md`,
  `mirror/DOCS.md`, `mirror/LICENSE.md` (non-TypeScript; docs may remain as
  historical evidence)
- All historical review/validation documents mentioning `mirror/source`

## Rationale

The production Mirror CLI is the Go module at the repository root. The legacy
`mirror/` Bun package was demoted to historical reference by Convention 0001;
the developer has explicitly requested removal of the TypeScript code.

## Validation

- `gofmt -l .` clean (no output)
- `go vet ./...` pass
- `go test -count=1 ./...` pass (all 11 test packages ok)

## Outcome

Removed 38 tracked files (28 TypeScript sources/specs under
`mirror/source/`, both tsconfig files, `package.json`, `bun.lock`,
`jsr.json`, `.npmignore`, `.npmrc`, and the legacy Bun `devops/compile.sh`)
and deleted the untracked generated directories `mirror/library/`,
`mirror/.temp/`, `mirror/node_modules/`, and `mirror/bin/`. The Go module,
`mirror/schema/mirror.schema.json`, skills, prompts, installers, and Mirror
configuration are unchanged and all validation passes.
