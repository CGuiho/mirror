---
name: Mirror Technical Overview
purpose: Explain the production runtime, configuration, maintenance, and delivery architecture.
description: Technical overview for the Go/Cobra Mirror CLI.
created: 2026-07-18
owner: mirror
flags: []
tags: [mirror, architecture, go, cobra]
keywords: [strict yaml, transactional upgrade, release matrix]
---

# Mirror Technical Overview

`main.go` passes linker-injected build metadata into `cmd.NewRootCommand` and
maps typed failures to stable process exit codes. `cmd/` constructs one fresh
Cobra tree per execution. `pkg/` contains configuration, versioning, update,
upgrade, maintenance, SemVer, and release-matrix domains; these packages do not
own CLI routing.

The argument-free root route synchronously bootstraps embedded agent resources
before rendering its banner. Skill replacement is a two-root transaction and
skips byte-identical bundles. Instruction selection is repository-local,
preserves CRLF/LF and unmanaged content, rejects malformed marker topology, and
uses atomic per-file replacement with cross-file rollback.

Configuration uses `go.yaml.in/yaml/v3` with known-field rejection and typed
validation. Lookup order is explicit `--config`, the effective working
directory, then the user's global Mirror directory. TOML and Viper are not part
of the production contract.

The foreground startup path reads local update state only. Detached workers use
bounded HTTP clients and platform guards. Upgrade candidates are streamed to a
temporary file with visible progress, checked against the signed release set's
SHA-256 manifest, executed for exact version verification, and atomically
swapped while retaining a backup. Unix reconciles embedded agent resources by
running the new executable; Windows uses an out-of-process replacement worker
and a completion journal consumed on the next invocation.

`pkg/release` is the single source for eight native targets:

- Linux amd64, arm64, armv7, and armv6;
- Darwin amd64 and arm64;
- Windows amd64 and arm64.

`devops/build-binaries.go` produces those static executables plus the canonical
skill ZIP, instruction prompt, and sorted checksum manifest. The exact set is
11 assets and is independently checked by `devops/verify-release-assets`.

GitHub Actions runs Go formatting, tidy stability, tests, vet, exact asset
build/verification, installer contract checks, and native smokes. Publication
listens to `mirror/v*`, rebuilds from the tag, reconciles an idempotent GitHub
release, and asserts the exact public asset set. It does not publish the legacy
Bun package.
