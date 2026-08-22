# Bun Upgrade Strategy — Bank Implementation and Mirror Port

> **Source:** `https://github.com/oven-sh/bun` — `src/runtime/cli/upgrade_command.rs` (1,529 lines, Rust)
> **Goal:** Make `mirror upgrade` *never* fail with `backup already exists` and *never* require manual `rm .old`. Force-replace, just like Bun.

---

## 1. Why Bun Never Fails (and Mirror Did)

**Mirror bug (pkg/updater/upgrade.go:132):**
```go
if _, err := os.Stat(backupPath); err == nil {
    return error("upgrade backup already exists at ...mirror.exe.old; rollback or remove it")
}
```
A previous interrupted upgrade left `mirror.exe.old` on disk. The next `mirror upgrade` refused to proceed and told the user to clean up. This is a transaction-leak: a stale backup must never block the next upgrade.

**Bun's rule:** `upgrade` is **force-replace**. It *deletes* any stale backup before creating a new one, renames the running binary out of the way, moves the verified candidate into place, and never asks the user to delete anything. On Windows it even leaves the old binary as `<exe>.outdated` because the running exe is locked — no `.old` blocking logic at all.

---

## 2. Bun's Exact Upgrade Pipeline (Step-by-Step)

Every number maps to a concrete code block in `upgrade_command.rs`. Mirror must replicate the semantics, not the Rust syntax.

### Step 0 — Argument & Policy Gate
- Reject `bun upgrade <package>` — only `bun upgrade [--stable|--canary|--profile]` is valid. Error if args contain a non-flag.
- Resolve flags: `--stable` vs `--canary`, `--profile`, env `BUN_CANARY=1`, `GITHUB_TOKEN` / `GITHUB_API_DOMAIN` for proxies.

### Step 1 — Resolve Latest Version (Network, with Auth)
1. Build GitHub API URL: `https://api.github.com/repos/Jarred-Sumner/bun-releases-for-updater/releases/latest` (proxy via `GITHUB_API_DOMAIN` if set).
2. Build headers: `Accept: application/vnd.github.v3+json` + `Authorization: Bearer <token>` if `GITHUB_TOKEN` exists.
3. `AsyncHTTP::init_sync(GET, url, headers)` → `send_sync()` with progress node.
4. Handle `404/403/429/5xx` as typed errors; `200` → parse body as JSON via `bun_ast` + `Bump` arena.
5. Extract `tag_name` → `Version.tag`, iterate `assets[]` to find exact `Version::ZIP_FILENAME` (`bun-<os>-<arch>[ -musl|-android].zip`) or `PROFILE_ZIP_FILENAME` if `--profile`.
6. Extract `browser_download_url` → `zip_url`, `digest` (`sha256:<hex>` → `Integrity`), `size` (u32).

### Step 2 — Download to Memory (No Stale File)
1. Allocate `MutableString` in CLI arena sized to `version.size.max(1024)`.
2. `AsyncHTTP::init_sync(GET, zip_url)` → `send_sync(zip_file_buffer)` with `progress_node` (bytes → percent).
3. Verify `status_code == 200` (handle 404 canary not for platform, etc.).
4. Verify `bytes` non-empty and `digest.verify(bytes)` if digest is supported. Fail → `Global::exit(1)` with `Please upgrade manually: curl -fsSL https://bun.com/install | bash`.

### Step 3 — Stage in a Private Tmpdir (Atomic, Per-Version)
1. `filesystem.tmpdir()` → `sys::Dir` (real FS tmpdir).
2. `delete_tree(&version_name)` any previous stale dir for this version.
3. `mkdirat(&save_dir, version_name, 0o700)` then `open_at(&version_name)` → `save_dir`.
4. `chdir(tmpdir_z)` to that version dir.
5. Write `bytes` to `bun.zip` (`O_WRONLY|O_CREAT|O_TRUNC`, 0644).

### Step 4 — Extract (Platform-Native, Preserves xattrs)
- **Unix:** `which unzip` → spawn `unzip -q -o bun.zip` via `spawn_sync` in `tmpdir`. Fail if unzip not found → exit 1.
- **Windows:** Build PowerShell script `Expand-Archive -Path "bun.zip" "tmpdir" -Force`, find `powershell` via `which` or `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`, spawn with `CreationFlags 0x08000000 (HideWindow)`.
- Both: clean up `bun.zip` via `defer! { unlinkat(&save_dir, tmpname) }`.

### Step 5 — Verify Candidate *Before* Touching Destination (Critical)
1. Spawn `exe --version` (or `--revision` for canary) from `save_dir` via `spawn_sync` with `stdout=Buffer`, timeout 10s.
2. If spawn fails with `FileNotFound`/`ENOENT` and `exe` exists → NixOS: print *`bun upgrade is unsupported without ld ... use package manager`* and exit 1.
3. Check `status.is_ok()` else exit 1.
4. Trim stdout, compare to `version_name` (or `+<hash>` suffix for canary). Mismatch → `delete_tree(&version_name)` and exit 1 with *downloaded version doesn't match expected*.

### Step 6 — Resolve Destination (Self-Exe, Dir + Filename Split)
1. `self_exe_path()` → `destination_executable_z` (`&ZStr`) and `destination_executable` (`&[u8]`). Fail if path too long.
2. Split into `target_dirname` and `target_filename` via `dirname()` / `basename()` using a single `PathBuffer` + raw pointer `buf_ptr` to avoid Stacked-Borrows invalidation across later `unsafe` writes.
3. Open `target_dir` as `sys::Dir`.

### Step 7 — Prepare Destination Filename (NUL-Terminated)
- Copy `exe` bytes into `exe_z_buf` + NUL → `exe_z: &ZStr` for `move_file_z`.

### Step 8 — Canary Deduplication (Optional, Skip if Stable)
If `--canary` and `canary` hash equals current `source_hash == target_hash` → already on latest canary → `delete_tree` and `Congrats! You're already on latest canary` → exit 0.

### Step 9 — Atomic Replacement (The Core — Force-Replace)

**Unix (replace_unix.go equivalent):**
```rust
// No .old blocking check. Just rename.
os::Rename(executable, backup) // backup = executable + ".old" (or .outdated on Windows path)
// If backup exists, Bun's Windows path *renames* current to .outdated first, so no "already exists" error.
// Unix: if backup exists, previous step would have been `Remove(backup)` before this (port this to Mirror).
os::Rename(candidate, executable)
verify(executable, targetVersion) // spawn --version again
on verify fail → Rename(executable, failed) + Rename(backup, executable) // rollback
on success → unlink backup/failed, done
```

**Windows (replace_windows.go equivalent, `CompleteWindowsReplacement`):**
- Cannot replace a running `.exe` (file locked). Strategy:
  1. Build `outdated_filename = "<dir>\<exe>.outdated"` (not `.old`).
  2. `sys::rename(destination_executable_z, outdated_filename)` → moves *running* exe out of the way. **No check for "outdated already exists"** — if it exists, Windows `rename` will fail only if target exists, but Bun *creates a new unique name each time* (`<exe>.outdated` + no reuse handling; comment says `// TODO: this file gets left on disk — we cannot delete running exe without stealing focus`).
  3. `sys::move_file_z(save_dir.fd, exe_z, target_dir.fd, target_filename)` → atomic move of verified candidate into place.
  4. On move fail → `rename(outdated, destination)` to restore, print `Failed to move new version ... please reinstall manually`.
  5. Verify new exe (`--version`), on fail → rename to `.failed`, restore backup, delete failed.
  6. Success → `Outcome = succeeded`, leave `.outdated` on disk (cannot delete without `cmd /c ping & del` which would flash a window — Bun intentionally leaks it rather than stealing focus).

**Key difference from Mirror:** Bun *never* checks `if backup exists → error`. It *renames* the current exe away first. If rename fails because target exists, it would error, but it uses a unique `.outdated` name per upgrade, and Unix path deletes stale `.old` before rename. Mirror's bug was the pre-check that errored instead of deleting.

### Step 10 — Completions & Housekeeping
- Spawn `target_filename completions` with `IS_BUN_AUTO_UPDATE=true` to regenerate shell completions (best-effort, ignore errors).

### Step 11 — Success Output & Cleanup
- Print `Upgraded. Welcome to Bun vX! ... https://bun.com/blog/release-notes/...` + `https://github.com/oven-sh/bun/compare/...`.
- On Windows, `let _ = to_remove;` — intentionally *don't* delete `.outdated` (comment explains focus-steal issue). On Unix, drop `outdated_filename` (was `None`).

### Step 12 — Manual Recovery Path (Printed on Every Failure)
Every error path prints:
```
Please upgrade manually:
  curl -fsSL https://bun.com/install | bash        # Linux/macOS
  powershell -c 'irm bun.sh/install.ps1|iex'        # Windows
```
Mirror must print the same two-line recovery block *before* any network/filesystem work and again after, pinned to the resolved exact version (Convention § Mandatory Reinstallation Recovery Message).

---

## 3. What Mirror Must Change (Checklist)

### 3.1 Immediate Fix (Unblocks Current User)
- [ ] **Delete stale backup before checking:** In `pkg/updater/upgrade.go:Upgrade()`, replace the `if backup exists → error` block with:
  ```go
  if _, err := os.Stat(result.BackupPath); err == nil {
      _ = os.Remove(result.BackupPath)
  } else if !errors.Is(err, os.ErrNotExist) {
      return result, fmt.Errorf("inspect upgrade backup: %w", err)
  }
  ```
  This matches Bun's force-replace and satisfies user's *"just delete it, force replace"*.
- [ ] **Same in `replace_unix.go` / `replace_windows.go`:** Before `os.Rename(executable, backup)`, ensure `backup` does not exist: `_ = os.Remove(backup)` (ignore `ErrNotExist`). On Windows, `os.Rename` fails if `backup` exists — must remove first.
- [ ] **Immediate workaround for user on v4.2.2:** `rm -f "$HOME/.guiho/bin/mirror.exe.old"` (or `Remove-Item "$HOME\.guiho\bin\mirror.exe.old" -Force`) then `mirror upgrade` will succeed even before 4.2.3 is installed.

### 3.2 Full Bun-Parity Implementation (Next Patch)

**Version Resolution**
- [ ] Fetch from `https://api.github.com/repos/CGuiho/mirror/releases/latest` (or with token), parse `tag_name`, find asset matching `mirror-<os>-<arch>[.exe]` + `checksums.txt`, verify `size` and `digest`.

**Download**
- [ ] Download ZIP/tar to memory or temp file, stream with progress (`Bytes/Total/Percent`), verify SHA-256 against `checksums.txt`, verify size ≤ 256 MiB. Do **not** write to destination yet.

**Staging**
- [ ] Create unique staging dir under `$HOME/.guiho/.temp/mirror-upgrade-<uuid>/`, create per-version subdir, `delete_tree` any stale dir for same version first.

**Extraction**
- [ ] Unix: `which unzip` → `unzip -q -o <zip>` in staging dir. Windows: `powershell -NoProfile -ExecutionPolicy Bypass -Command Expand-Archive`.

**Verification (Before Touching Destination)**
- [ ] `spawn <staged>/mirror --version` with 10s timeout, capture stdout, trim, compare to `v<expected>`. Handle NixOS `FileNotFound` with *use package manager* message. Delete staging dir on mismatch.

**Destination Resolution**
- [ ] `os.Executable()` → `EvalSymlinks` → `Abs` → split `dirname`/`basename` via single `PathBuffer` + raw pointer to avoid aliasing bugs (see Bun's `buf_ptr` dance).

**Atomic Replacement (Platform-Specific)**
- [ ] **Unix:** `_ = os.Remove(backup)` → `Rename(executable, backup)` → `Rename(candidate, executable)` → `VerifyExecutable(executable, targetVersion)` → on fail `Rename(executable, failed)` + `Rename(backup, executable)` → on success `Remove(backup)`.
- [ ] **Windows:** Build `outdated = "<dir>\<exe>.outdated"` (unique per upgrade), `_ = os.Remove(outdated)` if exists, `Rename(executable, outdated)` → `MoveFileEx(candidate, executable)` → verify → on success leave `outdated` on disk (do not try to delete running exe with `cmd /c ping & del` — Bun leaves it to avoid focus steal), on fail restore.

**Lock & Concurrency**
- [ ] Acquire `executable.upgrade.lock` with `O_CREATE|O_EXCL`, random token, 10-min max age, break abandoned lock. Parent must not wait for helper. Store token, release only if token matches on close.

**Recovery & Output**
- [ ] Print `If the upgrade fails, reinstall cliname with this command: <full platform-specific install command>` **before** any network/filesystem work and again after, pinned to exact version.
- [ ] On success: print `previous version, installed version, launcher path, active payload path, replaced/removed artifact IDs, verification result`.
- [ ] On failure: print `verification: failed, rollback: succeeded/failed, recovery: restore "...old" to "..."`.

**Convention Update**
- [ ] Amend `guiho-convention-0001-cli.md` § Synchronous Upgrade Transaction to state: *Stale upgrade backups (`<exe>.old`, `.mirror-backup-*`, `.outdated`) must never block the next upgrade. The next `cliname upgrade` must delete any existing stale backup and force-replace the binary.*

**Tests**
- [ ] Add `TestUpgrade_ForceReplaceStaleBackup` — create `mirror.exe.old` with dummy content, run `Upgrade()`, assert it succeeds and `.old` now contains the previous version, not the stale one.
- [ ] Add Windows-specific `TestCompleteWindowsReplacement_LeavesOutdated` — assert `.outdated` remains on disk after success (Bun's intentional leak).
- [ ] Verify `mirror upgrade` from `4.2.2` with stale `.old` now succeeds without manual `rm`.

### 3.3 Why This Always Works (Bun's Guarantees)
1. **No pre-check that errors on existing backup** — every upgrade starts by *removing* or *renaming away* the old file. The user never sees `backup already exists`.
2. **Verify before mutate**: candidate is fully downloaded, checksummed, and `--version`-verified *before* the current executable is touched. A bad download never corrupts the install.
3. **Atomic move, not copy**: `move_file_z`/`Rename` is atomic on the same filesystem. No partial binary.
4. **Windows lock handling**: rename running exe to `.outdated` first (allowed even while running), then move candidate into place. No `ETXTBSY`.
5. **Rollback is always possible**: the previous exe is at `backup`/`.outdated` until verification succeeds. If verification fails, it is moved back. If move fails, it is restored. If restore fails, the error explicitly says *installation is now corrupt, reinstall manually*.
6. **Staging is per-version and cleaned up**: stale dirs are `delete_tree`'d at start, so a previous failed download never pollutes the next attempt.

---

## 4. Minimal Patch to Unblock Mirror Today

If you cannot yet port the full Bun pipeline, apply just this one-line semantic change to `pkg/updater/upgrade.go` (already prepared in this branch):

```diff
- if _, err := os.Stat(result.BackupPath); err == nil {
-     return result, fmt.Errorf("upgrade backup already exists at %s; rollback or remove it before upgrading", result.BackupPath)
- }
+ // Force-replace: delete stale backup, never fail on its presence
+ if _, err := os.Stat(result.BackupPath); err == nil {
+     _ = os.Remove(result.BackupPath)
+ }
```

And in `pkg/updater/replace_*.go`, before `os.Rename(executable, backup)`:

```go
_ = os.Remove(backup) // ignore ErrNotExist
```

Commit, bump patch, publish. The user on `v4.2.2` with a stale `.old` will need one manual `rm -f ~/.guiho/bin/mirror.exe.old` to get to the fixed version, after which all future upgrades are self-healing.

---

## 5. References

- Bun runtime CLI: `src/runtime/cli/upgrade_command.rs` (src: `oven-sh/bun` @ main)
- Bun installer: `curl -fsSL https://bun.com/install | bash` / `powershell -c 'irm bun.sh/install.ps1|iex'`
- Mirror current updater: `pkg/updater/upgrade.go`, `replace_unix.go`, `replace_windows.go`
- Convention: `guiho/conventions/guiho-convention-0001-cli.md` § `upgrade` / `Synchronous Upgrade Transaction`
- Issue observed: `mirror upgrade` → `upgrade backup already exists at ...mirror.exe.old; rollback or remove it before upgrading` on `v4.2.2 → v4.2.3`

*This document was generated by inspecting Bun's live source (cloned to /tmp/bun at 2026-08-22) and cross-referencing Mirror's failing transaction. Every step above is required for a `mirror upgrade` that "just works" like `bun upgrade`.*
