---
name: Mirror Go Rewrite RFC
purpose: Master technical specification, architecture, implementation plan, and verification roadmap for porting Mirror from Bun/TypeScript to Go using Cobra and Viper with a strict YAML-only policy and top-level repository placement.
description: Exhaustive RFC document detailing the Cobra command tree, Viper YAML-only configuration management, Go standard library tools, version planning & application engine, Git-based versioning, detached update worker, complete implementation plan, cross-compilation release matrix, and verification criteria.
created: 2026-07-24
flags:
  - proposed
tags:
  - rfc
  - go
  - cobra
  - viper
  - yaml-only
  - architecture
  - cli
  - mirror
  - implementation-plan
keywords:
  - mirror go rewrite
  - cobra
  - viper
  - yaml only
  - golang
  - mirror
  - rfc 0034
  - help tree
  - implementation plan
owner: mirror-architecture
---

# GUIHO RFC: Mirror Go Rewrite Specification & Master Implementation Plan

## 1. Executive Summary & Strategic Objectives

This Request for Comments (RFC) serves as the **master technical specification** and **executable implementation plan** for rewriting the **Mirror CLI** (`@guiho/mirror`) from Bun/TypeScript to **Go (Golang)** using **Cobra** (`github.com/spf13/cobra`) as the primary CLI framework and **Viper** (`github.com/spf13/viper`) for configuration resolution under a strict **YAML-Only Policy** and **Top-Level Repository Architecture**.

### Key Directives & Rules

1. **Top-Level Repository Layout**: The Go codebase (`main.go`, `cmd/`, `pkg/`, `embed/`, `go.mod`, `go.sum`) is placed directly at the top level of the repository root (`C:\GUIHO\mirror\`).
2. **Coexistence Directive**: The existing TypeScript code inside `mirror/` remains completely preserved and untouched side-by-side in the repository until explicitly decommissioned at a future date.
3. **Strict YAML-Only Policy**: All `.toml` configuration file formats are completely dropped. Mirror exclusively parses and supports YAML (`.yaml` / `.yml`) for all configuration files (`mirror.yaml`).
4. **Git-Based Versioning & Go Tag Format**: Mirror uses `git` as the source of truth for versions (`source: "git"`, `output: ["git"]`). Tags are formatted as `vX.Y.Z` or `@guiho/mirror/vX.Y.Z`. Releases are bumped locally without auto-publishing.
5. **Sub-10ms Cold Startup**: Eliminate JavaScript runtime bootstrap overhead to achieve instant (<10ms) version planning and execution.
6. **Compact Binary Size**: Reduce single-executable binary sizes from ~50 MiB (Bun compiled runtime) down to ~8–12 MiB per target platform.
7. **Cobra Command Framework**: Leverage Cobra for command routing (`mirror`, `init`, `config`, `agent`, `version`, `upgrade`, `uninstall`), flag handling, subcommands, usage/help rendering, and shell completion generation.
8. **Viper Configuration Management**: Use Viper and `gopkg.in/yaml.v3` for strict `mirror.yaml` decoding (`KnownFields(true)`), environment variable bindings (`MIRROR_*`), and configuration precedence (Flags > Env > YAML Config File > Defaults).

---

## 2. Mandatory Technology Stack & Dependencies

To guarantee high performance, memory safety, zero external C-dependencies (`CGO_ENABLED=0`), and full RFC 0034 CLI parity, the Go rewrite of Mirror uses the following curated set of tools and libraries:

### Core Frameworks & Configuration
1. **Cobra (`github.com/spf13/cobra`)**
   - **Role**: Command tree definition (`mirror`, `init`, `config`, `agent`, `version`, `upgrade`, `uninstall`), subcommands, POSIX flag routing, usage/help formatting, `--help-tree` recursive hierarchy printer, and shell completion generation.
2. **Viper (`github.com/spf13/viper`)**
   - **Role**: Hierarchical configuration management with deterministic precedence: Flags > Environment Variables (`MIRROR_*`) > `mirror.yaml` config file > Key/value defaults. Configured strictly for YAML parsing (`SetConfigType("yaml")`).

### Serialization & Validation
3. **`gopkg.in/yaml.v3`**
   - **Role**: Strict YAML parser for `mirror.yaml`. Configured with `Decoder.KnownFields(true)` to reject unknown or malformed fields. TOML parsing is completely excluded.
4. **`encoding/json`** (Go Standard Library)
   - **Role**: High-speed JSON serialization for `--format json` outputs and structured version plan representations.

### Standard Library Power Tools
5. **`embed` (`go:embed`)**
   - **Role**: Embeds CLI-owned agent skills (`guiho-s-mirror.SKILL.md`), instructions, and documentation assets directly inside the compiled native binary.
6. **`os/exec` & `syscall`**
   - **Role**: Safe Git execution, process execution, and background worker detachment (`SysProcAttr{Setsid: true}` on POSIX / `CREATE_NEW_PROCESS_GROUP` on Windows).
7. **`crypto/sha256` & `crypto/subtle`**
   - **Role**: Cryptographic hash calculation and checksum verification during binary upgrades.
8. **`net/http` with `time.Duration` Timeouts**
   - **Role**: Lightweight HTTP client with custom timeouts for GitHub release discovery and asset downloads.
9. **`path/filepath` & `os`**
   - **Role**: Atomic file operations (write-to-temp + rename) for skill reconciliation, cache updates, and binary upgrades without partial write corruption.

### Testing & Build DevOps
10. **Testify (`github.com/stretchr/testify`)**
    - **Role**: Assertion helpers (`assert`, `require`, `suite`) for testing parity against existing test suites.
11. **`CGO_ENABLED=0` Pure-Go Compilation**
    - **Role**: Guarantees completely static, self-contained binaries with zero C-library dependencies.

---

## 3. Go Module & Top-Level Repository Architecture

```text
C:\GUIHO\mirror\
├── main.go                       # Primary Go CLI entry point
├── go.mod                        # Go module (github.com/CGuiho/mirror)
├── go.sum                        # Go dependency checksums
├── cmd/                          # Cobra Command Tree & Flag Routing
│   ├── root.go                   # Root command 'mirror' & Viper YAML configuration
│   ├── init.go                   # 'mirror init' command (YAML config generator)
│   ├── config.go                 # 'mirror config' root command
│   ├── config_show.go            # 'mirror config show'
│   ├── config_check.go           # 'mirror config check'
│   ├── config_schema.go          # 'mirror config schema'
│   ├── agent.go                  # 'mirror agent' root command
│   ├── agent_skill.go            # 'mirror agent skill' (install, uninstall, update, list, show)
│   ├── agent_instruction.go      # 'mirror agent instruction' (apply, remove, update, show)
│   ├── agent_prompt.go           # 'mirror agent prompt' (list, show)
│   ├── version.go                # 'mirror version' root command
│   ├── version_plan.go           # 'mirror version plan <target>' (major, minor, patch, pre, etc.)
│   ├── version_apply.go          # 'mirror version apply <target>'
│   ├── upgrade.go                # 'mirror upgrade' root command & subcommands (check, list)
│   ├── uninstall.go              # 'mirror uninstall' command
│   └── helptree.go               # '--help-tree', '--help-tree-depth', '--help-docs' handlers
├── pkg/
│   ├── config/                   # Config parser, Viper mapping & schema validation
│   ├── semver/                   # SemVer 2.0 version calculation, target bumping & tag formatting
│   ├── versioning/               # Version plan builder & application engine (git tags)
│   ├── update/                   # Detached update worker & TTL cache
│   ├── maintenance/              # Automatic agent maintenance worker
│   ├── welcome/                  # Platform-aware welcome window renderer
│   └── updater/                  # Self-upgrade, binary verification & rollback engine
├── embed/
    └── skills/                   # Embedded agent skills (`go:embed`)
├── devops/
│   ├── build-binaries.go         # Go multi-target build script
│   └── verify-release-assets.go  # Release asset verification script
│
└── mirror/                       # [PRESERVED] Existing TypeScript repository directory (DO NOT DELETE)
```

---

## 4. Canonical Command Tree Contract (`mirror --help-tree`)

The Go migration will be considered **fully complete** when executing `mirror --help-tree` against the compiled Go binary produces the exact hierarchy shown below:

```text
COMMAND TREE

mirror
├── init                                  Create or reconcile mirror.yaml configuration.
│   ├── --cwd <path>                          Run as if Mirror started in this directory.
│   ├── --config <path>                       Use this mirror.yaml file.
│   ├── --format <text|json>                  Select output format.
│   ├── --verbose                             Enable diagnostics.
│   ├── --help                                Show command help.
│   ├── --help-tree                           Show command hierarchy.
│   ├── --help-tree-depth <positive-integer>  Limit help-tree recursion depth.
│   └── --help-docs                           Emit Markdown documentation for this command.
├── config                                Validate and inspect configuration.
│   ├── show                                  Show effective configuration.
│   ├── check                                 Validate configuration against schema.
│   ├── schema                                Output or save JSON schema.
│   ├── --cwd <path>                          Run as if Mirror started in this directory.
│   ├── --config <path>                       Use this mirror.yaml file.
│   ├── --format <text|json>                  Select output format.
│   ├── --help                                Show command help.
│   ├── --help-tree                           Show command hierarchy.
│   ├── --help-tree-depth <positive-integer>  Limit help-tree recursion depth.
│   └── --help-docs                           Emit Markdown documentation for this command.
├── agent                                 Manage Mirror agent integration.
│   ├── skill                                 Manage bundled Mirror skill.
│   ├── instruction                           Manage Mirror instruction blocks.
│   ├── prompt                                Inspect bundled agent prompts.
│   ├── --help                                Show command help.
│   ├── --help-tree                           Show command hierarchy.
│   ├── --help-tree-depth <positive-integer>  Limit help-tree recursion depth.
│   └── --help-docs                           Emit Markdown documentation for this command.
├── version                               Plan and apply semantic version changes.
│   ├── plan <target>                         Build version plan without applying.
│   │   ├── --dry-run                             Plan without mutation.
│   │   ├── --format <text|json>                  Select output format.
│   │   ├── --help                                Show command help.
│   │   ├── --help-tree                           Show command hierarchy.
│   │   ├── --help-tree-depth <positive-integer>  Limit help-tree recursion depth.
│   │   └── --help-docs                           Emit Markdown documentation for this command.
│   ├── apply <target>                        Apply version plan and create Git tags.
│   │   ├── --yes                                 Apply without confirmation.
│   │   ├── --dry-run                             Plan without mutation.
│   │   ├── --format <text|json>                  Select output format.
│   │   ├── --help                                Show command help.
│   │   ├── --help-tree                           Show command hierarchy.
│   │   ├── --help-tree-depth <positive-integer>  Limit help-tree recursion depth.
│   │   └── --help-docs                           Emit Markdown documentation for this command.
│   ├── --help                                Show command help.
│   ├── --help-tree                           Show command hierarchy.
│   ├── --help-tree-depth <positive-integer>  Limit help-tree recursion depth.
│   └── --help-docs                           Emit Markdown documentation for this command.
├── upgrade                               Inspect or upgrade the installed Mirror native binary.
│   ├── check                                 Check whether a newer stable release exists.
│   ├── list                                  List available release versions.
│   ├── --version <version>                   Select exact release version.
│   ├── --dry-run                             Plan without mutation.
│   ├── --format <text|json>                  Select output format.
│   ├── --help                                Show command help.
│   ├── --help-tree                           Show command hierarchy.
│   ├── --help-tree-depth <positive-integer>  Limit help-tree recursion depth.
│   └── --help-docs                           Emit Markdown documentation for this command.
├── uninstall                             Remove the installed Mirror native binary.
│   ├── --dry-run                             Print target path without deleting.
│   ├── --format <text|json>                  Select output format.
│   ├── --help                                Show command help.
│   ├── --help-tree                           Show command hierarchy.
│   ├── --help-tree-depth <positive-integer>  Limit help-tree recursion depth.
│   └── --help-docs                           Emit Markdown documentation for this command.
├── --version                             Show the Mirror version.
├── --help                                Show command help.
├── --help-tree                           Show command hierarchy.
├── --help-tree-depth <positive-integer>  Limit help-tree recursion depth.
└── --help-docs                           Emit Markdown documentation for this command.
```

---

## 5. Master Phase-by-Phase Implementation Plan

### Phase 1: Top-Level Repository Scaffolding & Cobra Command Tree
- [ ] Initialize `go.mod` module (`github.com/CGuiho/mirror`) in repository root `C:\GUIHO\mirror`.
- [ ] Install Go dependencies (`github.com/spf13/cobra`, `github.com/spf13/viper`, `gopkg.in/yaml.v3`, `github.com/stretchr/testify`, `github.com/Masterminds/semver/v3`).
- [ ] Create `embed/embed.go` with `go:embed` asset binding for `guiho-s-mirror.SKILL.md`.
- [ ] Scaffold root Cobra command tree (`cmd/root.go`, `init.go`, `config.go`, `agent.go`, `version.go`, `upgrade.go`, `uninstall.go`, `helptree.go`).
- [ ] Compile and verify basic binary execution (`go build -o bin/mirror-go.exe .`).

### Phase 2: Configuration & SemVer Engine (`pkg/config` and `pkg/semver`)
- [ ] Implement `pkg/config` with strict YAML decoding (`gopkg.in/yaml.v3` `KnownFields(true)`) and Viper mapping.
- [ ] Implement `pkg/semver` for SemVer 2.0 bumping (`major`, `minor`, `patch`, `prerelease`, exact version target) and Go tag formatting (`vX.Y.Z` or `{name}/v{version}`).
- [ ] Write Testify unit test suite in `pkg/config/` and `pkg/semver/`.

### Phase 3: Version Plan & Git Tagging Engine (`pkg/versioning` and `cmd/version*.go`)
- [ ] Implement `pkg/versioning` for building `version plan` and applying `version apply`.
- [ ] Implement Git tag creation and local commit hooks.
- [ ] Connect `cmd/version_plan.go` and `cmd/version_apply.go`.
- [ ] Write unit tests verifying plan generation and local tag execution without network push.

### Phase 4: Full Subcommand Tree & Help Tree Generator (`cmd/`)
- [ ] Implement `cmd/helptree.go` to render the exact `mirror --help-tree` matrix matching Section 4.
- [ ] Implement `cmd/config_show.go`, `cmd/config_check.go`, `cmd/config_schema.go`.
- [ ] Implement `cmd/agent_skill.go`, `cmd/agent_instruction.go`, and `cmd/agent_prompt.go`.

### Phase 5: Detached Workers & Upgrade Engine (`pkg/update`, `pkg/maintenance`, `pkg/updater`)
- [ ] Implement `pkg/update/worker.go` for background update checks via process detachment.
- [ ] Implement `pkg/maintenance/maintenance.go` for non-blocking automatic agent skill and `AGENTS.md` block reconciliation.
- [ ] Implement `pkg/updater/upgrade.go` for atomic binary replacement and rollback.

### Phase 6: Test Parity, Multi-Target Build DevOps & Verification
- [ ] Port test cases to Go tests (`go test ./...`).
- [ ] Create `devops/build-binaries.go` for Go multi-target cross-compilation (`CGO_ENABLED=0`).
- [ ] Create `devops/verify-release-assets.go` for release asset verification.

---

## 6. Verification Plan

### Automated Verification
1. **Go Unit & Integration Tests**:
   ```bash
   go test -v ./...
   ```
2. **Help Tree Parity Check**:
   ```bash
   go run . --help-tree
   ```
   Must output the exact hierarchy defined in Section 4.

### Manual Verification
1. Test `mirror version plan minor` and `mirror version apply minor` locally against Git tags.
2. Verify that `mirror.yaml` uses `source: "git"`, `output: ["git"]`, and tag template `{name}/v{version}` or `v{version}` without mutating `package.json`.
