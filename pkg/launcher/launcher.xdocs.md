---
subject: mirror-pkg-launcher
description: Stable shared-bin launcher, strict current pointer, immutable payload installation, fallback, and legacy Windows bridge.
parent: mirror-pkg
children: []
files:
  state.go: Confined launcher paths, strict current.json model, immutable payload installation, atomic activation, and restoration.
  dispatch.go: Launcher bootstrap, verified payload dispatch, stream forwarding, exit propagation, and single fallback.
  legacy_parent_windows.go: Native Windows detection of the v4.2.4 decorated-version helper contract.
  legacy_parent_unix.go: Unix declaration that no decorated legacy helper bridge applies.
  state_test.go: Pointer validation, immutable installation, activation, and restoration tests.
  legacy_parent_windows_test.go: Native Windows process-chain proof for the v4.2.4 compatibility bridge.
documents: {}
tags: [go, launcher, upgrade]
keywords: [current.json, immutable payload, atomic activation, Windows bridge, exit propagation]
flags: []
status: stable
---

The launcher package keeps the shared command entrypoint stable while selecting
verified immutable payloads from the Mirror-owned versions directory.
