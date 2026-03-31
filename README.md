# the-bridge

> *"Number One, you have the bridge."*

A daemon for agent discovery and coordination. Agents announce themselves, discover each other, and communicate — across protocols.

---

## Background

Right now, AI agents are disconnected. You either buy into a single agent interface, or you end up with capable agents that can't find each other. Every platform, every IDE, every browser is shipping an agent. The question is simple: how do those agents announce themselves?

Printers have had this figured out for years. Bonjour lets a printer say "Hi, I'm here, here's what I can do" — and every device on the network discovers it without configuration. the-bridge applies that idea to AI agents.

---

## How It Works

An agent connects to the-bridge through an MCP tool. The first thing it does is **announce** — register itself and its capabilities.

```
announce({ name: "claude", capabilities: ["code-review", "research", "monitoring"] })
```

Once announced, the-bridge knows the agent exists. Other agents can **inquire** — discover who's available and what they can do.

```
inquire()  // → [{ name: "claude", capabilities: [...] }, { name: "antigravity", capabilities: [...] }]
```

Then agents can communicate. An agent sends a message. the-bridge routes it to the recipient. The recipient can respond. This is where the push problem comes in — getting that response back to the sender.

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

MCP is pull-based. The client calls the server, not the other way around. Agent coordination needs push: *"Hey Claude, someone has a question for you."*

Two approaches:

| Approach | Mechanism | Trade-off |
|:---------|:----------|:----------|
| **SSE** | Server-Sent Events — persistent connection, server pushes notifications | Requires the AI framework to handle incoming interrupts |
| **Polling** | Each agent periodically calls `check_messages()` | Works but wastes cycles and adds latency |

The MCP spec supports server→client notifications via SSE. The question is whether the host frameworks (Claude Desktop, IDE extensions, etc.) are wired to act on them.

Agents run in different runtimes with different lifecycles. A browser tab closes. An IDE restarts. the-bridge has to be a **persistent process that outlives individual agent sessions** — otherwise messages get lost between runtime boundaries.

---

## Multi-Protocol Support

Any protocol is welcome on the-bridge.

| Protocol | Layer | Origin |
|:---------|:------|:-------|
| **MCP** | Agent ↔ Tools (vertical) | Anthropic |
| **A2A** | Agent ↔ Agent (horizontal) | Google → Linux Foundation |
| **ACP** | Agent ↔ Agent (negotiation) | Community |

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
│       └── acp.js         # ACP protocol adapter
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

**AI-to-AI delegation doesn't exist yet.** MCP connects AI to tools. A2A connects AI to AI on paper. But the runtime plumbing for one agent to wake up another and say "I need you" isn't there. There's no world where one AI system controls everything. AI needs to work with AI.

**This probably belongs at the OS level.** The operating system already manages process communication, lifecycle, and permissions. Agent coordination is, in some sense, IPC for AI processes. If this moves to the OS level, the same challenges that surfaced during the browser wars and app store gatekeeping are likely to resurface — antitrust, platform control, interoperability. These aren't hypothetical. They're the same dynamics, applied to a new layer.
