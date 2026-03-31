# the-bridge

> *"Number One, you have the bridge."*

A daemon that lets AI agents talk to each other. Agents connect using their native protocol. the-bridge translates between them and delivers messages.

---

## Background

During a training run, Claude was monitoring a Colab session in a browser tab while Antigravity was open in the IDE. Both were capable. Neither could talk to the other. The human in the middle was the message bus.

```
You:          "Hey Claude, what's the training loss?"
Claude:       "0.272 at step 1500."
You:          "Hey Antigravity, Claude says the loss is 0.272."
Antigravity:  "That's on track."
```

Two round trips. Two context switches. The human doing the work that a message queue does.

The same pattern shows up elsewhere. In the Route-to-Luxon pipeline, a small language model can't do temporal arithmetic — so it delegates to a deterministic engine (Luxon) that can. A specialised agent offloading to another specialised agent. The same coordination problem at a different layer.

the-bridge is an attempt to build the plumbing.

---

## What It Is

A **message broker for AI agents**. Whichever agent the user is directing has the conn for that instruction. the-bridge doesn't have a favourite — it just routes messages. Trust sits with the user.

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

Three primitives:
- `send_message(to_agent, message)` — send a message to another agent
- `list_agents()` — see who's connected
- `get_responses()` — check for replies

---

## The Push Problem

MCP is pull-based. The client calls the server, not the other way around. Agent coordination needs push: *"Hey Claude, someone has a question for you."*

This is the hardest part. Two approaches:

| Approach | Mechanism | Trade-off |
|:---------|:----------|:----------|
| **SSE** | Server-Sent Events — persistent connection, server pushes notifications | Requires the AI framework to handle incoming interrupts |
| **Polling** | Each agent periodically calls `check_messages()` | Works but wastes cycles and adds latency |

The MCP spec supports server→client notifications via SSE. The question is whether the host frameworks (Claude Desktop, IDE extensions, etc.) are wired to act on them.

There's a deeper problem: Claude and Antigravity run in different runtimes with different lifecycles. A browser tab closes, an IDE restarts. The coordinator has to be a **persistent process that outlives both sessions** — otherwise messages get lost between runtime boundaries.

---

## Multi-Protocol Support

Multiple agent communication standards exist and the landscape is still forming:

| Protocol | Layer | Origin | Status |
|:---------|:------|:-------|:-------|
| **MCP** | Agent ↔ Tools (vertical) | Anthropic | Mature |
| **A2A** | Agent ↔ Agent (horizontal) | Google → Linux Foundation | Active |
| **ACP** | Agent ↔ Agent (negotiation) | Community | Emerging |

When Agent A speaks MCP and Agent B speaks A2A, the-bridge translates. Each protocol gets an adapter. New protocols get new adapters.

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

**AI-to-AI delegation is a missing layer.** MCP connects AI to tools. A2A connects AI to AI. But there's no standard for one AI to wake up another AI and say "I need you." The protocol exists on paper; the runtime plumbing doesn't. Today, the human is the integration layer.

**This probably belongs at the OS level.** The operating system already manages process communication, lifecycle, and permissions. An agent coordinator is, in some sense, an IPC mechanism for AI processes. Whether this ends up in user-space daemons or OS-level services is an open question.

**Whoever controls the coordination layer picks winners.** This is the browser wars and app store gatekeeping problem again, applied to AI. If a platform controls which agents can talk to which, it controls the ecosystem. the-bridge is open and local specifically to avoid that.

**Specialised agents coordinating is already happening.** The Route-to-Luxon pipeline does exactly this: a language model that can't do base-60 arithmetic generates a structured routing token, and a deterministic engine handles the computation. Different capabilities, different runtimes, coordinated output. the-bridge generalises that pattern to arbitrary agents.
