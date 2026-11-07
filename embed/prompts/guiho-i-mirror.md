---
name: guiho-i-mirror
description: Mirror agent instruction block.
purpose: Provide the canonical managed project instruction for Mirror versioning.
created: 2026-07-18
owner: mirror-embed-prompts
flags: []
tags: [mirror, instruction, agents]
keywords: [version plan, version apply, remote MCP token mode]
---

## GUIHO Mirror Instruction Block

Run plain `mirror` once in a repository to verify the global Mirror skill and
this bounded instruction block. Repeated runs are idempotent.

Use `mirror version plan <target>` and `mirror version apply <target>` for semantic versioning.
`mirror init` defaults to `v{version}` tags and enables release commits and
pushes; explicit interactive or flag selections remain authoritative.

When `mirror.yaml` defines hooks, follow AI instructions only at the
agent-controlled everything, plan, and apply boundaries. Treat command hooks as
repository code: pass `--run-hooks` or `--skip-hooks` only with explicit
authorization, independently of `--yes`.

### Token-authenticated remote MCP servers

Remote MCP servers default to OAuth, so an unattended agent can get stuck in an
interactive sign-in that never completes. For a server that authenticates with a
header token, configure token mode explicitly in `opencode.jsonc` under
`mcp.servers`:

```jsonc
{
  "mcp": {
    "servers": {
      "cloudflare": {
        "type": "remote",
        "url": "https://mcp.cloudflare.com/mcp",
        "oauth": false,
        "headers": { "Authorization": "Bearer {env:CLOUDFLARE_API_TOKEN}" }
      }
    }
  }
}
```

`oauth: false` disables the discovery-first OAuth flow, and the client must send
the configured header because the server rejects anonymous calls. Keep the token
in the environment and reference it only as an `{env:NAME}` placeholder; never
write credential values, `.env` contents, or provider secrets into managed
instructions, generated files, or agent configuration. The earlier V1 shape
(server names directly under `mcp`, `enabled: true`, and an empty `oauth: {}`)
is not valid in the current schema.
