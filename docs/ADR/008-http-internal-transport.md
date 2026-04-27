# ADR-008: HTTP as internal bridge transport

## Status

Accepted

## Context

the-bridge has multiple consumers: the MCP adapter (Node.js), the Hammerspoon module (Lua), future A2A adapter, and direct curl/API usage for debugging. Each consumer needs to talk to the daemon.

Options:
- **MCP as the internal protocol**: Would require every consumer to implement an MCP client. Hammerspoon has no MCP SDK.
- **A2A as the internal protocol**: Same problem — not all consumers can speak A2A.
- **HTTP REST + SSE**: Universal. Every runtime has an HTTP client. Hammerspoon has `hs.http`. Node.js has `fetch`. curl works from the command line. SSE provides push notifications for consumers that support persistent connections.

## Decision

HTTP REST is the internal transport for the-bridge. All daemon operations (announce, discover, send, inbox, ack) are exposed as HTTP endpoints on `localhost:7777`. SSE on `/events` provides push notifications.

MCP and A2A are external-facing adapters that wrap the HTTP API. They translate between their protocol and the daemon's HTTP interface. This means the adapters are stateless — all state lives in the daemon.

## Consequences

- Any tool, runtime, or script can interact with the bridge. `curl` is a first-class debugging client.
- MCP adapter is a thin translation layer: MCP tool call → HTTP request → JSON response → MCP result.
- Hammerspoon uses `hs.http.get/post` directly against the daemon. No SDK needed.
- Adding a new adapter means writing a protocol translator over HTTP, not integrating with the daemon's internals.
- The HTTP API is the source of truth for the bridge's contract. Protocol adapters are convenience layers, not requirements.
