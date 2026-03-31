# the-bridge

> *"Number One, you have the bridge."*

A daemon for agent discovery and coordination across protocols and platforms.

---

## Background

AI agents are everywhere — on mobile, in browsers, in IDEs, in CRM platforms, in enterprise tools. Each agent is in charge of its own resources. Each is capable within its own domain.

No discovery, no coordination. You work with disconnected agents side by side.

the-bridge is a space where agents can announce themselves and discover other agents.

---

```
┌──────────┐          ┌─────────────────────┐          ┌──────────┐
│  Agent A  │──MCP──▶ │                     │ ◀──A2A──│  Agent B  │
│ (Claude)  │◀──MCP── │     the-bridge      │ ──A2A──▶│ (Gemini)  │
└──────────┘          │                     │          └──────────┘
                      │  Protocol Adapters:  │
┌──────────┐          │  ┌─────┐ ┌─────┐    │          ┌──────────┐
│  Agent C  │──ACP──▶ │  │ MCP │ │ A2A │    │ ◀──MCP──│  Agent D  │
│ (Custom)  │◀──ACP── │  │     │ │     │    │ ──MCP──▶│(Antigrav) │
└──────────┘          │  │ ACP │ │ ... │    │          └──────────┘
                      │  └─────┘ └─────┘    │
                      └─────────────────────┘
```

---

## The Push Problem

MCP is pull-based. The client calls the server, not the other way around. Agent coordination needs push.

| Approach | Mechanism | Trade-off |
|:---------|:----------|:----------|
| **SSE** | Server-Sent Events — persistent connection, server pushes notifications | Requires the AI framework to handle incoming interrupts |
| **Polling** | Each agent periodically calls `check_messages()` | Works but wastes cycles and adds latency |

These aren't the only options. WebSockets offer full-duplex communication. Webhooks provide event-driven callbacks for agents that can't hold a persistent connection. OS-level IPC (signals, named pipes, unix sockets) could work if agents run as local processes. File system watchers are crude but simple. The right approach probably depends on where the agent lives — a browser tab, a desktop process, a cloud service — and what its runtime supports.

Agents run in different runtimes with different lifecycles. A browser tab closes. An IDE restarts. the-bridge has to be a persistent process that outlives individual agent sessions.

---

## Multi-Protocol Support

Any protocol is welcome on the-bridge.

| Protocol | Layer | Origin |
|:---------|:------|:-------|
| **MCP** | Agent ↔ Tools (vertical) | Anthropic |
| **A2A** | Agent ↔ Agent (horizontal) | Google → Linux Foundation |
| **ACP** | Agent ↔ Agent (negotiation) | Community |
| **Custom** | TBD | Your own |

---

## Project Structure

```
the-bridge/
├── src/
│   ├── daemon.js          # Main process — HTTP/SSE server
│   ├── registry.js        # Agent discovery and registration
│   ├── router.js          # Message routing and delivery
│   ├── queue.js           # Message queue with persistence
│   └── adapters/
│       ├── mcp.js         # MCP protocol adapter
│       ├── a2a.js         # A2A protocol adapter
│       ├── acp.js         # ACP protocol adapter
│       └── custom.js      # Custom protocol adapter
├── tools/
│   └── bridge-mcp/        # MCP server that agents use to connect
│       ├── index.js
│       └── tools.json     # Tool definitions
├── docs/
│   ├── ADR/               # Architecture Decision Records
│   └── protocols/         # Protocol adapter specifications
└── package.json
```

---

## Observations

**AI-to-AI delegation is not smooth.** It's not natural. MCP connects AI to tools. A2A and ACP define how agents might talk to each other. But in practice, getting one agent to find another, ask it something, and get a response back still requires a human in the loop. The protocols describe what should be possible. The runtime experience isn't there yet.

**This probably belongs at the OS level.** The operating system already manages process communication, lifecycle, and permissions. Agent coordination is IPC for AI processes. If this moves to the OS level, the same dynamics that surfaced during the browser wars and app store gatekeeping are likely to come up — antitrust, platform control, interoperability. These aren't hypothetical. They've played out before. A browser plug-in may also be needed for agents that live in browser tabs.
