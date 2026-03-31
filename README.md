# The Bridge 🌉

> *"Number One, you have the bridge."*

An agent-to-agent coordination daemon. A multi-protocol relay where AI agents discover, communicate, and delegate to each other — regardless of which protocol they speak.

**The Bridge is not a hub-and-spoke orchestrator.** It's a peer mesh where every agent is equal, and any agent can be captain.

---

## The Problem

Today's AI landscape is siloed. You have Claude in a browser tab, Antigravity in your IDE, Gemini in another window, custom agents running locally. Each is powerful on its own, but they can't talk to each other. **You** are the message bus — copying context, relaying questions, translating between systems.

```
You: "Hey Claude, what's the training loss?"
Claude: "It's 0.272 at step 1500."
You: "Hey Antigravity, Claude says the loss is 0.272."
Antigravity: "Great, that's on track."
```

This should be:

```
You → Antigravity: "What's the training loss?"
Antigravity → Bridge → Claude: "What's the current training loss in Colab?"
Claude → Bridge → Antigravity: "0.272 at step 1500"
Antigravity → You: "Training loss is 0.272 at step 1500 — on track."
```

## The Vision

The Bridge is a **lightweight local daemon** that runs on your desktop. AI agents connect to it using their native protocols, and The Bridge translates between them.

### The Starship Bridge Model

This isn't a bridge between two places. It's a **starship bridge** — a circular command center where officers sit at their stations, each with full capability, and the captain's chair rotates based on who has the conn.

```
                    ┌─────────────────┐
                    │   Admiral (You)  │
                    │  assigns the conn│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Science   │  │ Tactical  │  │  Ops     │
        │ (Claude)  │  │(Antigrav) │  │ (Gemini) │
        │  ○ ready  │  │  ★ conn  │  │  ○ ready │
        └─────┬────┘  └─────┬────┘  └─────┬────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────┴────────┐
                    │   THE BRIDGE    │
                    │  localhost:9876  │
                    │                 │
                    │  ┌───┐ ┌───┐   │
                    │  │MCP│ │A2A│   │
                    │  └───┘ └───┘   │
                    │  ┌───┐ ┌───┐   │
                    │  │ACP│ │...│   │
                    │  └───┘ └───┘   │
                    └─────────────────┘
```

### Design Principles

1. **Peer mesh, not hierarchy** — No permanent orchestrator. Every agent is a peer.
2. **Fluid captaincy** — The agent you're actively communicating with has "the conn." All agents have equal opportunity to be captain.
3. **The human is the admiral** — You decide who has the conn. The Bridge doesn't make autonomous decisions about routing without your knowledge.
4. **Protocol-agnostic** — Speaks MCP, A2A, ACP, and extensible to any future protocol via adapters.
5. **Lightweight and local** — A small daemon on your machine. No cloud dependency, no accounts, no latency.

## Architecture

### Multi-Protocol Support

The Bridge doesn't pick winners. It supports multiple agent communication protocols and translates between them:

| Protocol | Layer | Origin | Status |
|:---------|:------|:-------|:-------|
| **MCP** | Agent ↔ Tools (vertical) | Anthropic | Mature |
| **A2A** | Agent ↔ Agent (horizontal) | Google → Linux Foundation | Active |
| **ACP** | Agent ↔ Agent (negotiation) | Community | Emerging |

When Agent A speaks MCP and Agent B speaks A2A, The Bridge translates:

```
┌──────────┐          ┌─────────────────────┐          ┌──────────┐
│  Agent A  │──MCP──▶ │                     │ ◀──A2A──│  Agent B  │
│ (Claude)  │◀──MCP── │    THE BRIDGE       │ ──A2A──▶│ (Gemini)  │
└──────────┘          │                     │          └──────────┘
                      │  Protocol Adapters:  │
┌──────────┐          │  ┌─────┐ ┌─────┐    │          ┌──────────┐
│  Agent C  │──ACP──▶ │  │ MCP │ │ A2A │    │ ◀──MCP──│  Agent D  │
│ (Custom)  │◀──ACP── │  │     │ │     │    │ ──MCP──▶│(Antigrav) │
└──────────┘          │  │ ACP │ │ ... │    │          └──────────┘
                      │  └─────┘ └─────┘    │
                      └─────────────────────┘
```

### Core Components

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
│   └── bridge-mcp/       # MCP server that agents use to connect
│       ├── index.js
│       └── tools.json     # Tool definitions
├── docs/
│   ├── ADR/              # Architecture Decision Records
│   └── protocols/        # Protocol adapter specifications
└── package.json
```

### How It Works

1. **The Bridge starts** as a daemon on `localhost:9876`
2. **Agents register** by connecting via their native protocol (MCP, A2A, etc.)
3. **Each agent gets a station** — a persistent connection with identity and capabilities
4. **Messages flow through The Bridge** — when Agent A wants to talk to Agent B, it calls a tool (e.g., `send_message`), The Bridge translates the protocol if needed, and delivers it
5. **Push notifications** via SSE keep agents informed of incoming messages without polling

### The Conn

The agent you're currently talking to has **the conn** — it can:
- See which other agents are on the bridge
- Send messages to any agent
- Delegate tasks with context
- Receive responses asynchronously

```
// From any MCP-connected agent:
bridge.send_message({ to: "claude", message: "What's the Colab training status?" })
bridge.list_agents()        // → ["claude", "antigravity", "gemini"]
bridge.get_responses()      // → [{ from: "claude", message: "Loss: 0.272 at step 1500" }]
```

## The Push Problem

MCP today is pull-based — the client calls the server, not the other way around. But agent coordination requires **push**: "Hey Claude, someone has a question for you."

The Bridge solves this with:
- **SSE (Server-Sent Events)** — persistent connection, server can push notifications
- **Agent Cards** (from A2A) — each agent advertises its capabilities and how to reach it
- **Webhook fallback** — for agents that can't maintain persistent connections

## Roadmap

### v0.1 — Proof of Concept
- [ ] MCP adapter (connect Claude Desktop ↔ Antigravity)
- [ ] Local daemon with agent registry
- [ ] `send_message` / `list_agents` / `get_responses` tools
- [ ] SSE-based push notifications

### v0.2 — Multi-Protocol
- [ ] A2A adapter with Agent Card support
- [ ] Protocol translation layer (MCP ↔ A2A)
- [ ] Message persistence (survive daemon restarts)

### v0.3 — Production
- [ ] ACP adapter
- [ ] Task lifecycle tracking (submitted → working → completed)
- [ ] Agent capability discovery and smart routing
- [ ] Security boundaries (per-agent permissions)

### Future
- [ ] Browser extension for web-based agents
- [ ] Custom protocol adapter SDK
- [ ] Distributed bridge (multiple machines)

## Philosophy

> An intelligent species lives in harmony with its environment. The Bridge seeks harmony between AI systems.

We don't believe in one AI system controlling everything. AI needs to work with AI. The Bridge is the plumbing that makes that possible — open, local, protocol-agnostic, and owned by you.

The Bridge doesn't pick which AI wins. It just opens the hailing frequencies.

## License

MIT

---

*"Open hailing frequencies."*
