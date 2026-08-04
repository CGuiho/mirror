---
subject: mirror-pkg-config
description: Strict typed mirror.yaml decoding, hook normalization, validation, resolution, and schema.
parent: mirror-pkg
children: []
files: {config.go: "Configuration contract and loader."}
documents: {}
tags: [go, yaml, configuration, hooks]
keywords: [known fields, typed config, lifecycle events, hook aliases]
flags: []
status: stable
---

Mirror accepts YAML only and rejects unknown, duplicate, or invalid fields,
including unsupported hook events and payloads.
