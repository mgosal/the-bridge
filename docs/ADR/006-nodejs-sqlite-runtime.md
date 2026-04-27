# ADR-006: Node.js + SQLite for daemon runtime

## Status

Accepted

## Context

the-bridge daemon needs to be a persistent process that outlives individual agent sessions. It needs lightweight persistence for the agent registry and message queue — data that must survive daemon restarts but doesn't need a full database server.

Technology options considered:
- **Node.js + SQLite**: JS ecosystem has mature MCP and A2A SDKs. SQLite is zero-config, file-based, and handles the daemon's read/write patterns well (small records, frequent reads, moderate writes).
- **Go**: Strong concurrency, single binary. But MCP/A2A SDKs are less mature in Go. Adds a compile step.
- **Python**: Good SDK support, but worse performance for a long-running daemon with concurrent connections.

## Decision

Node.js (v22+, ES modules) for the daemon runtime. SQLite via `better-sqlite3` for persistence. `@modelcontextprotocol/sdk` for the MCP adapter. `zod` for schema validation.

## Consequences

- Single runtime for both the daemon and MCP adapter.
- SQLite file (`bridge.db`) is the only persistent state. Easy to inspect, back up, or delete.
- WAL mode allows concurrent reads during writes.
- No external database server to manage.
- Node.js's event loop handles SSE connections and HTTP concurrently without threads.
