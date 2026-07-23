---
name: Mirror Upgrade Catalog Progress And Linux Download Validation
purpose: Record reproducible validation and public release evidence for issues 16 through 18.
description: Captures local, Linux, Windows, CI, release, asset, note, installer, progress, and issue-closure results.
created: 2026-07-23
owner: mirror-docs-validation
flags:
  - validated
tags:
  - mirror
  - validation
keywords:
  - issue 16
  - issue 17
  - issue 18
  - Mirror 3.7.3
---

# Mirror Upgrade Catalog Progress And Linux Download Validation

## Results

| Check | Result |
| --- | --- |
| `bun run typecheck` | passed |
| Windows `bun test` | 57 passed, 0 failed, 325 assertions |
| WSL compiled Linux fixture | passed; executing compiled binary streamed, replaced itself, verified version/schema, cached, and cleaned |
| Known/unknown progress | passed; percentage and byte progress both covered |
| Stall and integrity failures | passed; timeout, partial body, length mismatch, empty/invalid candidates preserve canonical binary |
| `bun run build` | passed; 12 native and 14 total assets |
| XDocs strict metadata/tree/doctor | passed; 0 errors and 0 warnings |
| Final CI | [run 30035296237](https://github.com/CGuiho/mirror/actions/runs/30035296237), passed on Ubuntu and Windows |
| Final publish | [run 30035300131](https://github.com/CGuiho/mirror/actions/runs/30035300131), passed |
| Release | [Mirror 3.7.3](https://github.com/CGuiho/mirror/releases/tag/%40guiho/mirror%403.7.3), stable |
| Assets | exactly 14, including the two `.md` agent assets |
| Notes | only the 3.7.3 changelog section |
| Public forward upgrade | public 3.7.2 -> 3.7.3 through `mirror upgrade --version 3.7.3` |
| Public progress | monotonic through `100.0% (89.5 MiB/89.5 MiB)` |
| Public outcome | `Upgrade complete: 3.7.2 -> 3.7.3`; canonical version and global schema checks passed |
| Issues | 16, 17, and 18 received evidence and are closed |

## Failure And Recovery Evidence

The public 3.6.1 reproduction resolved the correct 3.7.1 asset, printed
`Downloading...`, emitted no bytes for 180 seconds, and exited 124 under the
outer deadline. This confirms the old opaque whole-response path. Because code
inside an immutable old binary cannot change before download, the canonical
installer is the one-time recovery. The 3.7.2 staged release verified that
recovery and the fixed downloader; 3.7.3 verified the normal forward path.

## Readiness

Mirror 3.7.3 is the accepted stable release for this task. CI, Publish, public
upgrade, assets, notes, installers, documentation, and issue closure are green.
